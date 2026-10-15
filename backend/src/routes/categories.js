const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/categories (all categories with product counts)
router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as product_count
    FROM categories c
    ORDER BY c.name ASC
  `).all();
  res.json({ categories });
});

// POST /api/categories
router.post('/', verifyToken, (req, res) => {
  const { name, track_imei, default_warranty_days } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO categories (name, track_imei, default_warranty_days)
      VALUES (?, ?, ?)
    `).run(name.trim(), track_imei ? 1 : 0, default_warranty_days ? parseInt(default_warranty_days) : 0);

    res.status(201).json({
      id: result.lastInsertRowid,
      name: name.trim(),
      track_imei: track_imei ? 1 : 0,
      default_warranty_days: default_warranty_days ? parseInt(default_warranty_days) : 0
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { name, track_imei, default_warranty_days } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    db.prepare(`
      UPDATE categories
      SET name = ?, track_imei = ?, default_warranty_days = ?
      WHERE id = ?
    `).run(name.trim(), track_imei ? 1 : 0, default_warranty_days ? parseInt(default_warranty_days) : 0, id);

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id);
  if (prodCount.count > 0) {
    return res.status(400).json({ error: `Cannot delete category: ${prodCount.count} product(s) are assigned to it.` });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ message: 'Category deleted successfully' });
});

module.exports = router;
