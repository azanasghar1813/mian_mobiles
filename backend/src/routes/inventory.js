const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/inventory/stock (Complete stock list)
router.get('/stock', (req, res) => {
  const { category_id, search } = req.query;

  let query = `
    SELECT 
      p.*,
      c.name as category_name,
      c.track_imei,
      CASE 
        WHEN c.track_imei = 1 THEN 
          (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'in_stock')
        ELSE 
          p.stock_qty
      END as in_stock_count,
      CASE 
        WHEN c.track_imei = 1 THEN 
          (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'sold')
        ELSE 0
      END as sold_count,
      CASE 
        WHEN c.track_imei = 1 THEN 
          (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'damaged')
        ELSE 0
      END as damaged_count
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
  `;
  const params = [];

  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(category_id);
  }

  if (search && search.trim()) {
    query += ` AND (p.name LIKE ? OR p.brand LIKE ? OR p.model LIKE ? OR p.barcode LIKE ?)`;
    const s = `%${search.trim()}%`;
    params.push(s, s, s, s);
  }

  query += ` ORDER BY p.name ASC`;

  const stock = db.prepare(query).all(...params);
  res.json({ stock });
});

// GET /api/inventory/low-stock (Alert items)
router.get('/low-stock', (req, res) => {
  const lowStock = db.prepare(`
    SELECT 
      p.*,
      c.name as category_name,
      c.track_imei,
      CASE 
        WHEN c.track_imei = 1 THEN 
          (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'in_stock')
        ELSE 
          p.stock_qty
      END as current_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND (
        (c.track_imei = 0 AND p.stock_qty <= p.min_stock)
        OR (c.track_imei = 1 AND (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'in_stock') <= p.min_stock)
      )
    ORDER BY current_stock ASC
  `).all();

  res.json({ lowStock });
});

// POST /api/inventory/adjust (Stock adjustment: damaged, lost, correction)
router.post('/adjust', verifyToken, requireAdmin, (req, res) => {
  const { product_id, phone_unit_id, adjustment_type, qty, reason } = req.body;
  // adjustment_type: 'damaged', 'lost', 'correction'

  if (!product_id || !adjustment_type || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'Product, adjustment type, and mandatory reason are required' });
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

  try {
    const adjustTx = db.transaction(() => {
      if (product.track_imei === 1) {
        if (!phone_unit_id) {
          throw new Error('Phone unit (IMEI) must be selected for adjustment');
        }

        const unit = db.prepare('SELECT * FROM phone_units WHERE id = ?').get(phone_unit_id);
        if (!unit) {
          throw new Error('Phone unit not found');
        }

        const newStatus = adjustment_type === 'damaged' ? 'damaged' : 'returned';
        db.prepare('UPDATE phone_units SET status = ?, notes = COALESCE(notes || " | ", "") || ? WHERE id = ?')
          .run(newStatus, `Adjusted (${adjustment_type}): ${reason.trim()}`, phone_unit_id);

        db.prepare(`
          INSERT INTO stock_movements (product_id, phone_unit_id, type, qty, ref, user, reason)
          VALUES (?, ?, 'adjust', -1, 'STOCK_ADJUSTMENT', ?, ?)
        `).run(product.id, phone_unit_id, req.user.username, `Adjustment (${adjustment_type}): ${reason.trim()}`);
      } else {
        const changeQty = parseInt(qty);
        if (isNaN(changeQty) || changeQty === 0) {
          throw new Error('Valid non-zero quantity required for accessory adjustment');
        }

        db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(changeQty, product.id);

        db.prepare(`
          INSERT INTO stock_movements (product_id, type, qty, ref, user, reason)
          VALUES (?, 'adjust', ?, 'STOCK_ADJUSTMENT', ?, ?)
        `).run(product.id, changeQty, req.user.username, `Adjustment (${adjustment_type}): ${reason.trim()}`);
      }

      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, detail, ip)
        VALUES (?, ?, 'STOCK_ADJUSTMENT', ?, ?)
      `).run(
        req.user.id,
        req.user.username,
        `Adjusted stock for ${product.name} (${adjustment_type}, reason: ${reason})`,
        req.ip
      );
    });

    adjustTx();
    res.json({ message: 'Stock adjusted successfully' });
  } catch (err) {
    console.error('Adjust stock error:', err);
    res.status(400).json({ error: err.message || 'Failed to adjust stock' });
  }
});

// GET /api/inventory/movements (Stock movement history)
router.get('/movements', (req, res) => {
  const { product_id, limit = 100 } = req.query;

  let query = `
    SELECT sm.*, p.name as product_name, p.brand, pu.imei1
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN phone_units pu ON sm.phone_unit_id = pu.id
    WHERE 1=1
  `;
  const params = [];

  if (product_id) {
    query += ` AND sm.product_id = ?`;
    params.push(product_id);
  }

  query += ` ORDER BY sm.id DESC LIMIT ?`;
  params.push(parseInt(limit));

  const movements = db.prepare(query).all(...params);
  res.json({ movements });
});

// GET /api/inventory/valuation (Stock Valuation - Admin only)
router.get('/valuation', verifyToken, requireAdmin, (req, res) => {
  // 1. Accessory stock value
  const accessoryVal = db.prepare(`
    SELECT 
      SUM(stock_qty * cost_price) as total_cost,
      SUM(stock_qty * sale_price) as total_retail,
      SUM(stock_qty) as total_items
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1 AND c.track_imei = 0
  `).get();

  // 2. Phone in-stock value
  const phoneVal = db.prepare(`
    SELECT 
      SUM(p.cost_price) as total_cost,
      SUM(p.sale_price) as total_retail,
      COUNT(u.id) as total_items
    FROM phone_units u
    JOIN products p ON u.product_id = p.id
    WHERE u.status = 'in_stock' AND p.active = 1
  `).get();

  const totalCost = (accessoryVal.total_cost || 0) + (phoneVal.total_cost || 0);
  const totalRetail = (accessoryVal.total_retail || 0) + (phoneVal.total_retail || 0);
  const totalItems = (accessoryVal.total_items || 0) + (phoneVal.total_items || 0);
  const potentialProfit = totalRetail - totalCost;

  res.json({
    totalCost,
    totalRetail,
    totalItems,
    potentialProfit,
    marginPercent: totalRetail > 0 ? ((potentialProfit / totalRetail) * 100).toFixed(1) : 0,
    accessoryVal,
    phoneVal
  });
});

module.exports = router;
