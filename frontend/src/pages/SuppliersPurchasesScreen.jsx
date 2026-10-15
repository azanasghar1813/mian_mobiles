import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Phone,
  MapPin,
  ReceiptText,
  DollarSign,
  Package
} from 'lucide-react';
import { api } from '../api';
import { playSuccessChime } from '../utils/audio';

export default function SuppliersPurchasesScreen({ user }) {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    fetchSuppliers();
    fetchPurchases();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.suppliers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await api.get('/suppliers/purchases');
      setPurchases(res.purchases || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.post('/suppliers', {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null
      });
      playSuccessChime();
      setShowAddModal(false);
      setName('');
      setPhone('');
      setAddress('');
      fetchSuppliers();
    } catch (err) {
      alert(err.message || 'Failed to add supplier');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full gap-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Suppliers & Purchase Invoices</h2>
            <p className="text-xs text-slate-400">Manage wholesale vendors, stock-in history, and supplier balances</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Grid: Suppliers Cards + Purchases List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Suppliers List (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Wholesale Suppliers ({suppliers.length})
          </span>
          <div className="space-y-2.5 overflow-y-auto max-h-[500px]">
            {suppliers.map(s => (
              <div key={s.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{s.name}</span>
                  <span className="font-mono text-xs text-slate-400 font-semibold">
                    Balance: Rs. {s.balance?.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-col gap-1 text-slate-400 text-xs">
                  {s.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{s.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase History (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Recent Purchases & Stock Invoices ({purchases.length})
          </span>

          <div className="border border-slate-800 rounded-xl overflow-hidden flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Total Cost</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">
                      No purchase records found. Receive stock in the "Stock In" tab to log purchases.
                    </td>
                  </tr>
                ) : (
                  purchases.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-emerald-400">{p.invoice_no}</td>
                      <td className="p-3 font-bold text-white">{p.supplier_name || 'Direct Stock-in'}</td>
                      <td className="p-3 font-mono text-slate-400">{p.date}</td>
                      <td className="p-3 text-right font-mono font-bold text-white">
                        Rs. {p.total?.toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-400 truncate max-w-[200px]">{p.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-4">Add Wholesale Supplier</h3>
            <form onSubmit={handleAddSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lahore Hafeez Centre Wholesalers"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0321-1234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Market Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Shop #12, 2nd Floor, Hafeez Centre, Lahore"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Save Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
