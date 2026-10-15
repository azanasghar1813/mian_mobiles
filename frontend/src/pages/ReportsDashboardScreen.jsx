import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Smartphone,
  Wallet,
  Coffee,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api';
import { playSuccessChime } from '../utils/audio';

export default function ReportsDashboardScreen({ user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Add Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('Utilities');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');

  useEffect(() => {
    fetchDashboard();
    fetchExpenses();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      setDashboardData(res);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/reports/expenses');
      setExpenses(res.expenses || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;

    try {
      await api.post('/reports/expenses', {
        title: expTitle.trim(),
        category: expCategory,
        amount: parseFloat(expAmount),
        notes: expNotes.trim()
      });

      playSuccessChime();
      setShowAddExpense(false);
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
      fetchExpenses();
      fetchDashboard();
    } catch (err) {
      alert(err.message || 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/reports/expenses/${id}`);
      fetchExpenses();
      fetchDashboard();
    } catch (e) {
      alert('Failed to delete expense');
    }
  };

  const today = dashboardData?.today;
  const totalExpensesToday = expenses
    .filter(e => e.date === new Date().toISOString().split('T')[0])
    .reduce((sum, e) => sum + e.amount, 0);

  const netProfitToday = (today?.profit || 0) - totalExpensesToday;

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full gap-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Owner Dashboard & Profit Analytics</h2>
            <p className="text-xs text-slate-400">Live sales performance, gross & net profit, and shop overhead tracking</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddExpense(true)}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Record Shop Expense</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Sales */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Today's Total Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-white">
              Rs. {today?.total_sales?.toLocaleString() || '0'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Collected: <span className="text-emerald-400 font-bold font-mono">Rs. {today?.total_collected?.toLocaleString() || '0'}</span>
            </div>
          </div>
        </div>

        {/* Today's Gross Profit */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Gross Sales Profit</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-teal-400">
              Rs. {today?.profit?.toLocaleString() || '0'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Snapshot margin on sold inventory
            </div>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Net Profit (After Expenses)</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono ${netProfitToday >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs. {netProfitToday.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Shop Expenses: Rs. {totalExpensesToday.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Invoices Count */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
            <span>Bills Completed Today</span>
            <Receipt className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-blue-400">
              {today?.bill_count || 0} Bills
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Credit Bills: Rs. {today?.total_credit?.toLocaleString() || '0'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 7-Day Trend + Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-Day Trend Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            7-Day Sales Trend (Rs.)
          </span>

          <div className="flex-1 flex items-end justify-between gap-3 min-h-[220px] pt-4 px-2 border-b border-slate-800">
            {dashboardData?.last7Days && dashboardData.last7Days.length > 0 ? (
              dashboardData.last7Days.map((day, idx) => {
                const maxVal = Math.max(...dashboardData.last7Days.map(d => d.revenue), 1);
                const heightPct = Math.max(12, Math.round((day.revenue / maxVal) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <span className="font-mono text-[10px] text-emerald-400 font-bold">
                      Rs. {(day.revenue / 1000).toFixed(1)}k
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg transition-all shadow-md shadow-emerald-500/10 min-h-[20px]"
                    />
                    <span className="text-[10px] text-slate-400 font-mono mt-1">
                      {day.sale_date.slice(5)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="w-full text-center text-slate-500 py-12 text-xs">
                No recent sales recorded this week.
              </div>
            )}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            Top Selling Products This Month
          </span>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {dashboardData?.topProducts && dashboardData.topProducts.length > 0 ? (
              dashboardData.topProducts.map((p, i) => (
                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                      #{i + 1}
                    </span>
                    <span className="font-bold text-white text-xs truncate max-w-[220px]">
                      {p.product_name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Rs. {p.total_revenue.toLocaleString()}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {p.total_qty_sold} sold
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-12 text-xs">
                No monthly sales data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            Shop Expenses Log (Rent, Utilities, Staff, Refreshment)
          </span>
          <span className="text-xs font-mono text-slate-400">
            Total Logged: <strong className="text-rose-400">Rs. {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</strong>
          </span>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Expense Title</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Amount (Rs.)</th>
                <th className="p-3">Notes</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500">
                    No expenses recorded yet. Click "Record Shop Expense" above to add.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-slate-400 font-mono">{exp.date}</td>
                    <td className="p-3 font-bold text-white">{exp.title}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-400">
                      Rs. {exp.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-400">{exp.notes || '—'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 hover:text-rose-400 text-slate-500"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-4">Record Shop Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Expense Title *</label>
                <input
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Shop Electricity Bill, Staff Lunch, Tea"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="Utilities">Utilities (Electricity/Net)</option>
                    <option value="Rent">Shop Rent</option>
                    <option value="Salaries">Staff Salary</option>
                    <option value="Refreshments">Tea & Refreshments</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="General">Other / General</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Amount (Rs.) *</label>
                  <input
                    type="number"
                    min="1"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Note / Reference (Optional)</label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Optional detail..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Save Expense
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
