const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { JWT_SECRET, verifyToken, requireAdmin, verifyAdminPinHelper } = require('../middleware/auth');

// POST /api/auth/login (Supports PIN or Username + Password)
router.post('/login', (req, res) => {
  const { pin, username, password } = req.body;

  try {
    let user = null;

    if (pin) {
      // Find all active users and compare pin_hash
      const users = db.prepare('SELECT * FROM users WHERE active = 1').all();
      for (const u of users) {
        if (bcrypt.compareSync(pin.toString(), u.pin_hash)) {
          user = u;
          break;
        }
      }
    } else if (username && password) {
      const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
      if (u && u.password_hash && bcrypt.compareSync(password, u.password_hash)) {
        user = u;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid PIN or credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' } // Long session for offline shop counter
    );

    // Audit log
    db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.username, 'LOGIN', `Logged in via ${pin ? 'PIN' : 'password'}`, req.ip);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare('SELECT id, name, username, role, active FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'User inactive or not found' });
  }
  res.json({ user });
});

// POST /api/auth/verify-admin-pin
router.post('/verify-admin-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ valid: false, error: 'PIN required' });
  }
  const isValid = verifyAdminPinHelper(pin);
  if (isValid) {
    return res.json({ valid: true });
  } else {
    return res.status(403).json({ valid: false, error: 'Incorrect Admin PIN' });
  }
});

// GET /api/auth/users (Admin only)
router.get('/users', verifyToken, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, username, role, active, created_at FROM users ORDER BY id ASC').all();
  res.json({ users });
});

// POST /api/auth/users (Admin only)
router.post('/users', verifyToken, requireAdmin, (req, res) => {
  const { name, username, pin, password, role } = req.body;
  if (!name || !username || !pin || !role) {
    return res.status(400).json({ error: 'Name, username, PIN, and role are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const pinHash = bcrypt.hashSync(pin.toString(), salt);
  const passHash = password ? bcrypt.hashSync(password, salt) : null;

  const result = db.prepare(`
    INSERT INTO users (name, username, pin_hash, password_hash, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name, username, pinHash, passHash, role);

  db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.user.username, 'CREATE_USER', `Created user ${username} (${role})`, req.ip);

  res.status(201).json({ id: result.lastInsertRowid, message: 'User created successfully' });
});

// PUT /api/auth/users/:id (Admin only)
router.put('/users/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, pin, password, role, active } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const salt = bcrypt.genSaltSync(10);
  const pinHash = pin ? bcrypt.hashSync(pin.toString(), salt) : user.pin_hash;
  const passHash = password ? bcrypt.hashSync(password, salt) : user.password_hash;
  const newName = name !== undefined ? name : user.name;
  const newRole = role !== undefined ? role : user.role;
  const newActive = active !== undefined ? (active ? 1 : 0) : user.active;

  db.prepare(`
    UPDATE users SET name = ?, pin_hash = ?, password_hash = ?, role = ?, active = ?
    WHERE id = ?
  `).run(newName, pinHash, passHash, newRole, newActive, id);

  db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.user.username, 'UPDATE_USER', `Updated user ID ${id}`, req.ip);

  res.json({ message: 'User updated successfully' });
});

module.exports = router;
