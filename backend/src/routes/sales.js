const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken, verifyAdminPinHelper } = require('../middleware/auth');

// Helper to generate next sequential bill number
function getNextBillNo() {
  const prefixSetting = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get();
  const prefix = prefixSetting ? prefixSetting.value : 'INV-';

  // Find highest numeric suffix in existing sales
  const lastSale = db.prepare("SELECT bill_no FROM sales ORDER BY id DESC LIMIT 1").get();
  let nextNum = 1;
  if (lastSale && lastSale.bill_no) {
    const match = lastSale.bill_no.match(/(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// POST /api/sales (One-Click Transactional Sale)
router.post('/', verifyToken, (req, res) => {
  const {
    customer_id,
    customer_name = 'Walk-in Customer',
    customer_phone = '--------------',
    items, // array of { product_id, phone_unit_id, imei1, qty, price, discount }
    subtotal,
    discount = 0,
    tax = 0,
    total,
    paid = 0,
    payment_method = 'Cash',
    payments = [], // array of { method, amount, reference_no }
    notes = '',
    counter = 'Counter 1'
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cannot checkout with an empty cart' });
  }

  // Check cashier discount limit
  if (req.user.role === 'cashier') {
    const discountLimitSetting = db.prepare("SELECT value FROM settings WHERE key = 'cashier_discount_limit'").get();
    const maxDiscountPercent = discountLimitSetting ? parseFloat(discountLimitSetting.value) : 10;
    const calcSubtotal = parseFloat(subtotal) || 1;
    const discountPercent = (parseFloat(discount) / calcSubtotal) * 100;
    if (discountPercent > maxDiscountPercent) {
      return res.status(403).json({
        error: `Discount exceeds cashier limit of ${maxDiscountPercent}%. Admin authorization required.`
      });
    }
  }

  try {
    const saleTransaction = db.transaction(() => {
      const billNo = getNextBillNo();
      const finalSubtotal = parseFloat(subtotal) || 0;
      const finalDiscount = parseFloat(discount) || 0;
      const finalTax = parseFloat(tax) || 0;
      const finalTotal = parseFloat(total) || (finalSubtotal - finalDiscount + finalTax);
      const finalPaid = parseFloat(paid) || 0;
      const finalBalance = Math.max(0, finalTotal - finalPaid);

      let saleStatus = 'PAID';
      if (finalBalance > 0) {
        saleStatus = finalPaid > 0 ? 'PARTIAL' : 'CREDIT';
      }

      // Check customer requirements for credit/balance
      let resolvedCustomerId = customer_id ? parseInt(customer_id) : null;
      if (finalBalance > 0) {
        if (!resolvedCustomerId || customer_name === 'Walk-in Customer') {
          // If customer has unpaid balance, we need a registered customer or create one
          if (customer_phone && customer_phone !== '--------------' && customer_name !== 'Walk-in Customer') {
            const custRes = db.prepare(`
              INSERT INTO customers (name, phone, balance) VALUES (?, ?, ?)
            `).run(customer_name, customer_phone, finalBalance);
            resolvedCustomerId = custRes.lastInsertRowid;
          } else {
            throw new Error('Credit / Partial payment requires a valid customer name and phone number');
          }
        } else {
          // Update existing customer balance
          db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(finalBalance, resolvedCustomerId);
          db.prepare(`
            INSERT INTO ledger_entries (party_type, party_id, type, amount, ref, description, date)
            VALUES ('customer', ?, 'debit', ?, ?, 'Remaining balance for bill', DATE('now'))
          `).run(resolvedCustomerId, finalBalance, billNo);
        }
      }

      // 1. Insert Sales Record
      const saleResult = db.prepare(`
        INSERT INTO sales (
          bill_no, customer_id, customer_name, customer_phone, cashier_id, cashier_name,
          counter, subtotal, discount, tax, total, paid, balance, payment_method, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        billNo,
        resolvedCustomerId,
        customer_name,
        customer_phone,
        req.user.id,
        req.user.name || req.user.username,
        counter,
        finalSubtotal,
        finalDiscount,
        finalTax,
        finalTotal,
        finalPaid,
        finalBalance,
        payment_method,
        saleStatus,
        notes
      );

      const saleId = saleResult.lastInsertRowid;

      // 2. Insert Sale Items and Deduct Stock
      const insertItem = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, product_name, phone_unit_id, imei1, qty, price,
          cost_snapshot, discount, warranty_until, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      for (const item of items) {
        const product = db.prepare(`
          SELECT p.*, c.track_imei
          FROM products p
          JOIN categories c ON p.category_id = c.id
          WHERE p.id = ?
        `).get(item.product_id);

        if (!product) {
          throw new Error(`Product ID ${item.product_id} not found`);
        }

        const itemQty = parseInt(item.qty) || 1;
        const itemPrice = parseFloat(item.price) !== undefined ? parseFloat(item.price) : product.sale_price;
        const itemDiscount = parseFloat(item.discount) || 0;
        const costSnapshot = product.cost_price;

        let warrantyUntil = null;
        if (product.warranty_days > 0) {
          const wDate = new Date();
          wDate.setDate(wDate.getDate() + product.warranty_days);
          warrantyUntil = wDate.toISOString().split('T')[0];
        }

        let phoneUnitId = null;
        let imei1 = null;

        if (product.track_imei === 1) {
          // Phone item must have a valid in_stock unit
          let unit = null;
          if (item.phone_unit_id) {
            unit = db.prepare("SELECT * FROM phone_units WHERE id = ? AND status = 'in_stock'").get(item.phone_unit_id);
          } else if (item.imei1) {
            unit = db.prepare("SELECT * FROM phone_units WHERE imei1 = ? AND status = 'in_stock'").get(item.imei1.trim());
          }

          if (!unit) {
            throw new Error(`IMEI ${item.imei1 || item.phone_unit_id} for ${product.name} is not available in stock`);
          }

          phoneUnitId = unit.id;
          imei1 = unit.imei1;

          // Insert sale item
          const sItemRes = insertItem.run(
            saleId,
            product.id,
            product.name,
            phoneUnitId,
            imei1,
            1, // phone units are always 1 per IMEI
            itemPrice,
            costSnapshot,
            itemDiscount,
            warrantyUntil
          );

          // Update phone unit to SOLD
          db.prepare(`
            UPDATE phone_units
            SET status = 'sold', sale_item_id = ?, sold_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(sItemRes.lastInsertRowid, phoneUnitId);

          // Log stock movement
          db.prepare(`
            INSERT INTO stock_movements (product_id, phone_unit_id, type, qty, ref, user, reason)
            VALUES (?, ?, 'sale', -1, ?, ?, 'Sold on bill')
          `).run(product.id, phoneUnitId, billNo, req.user.username);

        } else {
          // Accessory item
          if (product.stock_qty < itemQty) {
            // Check if negative stock is allowed in settings
            const allowNeg = db.prepare("SELECT value FROM settings WHERE key = 'allow_negative_stock'").get();
            if (!allowNeg || allowNeg.value !== '1') {
              throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock_qty}, requested: ${itemQty}`);
            }
          }

          // Insert sale item
          insertItem.run(
            saleId,
            product.id,
            product.name,
            null,
            null,
            itemQty,
            itemPrice,
            costSnapshot,
            itemDiscount,
            warrantyUntil
          );

          // Deduct product stock
          db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(itemQty, product.id);

          // Log stock movement
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, qty, ref, user, reason)
            VALUES (?, 'sale', ?, ?, ?, 'Sold on bill')
          `).run(product.id, -itemQty, billNo, req.user.username);
        }
      }

      // 3. Insert Payment records
      const insertPayment = db.prepare(`
        INSERT INTO payments (sale_id, method, amount, reference_no, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      if (payments && payments.length > 0) {
        for (const p of payments) {
          if (parseFloat(p.amount) > 0) {
            insertPayment.run(saleId, p.method, parseFloat(p.amount), p.reference_no || null);
          }
        }
      } else if (finalPaid > 0) {
        insertPayment.run(saleId, payment_method, finalPaid, null);
      }

      // 4. Audit Log
      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, detail, ip)
        VALUES (?, ?, 'SALE_COMPLETED', ?, ?)
      `).run(req.user.id, req.user.username, `Completed sale ${billNo} (Total: Rs. ${finalTotal})`, req.ip);

      return { saleId, billNo };
    });

    const { saleId, billNo } = saleTransaction();

    // Fetch the complete sale with items, shop details, and receipt format
    const fullSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    const salePayments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(saleId);
    const settingsList = db.prepare('SELECT key, value FROM settings').all();
    const settingsMap = {};
    for (const s of settingsList) {
      settingsMap[s.key] = s.value;
    }

    res.status(201).json({
      message: 'Sale completed successfully',
      sale: {
        ...fullSale,
        items: saleItems,
        payments: salePayments,
        settings: settingsMap
      }
    });
  } catch (err) {
    console.error('Sale error:', err);
    res.status(400).json({ error: err.message || 'Failed to complete sale' });
  }
});

// GET /api/sales (List sales with search & pagination)
router.get('/', (req, res) => {
  const { search, date_from, date_to, cashier_id, status, limit = 50, offset = 0 } = req.query;

  let query = `SELECT * FROM sales WHERE 1=1`;
  const params = [];

  if (search && search.trim()) {
    query += ` AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`;
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  if (date_from) {
    query += ` AND DATE(created_at) >= DATE(?)`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND DATE(created_at) <= DATE(?)`;
    params.push(date_to);
  }

  if (cashier_id) {
    query += ` AND cashier_id = ?`;
    params.push(cashier_id);
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const sales = db.prepare(query).all(...params);

  // Total count for pagination
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;

  res.json({ sales, total: totalCount });
});

// GET /api/sales/:id (Single sale for viewing/reprinting)
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? OR bill_no = ?').get(id, id);
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
  const settingsList = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap = {};
  for (const s of settingsList) {
    settingsMap[s.key] = s.value;
  }

  res.json({
    sale: {
      ...sale,
      items,
      payments,
      settings: settingsMap
    }
  });
});

// POST /api/sales/:id/void (Void bill with Admin authorization)
router.post('/:id/void', verifyToken, (req, res) => {
  const { id } = req.params;
  const { reason = 'Cancelled by admin', admin_pin } = req.body;

  // Verify admin authorization
  if (req.user.role !== 'admin') {
    if (!admin_pin || !verifyAdminPinHelper(admin_pin)) {
      return res.status(403).json({ error: 'Admin PIN is required to void this bill' });
    }
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found' });
  }
  if (sale.status === 'VOID') {
    return res.status(400).json({ error: 'This bill has already been voided' });
  }

  try {
    const voidTx = db.transaction(() => {
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);

      for (const item of items) {
        if (item.phone_unit_id) {
          // Revert phone unit to in_stock
          db.prepare(`
            UPDATE phone_units
            SET status = 'in_stock', sale_item_id = NULL, sold_at = NULL
            WHERE id = ?
          `).run(item.phone_unit_id);

          db.prepare(`
            INSERT INTO stock_movements (product_id, phone_unit_id, type, qty, ref, user, reason)
            VALUES (?, ?, 'return', 1, ?, ?, ?)
          `).run(item.product_id, item.phone_unit_id, sale.bill_no, req.user.username, `Void bill: ${reason}`);
        } else {
          // Revert accessory stock
          db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(item.qty, item.product_id);

          db.prepare(`
            INSERT INTO stock_movements (product_id, type, qty, ref, user, reason)
            VALUES (?, 'return', ?, ?, ?, ?)
          `).run(item.product_id, item.qty, sale.bill_no, req.user.username, `Void bill: ${reason}`);
        }
      }

      // If customer had an outstanding balance on this bill, reverse ledger
      if (sale.balance > 0 && sale.customer_id) {
        db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(sale.balance, sale.customer_id);
        db.prepare(`
          INSERT INTO ledger_entries (party_type, party_id, type, amount, ref, description, date)
          VALUES ('customer', ?, 'credit', ?, ?, 'Reversal of voided bill', DATE('now'))
        `).run(sale.customer_id, sale.balance, sale.bill_no);
      }

      // Mark sale as VOID
      db.prepare("UPDATE sales SET status = 'VOID', notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?")
        .run(`VOIDED: ${reason}`, sale.id);

      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, detail, ip)
        VALUES (?, ?, 'VOID_SALE', ?, ?)
      `).run(req.user.id, req.user.username, `Voided sale ${sale.bill_no} (${reason})`, req.ip);
    });

    voidTx();
    res.json({ message: `Bill ${sale.bill_no} has been voided successfully and inventory restored` });
  } catch (err) {
    console.error('Void error:', err);
    res.status(500).json({ error: 'Failed to void bill' });
  }
});

// Held Bills Endpoints
// POST /api/sales/hold (Hold current cart)
router.post('/hold', verifyToken, (req, res) => {
  const { cart, customer_name, note } = req.body;
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const result = db.prepare(`
    INSERT INTO held_bills (cashier_id, customer_name, cart_json, note)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, customer_name || 'Walk-in Customer', JSON.stringify(cart), note || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Cart held successfully' });
});

// GET /api/sales/held (Get all held bills)
router.get('/held/list', verifyToken, (req, res) => {
  const bills = db.prepare(`
    SELECT h.*, u.name as cashier_name
    FROM held_bills h
    LEFT JOIN users u ON h.cashier_id = u.id
    ORDER BY h.id DESC
  `).all();
  res.json({ heldBills: bills });
});

// DELETE /api/sales/held/:id (Resume or discard held bill)
router.delete('/held/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM held_bills WHERE id = ?').run(id);
  res.json({ message: 'Held bill removed' });
});

module.exports = router;
