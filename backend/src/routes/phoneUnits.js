const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken } = require('../middleware/auth');

// POST /api/phone-units/receive (Batch receive phone IMEIs)
router.post('/receive', verifyToken, (req, res) => {
  const { product_id, imeis, supplier_id, purchase_invoice, unit_cost, notes } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  if (!Array.isArray(imeis) || imeis.length === 0) {
    return res.status(400).json({ error: 'At least one IMEI is required' });
  }

  const product = db.prepare(`
    SELECT p.*, c.track_imei
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(product_id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  if (product.track_imei !== 1) {
    return res.status(400).json({ error: 'This product is an accessory, not tracked by IMEI' });
  }

  // Pre-validate all IMEIs to ensure no duplicates within the submission or already in DB
  const seenImeis = new Set();
  for (const item of imeis) {
    const imei1 = (item.imei1 || item).toString().trim();
    if (!imei1) {
      return res.status(400).json({ error: 'Empty IMEI provided' });
    }
    if (seenImeis.has(imei1)) {
      return res.status(400).json({ error: `Duplicate IMEI in input list: ${imei1}` });
    }
    seenImeis.add(imei1);

    const existing = db.prepare('SELECT id, status, imei1 FROM phone_units WHERE imei1 = ?').get(imei1);
    if (existing) {
      return res.status(400).json({
        error: `IMEI ${imei1} already exists in database (Current Status: ${existing.status.toUpperCase()})`
      });
    }
  }

  try {
    const receiveTx = db.transaction(() => {
      let purchaseId = null;
      if (supplier_id || purchase_invoice) {
        const totalCost = (parseFloat(unit_cost) || product.cost_price) * imeis.length;
        const pRes = db.prepare(`
          INSERT INTO purchases (supplier_id, invoice_no, total, paid, date, notes)
          VALUES (?, ?, ?, ?, DATE('now'), ?)
        `).run(
          supplier_id || null,
          purchase_invoice || 'STOCK-IN',
          totalCost,
          totalCost,
          notes || `Received ${imeis.length} units of ${product.name}`
        );
        purchaseId = pRes.lastInsertRowid;
      }

      const insertUnit = db.prepare(`
        INSERT INTO phone_units (product_id, imei1, imei2, status, purchase_id, notes, added_at)
        VALUES (?, ?, ?, 'in_stock', ?, ?, CURRENT_TIMESTAMP)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (product_id, phone_unit_id, type, qty, ref, user, reason)
        VALUES (?, ?, 'purchase', 1, ?, ?, ?)
      `);

      for (const item of imeis) {
        const imei1 = (item.imei1 || item).toString().trim();
        const imei2 = item.imei2 ? item.imei2.toString().trim() : null;

        const uRes = insertUnit.run(product_id, imei1, imei2, purchaseId, notes || null);
        insertMovement.run(
          product_id,
          uRes.lastInsertRowid,
          purchase_invoice || 'STOCK-IN',
          req.user?.username || 'admin',
          `Received unit IMEI: ${imei1}`
        );
      }

      // If unit_cost was provided and differs from cost_price, update product cost_price
      if (unit_cost && parseFloat(unit_cost) > 0) {
        db.prepare('UPDATE products SET cost_price = ? WHERE id = ?').run(parseFloat(unit_cost), product_id);
      }

      db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
        .run(
          req.user?.id || 1,
          req.user?.username || 'admin',
          'RECEIVE_PHONES',
          `Received ${imeis.length} units of ${product.name}`,
          req.ip
        );

      return imeis.length;
    });

    const count = receiveTx();
    res.status(201).json({
      message: `Successfully received ${count} phone unit(s)`,
      count
    });
  } catch (err) {
    console.error('Receive phones error:', err);
    res.status(500).json({ error: 'Failed to receive phone units' });
  }
});

// GET /api/phone-units/lookup/:imei (Comprehensive IMEI and Warranty lookup)
router.get('/lookup/:imei', (req, res) => {
  const { imei } = req.params;
  const imeiClean = imei.trim();

  const unit = db.prepare(`
    SELECT 
      u.*,
      p.name as product_name,
      p.brand,
      p.model,
      p.sale_price,
      p.cost_price,
      p.warranty_days,
      s.bill_no,
      s.created_at as sale_date,
      s.customer_name,
      s.customer_phone,
      si.warranty_until,
      si.price as sold_price,
      supp.name as supplier_name,
      pur.invoice_no as purchase_invoice,
      pur.date as purchase_date
    FROM phone_units u
    JOIN products p ON u.product_id = p.id
    LEFT JOIN sale_items si ON u.id = si.phone_unit_id
    LEFT JOIN sales s ON si.sale_id = s.id
    LEFT JOIN purchases pur ON u.purchase_id = pur.id
    LEFT JOIN suppliers supp ON pur.supplier_id = supp.id
    WHERE u.imei1 = ? OR u.imei2 = ?
  `).get(imeiClean, imeiClean);

  if (!unit) {
    return res.status(404).json({ error: 'No phone found with this IMEI' });
  }

  // Calculate warranty status
  let warrantyStatus = 'NO_WARRANTY';
  let daysRemaining = 0;

  if (unit.warranty_until) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(unit.warranty_until);
    expDate.setHours(0, 0, 0, 0);

    const diffMs = expDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining >= 0) {
      warrantyStatus = 'VALID';
    } else {
      warrantyStatus = 'EXPIRED';
    }
  }

  // Get notes/history from stock movements
  const history = db.prepare(`
    SELECT * FROM stock_movements
    WHERE phone_unit_id = ?
    ORDER BY created_at DESC
  `).all(unit.id);

  res.json({
    unit: {
      ...unit,
      warrantyStatus,
      daysRemaining,
      history
    }
  });
});

// GET /api/phone-units/product/:productId (In-stock units)
router.get('/product/:productId', (req, res) => {
  const { productId } = req.params;
  const units = db.prepare(`
    SELECT id, imei1, imei2, status, added_at, notes
    FROM phone_units
    WHERE product_id = ? AND status = 'in_stock'
    ORDER BY added_at DESC
  `).all(productId);
  res.json({ units });
});

// POST /api/phone-units/:id/note (Add warranty claim / repair note)
router.post('/:id/note', verifyToken, (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'Note cannot be empty' });
  }

  const unit = db.prepare('SELECT id, notes FROM phone_units WHERE id = ?').get(id);
  if (!unit) {
    return res.status(404).json({ error: 'Phone unit not found' });
  }

  const timestamp = new Date().toLocaleString('en-PK');
  const userTag = req.user?.username || 'admin';
  const updatedNotes = unit.notes 
    ? `${unit.notes}\n[${timestamp} by ${userTag}]: ${note.trim()}`
    : `[${timestamp} by ${userTag}]: ${note.trim()}`;

  db.prepare('UPDATE phone_units SET notes = ? WHERE id = ?').run(updatedNotes, id);

  res.json({ message: 'Note added successfully', notes: updatedNotes });
});

module.exports = router;
