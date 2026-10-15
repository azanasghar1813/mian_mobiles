const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/reports/dashboard (Owner Dashboard summary)
router.get('/dashboard', verifyToken, (req, res) => {
  const isOwner = req.user.role === 'admin';

  // 1. Today's figures
  const todaySales = db.prepare(`
    SELECT 
      COUNT(*) as bill_count,
      COALESCE(SUM(total), 0) as total_sales,
      COALESCE(SUM(paid), 0) as total_collected,
      COALESCE(SUM(balance), 0) as total_credit
    FROM sales
    WHERE DATE(created_at) = DATE('now') AND status != 'VOID'
  `).get();

  // Today's profit (from cost snapshots)
  let todayProfit = 0;
  if (isOwner) {
    const profitData = db.prepare(`
      SELECT 
        COALESCE(SUM((si.price - si.cost_snapshot) * si.qty - si.discount), 0) as gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.created_at) = DATE('now') AND s.status != 'VOID'
    `).get();
    todayProfit = profitData.gross_profit;
  }

  // Payment method breakdown today
  const paymentBreakdown = db.prepare(`
    SELECT 
      method,
      COALESCE(SUM(amount), 0) as total_amount
    FROM payments p
    JOIN sales s ON p.sale_id = s.id
    WHERE DATE(s.created_at) = DATE('now') AND s.status != 'VOID'
    GROUP BY method
  `).all();

  // Low stock count
  const lowStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT p.id
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
        AND (
          (c.track_imei = 0 AND p.stock_qty <= p.min_stock)
          OR (c.track_imei = 1 AND (SELECT COUNT(*) FROM phone_units u WHERE u.product_id = p.id AND u.status = 'in_stock') <= p.min_stock)
        )
    )
  `).get().count;

  // Active phone stock count
  const phonesInStock = db.prepare("SELECT COUNT(*) as count FROM phone_units WHERE status = 'in_stock'").get().count;
  
  // Total accessories stock count
  const accessoriesInStock = db.prepare(`
    SELECT COALESCE(SUM(p.stock_qty), 0) as total
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1 AND c.track_imei = 0
  `).get().total;

  // Recent 5 sales
  const recentSales = db.prepare(`
    SELECT id, bill_no, customer_name, total, payment_method, status, created_at
    FROM sales
    ORDER BY id DESC LIMIT 5
  `).all();

  // Last 7 days sales trend
  const last7Days = db.prepare(`
    SELECT 
      DATE(created_at) as sale_date,
      COUNT(*) as count,
      COALESCE(SUM(total), 0) as revenue
    FROM sales
    WHERE DATE(created_at) >= DATE('now', '-7 days') AND status != 'VOID'
    GROUP BY DATE(created_at)
    ORDER BY sale_date ASC
  `).all();

  // Top selling products this month
  const topProducts = db.prepare(`
    SELECT 
      si.product_name,
      SUM(si.qty) as total_qty_sold,
      SUM(si.qty * si.price) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE DATE(s.created_at) >= DATE('now', 'start of month') AND s.status != 'VOID'
    GROUP BY si.product_id, si.product_name
    ORDER BY total_qty_sold DESC
    LIMIT 5
  `).all();

  res.json({
    today: {
      ...todaySales,
      profit: isOwner ? todayProfit : null,
      paymentBreakdown
    },
    inventory: {
      lowStockCount,
      phonesInStock,
      accessoriesInStock
    },
    recentSales,
    last7Days,
    topProducts
  });
});

// GET /api/reports/analytics (Detailed Sales & Profit reports - Admin only)
router.get('/analytics', verifyToken, requireAdmin, (req, res) => {
  const { date_from, date_to } = req.query;

  let whereSales = "WHERE s.status != 'VOID'";
  let whereExpenses = "WHERE 1=1";
  const paramsSales = [];
  const paramsExpenses = [];

  if (date_from) {
    whereSales += " AND DATE(s.created_at) >= DATE(?)";
    whereExpenses += " AND DATE(date) >= DATE(?)";
    paramsSales.push(date_from);
    paramsExpenses.push(date_from);
  }
  if (date_to) {
    whereSales += " AND DATE(s.created_at) <= DATE(?)";
    whereExpenses += " AND DATE(date) <= DATE(?)";
    paramsSales.push(date_to);
    paramsExpenses.push(date_to);
  }

  // Total sales revenue and gross profit
  const salesSummary = db.prepare(`
    SELECT 
      COUNT(DISTINCT s.id) as bill_count,
      COALESCE(SUM(s.subtotal), 0) as subtotal,
      COALESCE(SUM(s.discount), 0) as discount,
      COALESCE(SUM(s.total), 0) as total_revenue,
      COALESCE(SUM(s.paid), 0) as total_received,
      COALESCE(SUM(s.balance), 0) as total_credit,
      COALESCE(SUM(items.profit), 0) as gross_profit
    FROM sales s
    LEFT JOIN (
      SELECT 
        sale_id,
        SUM((price - cost_snapshot) * qty - discount) as profit
      FROM sale_items
      GROUP BY sale_id
    ) items ON s.id = items.sale_id
    ${whereSales}
  `).get(...paramsSales);

  // Total expenses in period
  const expenseSummary = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses
    ${whereExpenses}
  `).get(...paramsExpenses);

  const totalRevenue = salesSummary.total_revenue || 0;
  const grossProfit = salesSummary.gross_profit || 0;
  const totalExpenses = expenseSummary.total_expenses || 0;
  const netProfit = grossProfit - totalExpenses;

  // Category-wise sales
  const categorySales = db.prepare(`
    SELECT 
      c.name as category_name,
      c.track_imei,
      COUNT(DISTINCT si.id) as units_sold,
      COALESCE(SUM(si.qty * si.price), 0) as revenue,
      COALESCE(SUM((si.price - si.cost_snapshot) * si.qty - si.discount), 0) as profit
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    ${whereSales}
    GROUP BY c.id, c.name, c.track_imei
    ORDER BY revenue DESC
  `).all(...paramsSales);

  res.json({
    summary: {
      ...salesSummary,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      margin_percent: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0
    },
    categorySales
  });
});

// Expenses Endpoints
// GET /api/reports/expenses
router.get('/expenses', verifyToken, requireAdmin, (req, res) => {
  const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
  res.json({ expenses });
});

// POST /api/reports/expenses
router.post('/expenses', verifyToken, requireAdmin, (req, res) => {
  const { title, category = 'General', amount, date, notes } = req.body;
  if (!title || !amount) {
    return res.status(400).json({ error: 'Title and amount are required' });
  }

  const result = db.prepare(`
    INSERT INTO expenses (title, category, amount, date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), category, parseFloat(amount), date || new Date().toISOString().split('T')[0], notes || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Expense recorded successfully' });
});

// DELETE /api/reports/expenses/:id
router.delete('/expenses/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ message: 'Expense deleted successfully' });
});

module.exports = router;
