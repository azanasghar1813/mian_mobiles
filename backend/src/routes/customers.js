const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken } = require('../middleware/auth');

// GET /api/customers
router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (search && search.trim()) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    const s = `%${search.trim()}%`;
    params.push(s, s);
  }

  query += ' ORDER BY name ASC';
  const customers = db.prepare(query).all(...params);
  res.json({ customers });
});

// POST /api/customers
router.post('/', verifyToken, (req, res) => {
  const { name, phone, address, balance = 0 } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const result = db.prepare(`
    INSERT INTO customers (name, phone, address, balance)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), phone ? phone.trim() : null, address || null, parseFloat(balance) || 0);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Customer added successfully' });
});

// GET /api/customers/:id/ledger (Customer ledger & purchase history)
router.get('/:id/ledger', (req, res) => {
  const { id } = req.params;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const ledger = db.prepare(`
    SELECT * FROM ledger_entries
    WHERE party_type = 'customer' AND party_id = ?
    ORDER BY id DESC
  `).all(id);

  const salesHistory = db.prepare(`
    SELECT id, bill_no, total, paid, balance, status, created_at
    FROM sales
    WHERE customer_id = ?
    ORDER BY id DESC
  `).all(id);

  res.json({ customer, ledger, salesHistory });
});

// POST /api/customers/:id/payment (Receive credit payment / Udhar recovery)
router.post('/:id/payment', verifyToken, (req, res) => {
  const { id } = req.params;
  const { amount, payment_method = 'Cash', ref = '', note = '' } = req.body;

  const paymentAmt = parseFloat(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  try {
    const payTx = db.transaction(() => {
      // Deduct customer balance
      db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(paymentAmt, id);

      // Add ledger credit entry
      db.prepare(`
        INSERT INTO ledger_entries (party_type, party_id, type, amount, ref, description, date)
        VALUES ('customer', ?, 'credit', ?, ?, ?, DATE('now'))
      `).run(
        id,
        paymentAmt,
        ref || `RECOVERY-${Date.now()}`,
        `Payment received via ${payment_method}${note ? ': ' + note : ''}`
      );

      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, detail, ip)
        VALUES (?, ?, 'CUSTOMER_PAYMENT', ?, ?)
      `).run(
        req.user.id,
        req.user.username,
        `Received Rs. ${paymentAmt} from customer ${customer.name}`,
        req.ip
      );
    });

    payTx();
    res.json({ message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('Customer payment error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
