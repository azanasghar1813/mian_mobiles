const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/suppliers
router.get('/', (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
  res.json({ suppliers });
});

// POST /api/suppliers
router.post('/', verifyToken, requireAdmin, (req, res) => {
  const { name, phone, address, balance = 0 } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  const result = db.prepare(`
    INSERT INTO suppliers (name, phone, address, balance)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), phone ? phone.trim() : null, address || null, parseFloat(balance) || 0);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Supplier added successfully' });
});

// GET /api/suppliers/purchases
router.get('/purchases', (req, res) => {
  const purchases = db.prepare(`
    SELECT p.*, s.name as supplier_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.id DESC
  `).all();
  res.json({ purchases });
});

// POST /api/suppliers/purchases (Accessory Stock-In / Purchase)
router.post('/purchases', verifyToken, (req, res) => {
  const { supplier_id, invoice_no, items, total, paid = 0, notes } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required for purchase' });
  }

  try {
    const purchaseTx = db.transaction(() => {
      const pRes = db.prepare(`
        INSERT INTO purchases (supplier_id, invoice_no, total, paid, date, notes)
        VALUES (?, ?, ?, ?, DATE('now'), ?)
      `).run(supplier_id || null, invoice_no || `PUR-${Date.now()}`, parseFloat(total) || 0, parseFloat(paid) || 0, notes || null);

      const purchaseId = pRes.lastInsertRowid;

      const insertPItem = db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, qty, cost)
        VALUES (?, ?, ?, ?)
      `);

      for (const it of items) {
        const qty = parseInt(it.qty) || 1;
        const cost = parseFloat(it.cost) || 0;

        insertPItem.run(purchaseId, it.product_id, qty, cost);

        // Update product stock and optionally cost price
        db.prepare(`
          UPDATE products
          SET stock_qty = stock_qty + ?,
              cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END
          WHERE id = ?
        `).run(qty, cost, cost, it.product_id);

        db.prepare(`
          INSERT INTO stock_movements (product_id, type, qty, ref, user, reason)
          VALUES (?, 'purchase', ?, ?, ?, 'Stock-in purchase')
        `).run(it.product_id, qty, invoice_no || `PUR-${purchaseId}`, req.user.username);
      }

      // If supplier owes balance or we owe supplier
      const balance = (parseFloat(total) || 0) - (parseFloat(paid) || 0);
      if (supplier_id && balance > 0) {
        db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(balance, supplier_id);
        db.prepare(`
          INSERT INTO ledger_entries (party_type, party_id, type, amount, ref, description, date)
          VALUES ('supplier', ?, 'credit', ?, ?, 'Purchase invoice balance', DATE('now'))
        `).run(supplier_id, balance, invoice_no || `PUR-${purchaseId}`);
      }

      return purchaseId;
    });

    const purchaseId = purchaseTx();
    res.status(201).json({ message: 'Stock received successfully', purchaseId });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'Failed to record purchase' });
  }
});

module.exports = router;
