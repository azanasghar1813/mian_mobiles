const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getLanIps } = require('../utils/lanIp');

const upload = multer({ dest: path.join(__dirname, '..', '..', 'backups') });

// GET /api/settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings });
});

// PUT /api/settings (Update settings - Admin only)
router.put('/', verifyToken, requireAdmin, (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }

  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateTx = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, value !== null && value !== undefined ? value.toString() : '');
    }

    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, detail, ip)
      VALUES (?, ?, 'UPDATE_SETTINGS', 'Updated shop/system settings', ?)
    `).run(req.user.id, req.user.username, req.ip);
  });

  updateTx();
  res.json({ message: 'Settings updated successfully' });
});

// GET /api/settings/lan-info (LAN IP addresses for Counter 2 and Mobile devices)
router.get('/lan-info', (req, res) => {
  const port = process.env.PORT || 5000;
  const ips = getLanIps();
  const urls = ips.map(item => ({
    interface: item.interface,
    ip: item.ip,
    url: `http://${item.ip}:${port}`
  }));

  res.json({
    port,
    lanUrls: urls,
    primaryUrl: urls.length > 0 ? urls[0].url : `http://localhost:${port}`
  });
});

// GET /api/settings/backup (Download database backup)
router.get('/backup', verifyToken, requireAdmin, (req, res) => {
  const dbPath = path.join(__dirname, '..', '..', 'data', 'mian_mobiles.db');
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database file not found' });
  }

  const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFileName = `mian_mobiles_backup_${now}.db`;

  // Also keep a copy in the backups folder
  const backupsDir = path.join(__dirname, '..', '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const copyDest = path.join(backupsDir, backupFileName);
  fs.copyFileSync(dbPath, copyDest);

  res.download(dbPath, backupFileName, (err) => {
    if (err) {
      console.error('Download backup error:', err);
    }
  });
});

// POST /api/settings/restore (Restore database from file - Admin only)
router.post('/restore', verifyToken, requireAdmin, upload.single('backup_file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No backup file uploaded' });
  }

  try {
    const uploadedPath = req.file.path;
    const dbPath = path.join(__dirname, '..', '..', 'data', 'mian_mobiles.db');

    // Create a safety backup of current db first
    const safetyBackup = path.join(__dirname, '..', '..', 'backups', `pre_restore_${Date.now()}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, safetyBackup);
    }

    // Replace db
    fs.copyFileSync(uploadedPath, dbPath);
    fs.unlinkSync(uploadedPath); // remove uploaded temp file

    res.json({
      message: 'Database restored successfully! Please restart the server for all changes to take full effect.',
      safetyBackup
    });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

// GET /api/settings/audit-log (Admin only)
router.get('/audit-log', verifyToken, requireAdmin, (req, res) => {
  const { limit = 50 } = req.query;
  const logs = db.prepare(`
    SELECT * FROM audit_log
    ORDER BY id DESC LIMIT ?
  `).all(parseInt(limit));
  res.json({ logs });
});

module.exports = router;
