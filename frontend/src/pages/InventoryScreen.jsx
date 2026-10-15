import React, { useState, useEffect } from 'react';
import {
  Boxes,
  AlertTriangle,
  ArrowUpDown,
  History,
  Search,
  DollarSign,
  Smartphone,
  Layers,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';

export default function InventoryScreen({ user }) {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'movements'
  const [stockList, setStockList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [valuation, setValuation] = useState(null);

  // Stock Movement History
  const [movements, setMovements] = useState([]);

  // Stock Adjustment Modal
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustType, setAdjustType] = useState('correction'); // 'correction', 'damaged', 'lost'
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustUnitId, setAdjustUnitId] = useState('');
  const [phoneUnitsForAdjust, setPhoneUnitsForAdjust] = useState([]);

  useEffect(() => {
    fetchStock();
    fetchCategories();
    if (user?.role === 'admin') {
      fetchValuation();
    }
  }, [user]);

  const fetchStock = async () => {
    try {
      const res = await api.get('/inventory/stock');
      setStockList(res.stock || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchValuation = async () => {
    try {
      const res = await api.get('/inventory/valuation');
      setValuation(res);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await api.get('/inventory/movements');
      setMovements(res.movements || []);
    } catch (e) {
      console.error(e);
    }
  };

  const openAdjustModal = async (product) => {
    setAdjustProduct(product);
    setAdjustType('correction');
    setAdjustQty('1');
    setAdjustReason('');
    setAdjustUnitId('');

    if (product.track_imei === 1) {
      try {
        const res = await api.get(`/phone-units/product/${product.id}`);
        setPhoneUnitsForAdjust(res.units || []);
        if (res.units && res.units.length > 0) {
          setAdjustUnitId(res.units[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustReason.trim()) {
      alert('Please provide a mandatory reason for this adjustment');
      return;
    }

    try {
      await api.post('/inventory/adjust', {
        product_id: adjustProduct.id,
        phone_unit_id: adjustProduct.track_imei === 1 ? adjustUnitId : null,
        adjustment_type: adjustType,
        qty: parseInt(adjustQty) || 0,
        reason: adjustReason.trim()
      });

      playSuccessChime();
      alert('Stock adjusted successfully!');
      setAdjustProduct(null);
      fetchStock();
      if (user?.role === 'admin') fetchValuation();
    } catch (err) {
      playErrorBuzzer();
      alert(err.message || 'Failed to adjust stock');
    }
  };

  const filteredStock = stockList.filter(p => {
    const matchSearch = !searchFilter ||
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.barcode.includes(searchFilter) ||
      (p.brand && p.brand.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchCat = !categoryFilter || p.category_id === parseInt(categoryFilter);
    const matchLow = !lowStockOnly || p.in_stock_count <= p.min_stock;
    return matchSearch && matchCat && matchLow;
  });

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full gap-4">
      {/* Top Valuation Summary Cards (Admin Only) */}
      {user?.role === 'admin' && valuation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Total Stock Cost</span>
              <div className="text-xl font-black font-mono text-white mt-1">
                Rs. {valuation.totalCost.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Retail Inventory Value</span>
              <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                Rs. {valuation.totalRetail.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Expected Profit</span>
              <div className="text-xl font-black font-mono text-teal-400 mt-1">
                Rs. {valuation.potentialProfit.toLocaleString()}
              </div>
            </div>
            <div className="text-xs font-bold px-2 py-1 bg-teal-500/20 text-teal-300 rounded-lg">
              {valuation.marginPercent}% Margin
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Total Units in Stock</span>
              <div className="text-xl font-black font-mono text-amber-400 mt-1">
                {valuation.totalItems} Units
              </div>
            </div>
            <div className="text-xs text-slate-400">
              📱 {valuation.phoneVal?.total_items || 0} Phones • 📦 {valuation.accessoryVal?.total_items || 0} Acc
            </div>
          </div>
        </div>
      )}

      {/* Main Stock Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'stock'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              Live Stock List ({filteredStock.length})
            </button>
            <button
              onClick={() => { setActiveTab('movements'); fetchMovements(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'movements'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Stock Movement Log</span>
            </button>
          </div>

          {activeTab === 'stock' && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter stock..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  lowStockOnly
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Only</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: LIVE STOCK TABLE */}
        {activeTab === 'stock' && (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category / Type</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Sale Price</th>
                  <th className="p-3 text-center">In Stock</th>
                  <th className="p-3 text-center">Sold Units</th>
                  <th className="p-3 text-center">Damaged</th>
                  <th className="p-3 text-center">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStock.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {p.barcode} {p.brand && `• ${p.brand}`}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-slate-300">{p.category_name}</span>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                        {p.track_imei ? '📱 IMEI Tracked' : '📦 Qty Tracked'}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      Rs. {p.cost_price.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                      Rs. {p.sale_price.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs inline-flex items-center gap-1 ${
                        p.in_stock_count <= p.min_stock
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {p.in_stock_count}
                        {p.in_stock_count <= p.min_stock && (
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-slate-400 font-semibold">
                      {p.track_imei ? p.sold_count : '—'}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-500">
                      {p.damaged_count > 0 ? (
                        <span className="text-amber-400 font-bold">{p.damaged_count}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => openAdjustModal(p)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 mx-auto transition-colors"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Adjust</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: STOCK MOVEMENT HISTORY */}
        {activeTab === 'movements' && (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">IMEI / Ref</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString('en-PK')}
                    </td>
                    <td className="p-3 font-bold text-white">{m.product_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        m.type === 'sale' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        m.type === 'purchase' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        m.type === 'return' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      <span className={m.qty > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {m.imei1 ? `IMEI: ${m.imei1}` : (m.ref || '—')}
                    </td>
                    <td className="p-3 text-slate-400">{m.user || 'system'}</td>
                    <td className="p-3 text-slate-300">{m.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STOCK ADJUSTMENT MODAL */}
      {adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-1">Adjust Inventory Stock</h3>
            <p className="text-xs text-emerald-400 font-semibold mb-4">{adjustProduct.name}</p>

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="correction">Inventory Count Correction</option>
                  <option value="damaged">Damaged / Broken</option>
                  <option value="lost">Lost / Missing</option>
                </select>
              </div>

              {adjustProduct.track_imei === 1 ? (
                <div>
                  <label className="block text-slate-400 mb-1">Select Phone Unit (IMEI)</label>
                  <select
                    value={adjustUnitId}
                    onChange={(e) => setAdjustUnitId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  >
                    {phoneUnitsForAdjust.map(u => (
                      <option key={u.id} value={u.id}>IMEI: {u.imei1}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-400 mb-1">Quantity Change (+ to add, - to deduct)</label>
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Mandatory Reason *</label>
                <textarea
                  rows="2"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Screen broken during handling, or physical audit adjustment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Confirm Adjustment
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustProduct(null)}
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
