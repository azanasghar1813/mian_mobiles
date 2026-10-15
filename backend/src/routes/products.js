const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/products
router.get('/', (req, res) => {
  const { search, category_id, low_stock, active = '1' } = req.query;

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
      END as current_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (active !== 'all') {
    query += ` AND p.active = ?`;
    params.push(active === '1' ? 1 : 0);
  }

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

  let products = db.prepare(query).all(...params);

  if (low_stock === '1') {
    products = products.filter(p => p.current_stock <= p.min_stock);
  }

  // Hide cost_price if user is a cashier and settings restrict it
  // (Caller can specify or verify token)
  res.json({ products });
});

// GET /api/products/check-barcode/:barcode (Rapid barcode scanner check)
router.get('/check-barcode/:barcode', (req, res) => {
  const { barcode } = req.params;
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.track_imei,
      CASE 
        WHEN c.track_imei = 1 THEN 
          (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'in_stock')
        ELSE 
          p.stock_qty
      END as current_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.barcode = ?
  `).get(barcode.trim());

  if (product) {
    return res.json({ exists: true, product });
  } else {
    return res.json({ exists: false });
  }
});

// GET /api/products/generate-barcode
router.get('/generate-barcode', (req, res) => {
  // Generate a 12-digit Code128 numeric barcode starting with 890
  const randomSuffix = Math.floor(100000000 + Math.random() * 900000000);
  const barcode = `890${randomSuffix}`;
  res.json({ barcode });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.track_imei,
      CASE 
        WHEN c.track_imei = 1 THEN 
          (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'in_stock')
        ELSE 
          p.stock_qty
      END as current_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // If track_imei is 1, also fetch in-stock phone units
  let inStockUnits = [];
  if (product.track_imei === 1) {
    inStockUnits = db.prepare(`
      SELECT id, imei1, imei2, status, added_at
      FROM phone_units
      WHERE product_id = ? AND status = 'in_stock'
      ORDER BY id ASC
    `).all(id);
  }

  res.json({ product, inStockUnits });
});

// POST /api/products
router.post('/', verifyToken, (req, res) => {
  const {
    barcode,
    name,
    brand,
    model,
    category_id,
    cost_price = 0,
    sale_price = 0,
    stock_qty = 0,
    min_stock = 3,
    warranty_days = 0
  } = req.body;

  if (!barcode || !barcode.trim()) {
    return res.status(400).json({ error: 'Barcode is required' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  if (!category_id) {
    return res.status(400).json({ error: 'Category is required' });
  }

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id);
  if (!category) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  // For phone category, opening stock_qty in products table is 0 (stock comes from receiving IMEIs)
  const finalStockQty = category.track_imei === 1 ? 0 : Math.max(0, parseInt(stock_qty) || 0);

  try {
    const insertTransaction = db.transaction(() => {
      const res = db.prepare(`
        INSERT INTO products (
          barcode, name, brand, model, category_id,
          cost_price, sale_price, stock_qty, min_stock, warranty_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        barcode.trim(),
        name.trim(),
        brand ? brand.trim() : null,
        model ? model.trim() : null,
        category_id,
        parseFloat(cost_price) || 0,
        parseFloat(sale_price) || 0,
        finalStockQty,
        parseInt(min_stock) || 3,
        warranty_days !== undefined ? parseInt(warranty_days) : category.default_warranty_days
      );

      const productId = res.lastInsertRowid;

      // If initial stock quantity was added for an accessory, record stock movement
      if (finalStockQty > 0) {
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, qty, ref, user, reason)
          VALUES (?, 'purchase', ?, 'OPENING_STOCK', ?, 'Initial opening stock')
        `).run(productId, finalStockQty, req.user?.username || 'admin');
      }

      db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
        .run(req.user?.id || 1, req.user?.username || 'admin', 'ADD_PRODUCT', `Added product: ${name.trim()} (Barcode: ${barcode})`, req.ip);

      return productId;
    });

    const newId = insertTransaction();
    res.status(201).json({ id: newId, message: 'Product added successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: products.barcode')) {
      return res.status(400).json({ error: 'A product with this barcode already exists' });
    }
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// PUT /api/products/:id
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const {
    barcode,
    name,
    brand,
    model,
    category_id,
    cost_price,
    sale_price,
    min_stock,
    warranty_days,
    active
  } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  try {
    db.prepare(`
      UPDATE products SET
        barcode = COALESCE(?, barcode),
        name = COALESCE(?, name),
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        category_id = COALESCE(?, category_id),
        cost_price = COALESCE(?, cost_price),
        sale_price = COALESCE(?, sale_price),
        min_stock = COALESCE(?, min_stock),
        warranty_days = COALESCE(?, warranty_days),
        active = COALESCE(?, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      barcode ? barcode.trim() : null,
      name ? name.trim() : null,
      brand !== undefined ? brand : null,
      model !== undefined ? model : null,
      category_id || null,
      cost_price !== undefined ? parseFloat(cost_price) : null,
      sale_price !== undefined ? parseFloat(sale_price) : null,
      min_stock !== undefined ? parseInt(min_stock) : null,
      warranty_days !== undefined ? parseInt(warranty_days) : null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );

    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: products.barcode')) {
      return res.status(400).json({ error: 'Another product with this barcode already exists' });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id (Soft deactivate)
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
  res.json({ message: 'Product deactivated successfully' });
});

module.exports = router;
