import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Search,
  Printer,
  RotateCcw,
  Ban,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Smartphone,
  CreditCard
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';
import Receipt from '../components/Receipt';

export default function SalesHistoryScreen({ user }) {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Sale for Detailed Modal View & Reprint
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Return & Exchange Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundType, setRefundType] = useState('cash'); // 'cash', 'credit', 'exchange'

  // Void Sale Modal (Admin PIN authorization)
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [voidError, setVoidError] = useState('');

  useEffect(() => {
    fetchSales();
  }, [search, dateFrom, dateTo, statusFilter]);

  const fetchSales = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/sales?${params.toString()}`);
      setSales(res.sales || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDetail = async (saleId) => {
    try {
      const res = await api.get(`/sales/${saleId}`);
      setSelectedSale(res.sale);
      setShowDetailModal(true);
    } catch (e) {
      alert('Failed to load bill details');
    }
  };

  const handleReprint = () => {
    window.print();
  };

  // Open Return Modal
  const handleOpenReturn = async (sale) => {
    try {
      const res = await api.get(`/sales/${sale.id}`);
      setSelectedSale(res.sale);
      // Map items with default return flags
      setReturnItems(
        res.sale.items.map(item => ({
          sale_item_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          phone_unit_id: item.phone_unit_id,
          imei1: item.imei1,
          selected: false,
          qty: 1,
          refund_amount: item.price,
          condition: 'restock' // 'restock' or 'damaged'
        }))
      );
      setReturnReason('');
      setShowReturnModal(true);
    } catch (e) {
      alert('Error preparing return');
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    const chosen = returnItems.filter(i => i.selected);
    if (chosen.length === 0) {
      alert('Please check at least one item to return');
      return;
    }
    if (!returnReason.trim()) {
      alert('Please state a reason for return');
      return;
    }

    try {
      await api.post('/returns', {
        sale_id: selectedSale.id,
        bill_no: selectedSale.bill_no,
        items: chosen,
        refund_type: refundType,
        reason: returnReason.trim()
      });

      playSuccessChime();
      alert('Return processed successfully! Stock has been restored.');
      setShowReturnModal(false);
      fetchSales();
    } catch (err) {
      playErrorBuzzer();
      alert(err.message || 'Failed to process return');
    }
  };

  // Void Bill Submit
  const handleVoidSubmit = async (e) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      setVoidError('Please state a reason for cancelling this bill');
      return;
    }

    setVoidError('');
    try {
      await api.post(`/sales/${selectedSale.id}/void`, {
        reason: voidReason.trim(),
        admin_pin: adminPin
      });

      playSuccessChime();
      alert(`Bill ${selectedSale.bill_no} has been VOIDED and inventory restored.`);
      setShowVoidModal(false);
      setShowDetailModal(false);
      setAdminPin('');
      setVoidReason('');
      fetchSales();
    } catch (err) {
      playErrorBuzzer();
      setVoidError(err.message || 'Failed to void bill');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full gap-4">
      {/* Header & Search Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sales Invoices & Receipts</h2>
              <p className="text-xs text-slate-400">Search past bills, 1-click reprint, process returns, or void bills</p>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Invoice #, Customer, Phone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="CREDIT">Credit (Udhar)</option>
            <option value="VOID">Voided / Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Counter</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500 text-xs">
                    No sales invoices found matching your criteria.
                  </td>
                </tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-emerald-400">{s.bill_no}</td>
                    <td className="p-3 text-slate-400 font-mono">
                      {new Date(s.created_at).toLocaleString('en-PK')}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-white">{s.customer_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.customer_phone}</div>
                    </td>
                    <td className="p-3 text-slate-300">{s.cashier_name || 'Staff'}</td>
                    <td className="p-3 text-slate-400">{s.counter}</td>
                    <td className="p-3 text-right font-mono font-black text-sm text-white">
                      Rs. {s.total.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] uppercase ${
                        s.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        s.status === 'VOID' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 line-through' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(s.id)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
                          title="View & Reprint Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {s.status !== 'VOID' && (
                          <button
                            onClick={() => handleOpenReturn(s)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg transition-colors"
                            title="Return / Exchange"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED BILL MODAL & 80MM REPRINT */}
      {showDetailModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="flex items-center justify-between w-full pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-base text-white">Invoice Details</h3>
                <span className="font-mono text-emerald-400 text-xs font-bold">{selectedSale.bill_no}</span>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Receipt Preview */}
            <div className="border border-slate-700 rounded-xl overflow-hidden shadow-2xl bg-white max-h-[60vh] overflow-y-auto w-full flex justify-center">
              <Receipt sale={selectedSale} isPreview={true} />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full mt-5">
              <button
                onClick={handleReprint}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>Reprint 80mm Receipt</span>
              </button>

              {selectedSale.status !== 'VOID' && (
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  <span>Void Bill</span>
                </button>
              )}

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN & EXCHANGE MODAL */}
      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-1">Process Item Return / Exchange</h3>
            <p className="text-xs text-emerald-400 font-mono mb-4">Invoice: {selectedSale.bill_no}</p>

            <form onSubmit={handleReturnSubmit} className="space-y-4 text-xs">
              <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950">
                <span className="font-bold text-slate-400">Select Items to Return:</span>
                {returnItems.map((item, idx) => (
                  <div key={idx} className="p-2 border border-slate-800/80 rounded-lg flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => {
                        const updated = [...returnItems];
                        updated[idx].selected = e.target.checked;
                        setReturnItems(updated);
                      }}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{item.product_name}</div>
                      {item.imei1 && <div className="text-[10px] text-emerald-400 font-mono">IMEI: {item.imei1}</div>}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-300">Rs. {item.refund_amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Refund Method</label>
                <select
                  value={refundType}
                  onChange={(e) => setRefundType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="cash">Cash Refund</option>
                  <option value="credit">Store Credit (Customer Ledger)</option>
                  <option value="exchange">Exchange with other item</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reason for Return *</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Customer changed mind, wrong accessory size"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Confirm & Restock Items
                </button>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOID BILL MODAL */}
      {showVoidModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-base mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Void / Cancel Bill</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Voiding bill <strong className="text-white font-mono">{selectedSale.bill_no}</strong> will restore all sold accessories back to stock and mark phone IMEIs as available.
            </p>

            {voidError && (
              <div className="p-3 mb-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Cancellation Reason *</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Accidental bill entry by cashier"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              {user?.role !== 'admin' && (
                <div>
                  <label className="block text-amber-400 font-bold mb-1">Admin Security PIN *</label>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Enter Admin PIN (1234)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
                >
                  Confirm Void Bill
                </button>
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden printable receipt for reprint trigger */}
      <Receipt sale={selectedSale} isPreview={false} />
    </div>
  );
}
