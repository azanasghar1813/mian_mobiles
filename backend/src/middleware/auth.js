const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'mian-mobiles-offline-pos-secret-key-2026';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token expired or invalid' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required for this action' });
  }
  next();
}

function verifyAdminPinHelper(pin) {
  if (!pin) return false;
  const admin = db.prepare("SELECT pin_hash FROM users WHERE role = 'admin' AND active = 1 LIMIT 1").get();
  if (!admin) return false;
  return bcrypt.compareSync(pin.toString(), admin.pin_hash);
}

module.exports = {
  JWT_SECRET,
  verifyToken,
  requireAdmin,
  verifyAdminPinHelper
};
