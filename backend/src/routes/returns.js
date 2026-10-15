const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken } = require('../middleware/auth');

// POST /api/returns
router.post('/', verifyToken, (req, res) => {
  const {
    sale_id,
    bill_no,
    items, // array of { sale_item_id, product_id, phone_unit_id, qty, refund_amount, condition }
    refund_type = 'cash', // 'cash', 'credit', 'exchange'
    reason = 'Customer return'
  } = req.body;

  if (!sale_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Sale ID and items to return are required' });
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(sale_id);
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  try {
    const returnTx = db.transaction(() => {
      let totalRefund = 0;
      for (const it of items) {
        totalRefund += parseFloat(it.refund_amount) || 0;
      }

      const retRes = db.prepare(`
        INSERT INTO returns (sale_id, bill_no, cashier_id, refund_type, total_refund, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(sale.id, bill_no || sale.bill_no, req.user.id, refund_type, totalRefund, reason);

      const returnId = retRes.lastInsertRowid;

      const insertRetItem = db.prepare(`
        INSERT INTO return_items (return_id, sale_item_id, product_id, phone_unit_id, qty, refund_amount, item_condition)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of items) {
        const qty = parseInt(it.qty) || 1;
        const refundAmt = parseFloat(it.refund_amount) || 0;
        const condition = it.condition || 'restock';

        insertRetItem.run(returnId, it.sale_item_id, it.product_id, it.phone_unit_id || null, qty, refundAmt, condition);

        if (it.phone_unit_id) {
          // Update phone unit status
          const newStatus = condition === 'damaged' ? 'damaged' : 'in_stock';
          db.prepare(`
            UPDATE phone_units
            SET status = ?, notes = COALESCE(notes || ' | ', '') || ?
            WHERE id = ?
          `).run(newStatus, `Returned on ${new Date().toLocaleDateString('en-PK')} (${reason})`, it.phone_unit_id);

          db.prepare(`
            INSERT INTO stock_movements (product_id, phone_unit_id, type, qty, ref, user, reason)
            VALUES (?, ?, 'return', 1, ?, ?, ?)
          `).run(it.product_id, it.phone_unit_id, sale.bill_no, req.user.username, `Return (${condition}): ${reason}`);
        } else {
          // If restockable, add back to stock_qty
          if (condition === 'restock') {
            db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(qty, it.product_id);
          }
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, qty, ref, user, reason)
            VALUES (?, 'return', ?, ?, ?, ?)
          `).run(it.product_id, condition === 'restock' ? qty : 0, sale.bill_no, req.user.username, `Return (${condition}): ${reason}`);
        }
      }

      // If credit refund and customer exists, credit customer ledger
      if (refund_type === 'credit' && sale.customer_id) {
        db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(totalRefund, sale.customer_id);
        db.prepare(`
          INSERT INTO ledger_entries (party_type, party_id, type, amount, ref, description, date)
          VALUES ('customer', ?, 'credit', ?, ?, 'Store credit for return', DATE('now'))
        `).run(sale.customer_id, totalRefund, sale.bill_no);
      }

      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, detail, ip)
        VALUES (?, ?, 'RETURN_PROCESSED', ?, ?)
      `).run(req.user.id, req.user.username, `Processed return for ${sale.bill_no} (Refund: Rs. ${totalRefund})`, req.ip);

      return returnId;
    });

    const returnId = returnTx();
    res.status(201).json({ message: 'Return processed successfully', returnId });
  } catch (err) {
    console.error('Return error:', err);
    res.status(500).json({ error: 'Failed to process return' });
  }
});

// GET /api/returns
router.get('/', (req, res) => {
  const returns = db.prepare(`
    SELECT r.*, u.name as cashier_name,
      (SELECT COUNT(*) FROM return_items ri WHERE ri.return_id = r.id) as item_count
    FROM returns r
    LEFT JOIN users u ON r.cashier_id = u.id
    ORDER BY r.id DESC
  `).all();
  res.json({ returns });
});

module.exports = router;
