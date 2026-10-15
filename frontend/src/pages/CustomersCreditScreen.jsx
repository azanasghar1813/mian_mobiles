import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  DollarSign,
  History,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';

export default function CustomersCreditScreen({ user }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNote, setPayNote] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get(`/customers?search=${encodeURIComponent(search)}`);
      setCustomers(res.customers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    try {
      const res = await api.get(`/customers/${cust.id}/ledger`);
      setLedgerData(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    try {
      await api.post('/customers', {
        name: newCustName.trim(),
        phone: newCustPhone.trim() || null,
        address: newCustAddress.trim() || null
      });
      playSuccessChime();
      setShowAddModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      fetchCustomers();
    } catch (err) {
      alert(err.message || 'Failed to add customer');
    }
  };

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) return;

    try {
      await api.post(`/customers/${selectedCustomer.id}/payment`, {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        note: payNote
      });
      playSuccessChime();
      alert('Payment recorded successfully!');
      setShowPayModal(false);
      setPayAmount('');
      setPayNote('');
      fetchCustomers();
      handleSelectCustomer(selectedCustomer);
    } catch (err) {
      playErrorBuzzer();
      alert(err.message || 'Failed to record payment');
    }
  };

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full gap-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Customer Accounts & Credit (Udhar)</h2>
            <p className="text-xs text-slate-400">Track credit accounts, customer ledgers, and record payment recoveries</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Credit Due</span>
            <div className="text-base font-black font-mono text-rose-400">
              Rs. {totalOutstanding.toLocaleString()}
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Customer List (Left) + Detailed Ledger (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Customer Directory (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col min-h-[450px]">
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {customers.map(c => {
              const isSelected = selectedCustomer?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/60 shadow-md'
                      : 'bg-slate-950 border-slate-800/80 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{c.name}</span>
                    <span className={`font-mono font-bold text-xs ${
                      c.balance > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      Rs. {c.balance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{c.phone || 'No phone'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ledger & Payment View (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col min-h-[450px]">
          {selectedCustomer ? (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-extrabold text-lg text-white">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-400">
                    Phone: {selectedCustomer.phone || '—'} • Address: {selectedCustomer.address || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Balance Due</span>
                    <div className="text-lg font-black font-mono text-rose-400">
                      Rs. {selectedCustomer.balance.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Receive Payment (Wasooli)</span>
                  </button>
                </div>
              </div>

              {/* Ledger Entries Table */}
              <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference / Bill #</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Debit (Added)</th>
                      <th className="p-3 text-right">Credit (Paid)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {ledgerData?.ledger && ledgerData.ledger.length > 0 ? (
                      ledgerData.ledger.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-800/30">
                          <td className="p-3 text-slate-400 font-mono">{entry.date}</td>
                          <td className="p-3 font-mono text-emerald-400 font-semibold">{entry.ref || '—'}</td>
                          <td className="p-3 text-slate-200">{entry.description}</td>
                          <td className="p-3 text-right font-mono font-bold text-rose-400">
                            {entry.type === 'debit' ? `Rs. ${entry.amount.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {entry.type === 'credit' ? `Rs. ${entry.amount.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500">
                          No ledger transactions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
              <Users className="w-12 h-12 stroke-1 mb-2 text-slate-600" />
              <span>Select a customer from the left list to view their ledger</span>
            </div>
          )}
        </div>
      </div>

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-4">Add New Customer</h3>
            <form onSubmit={handleAddCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Address / Shop</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="e.g. Goal Market, Chowk Azam"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Save Customer
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

      {/* RECEIVE PAYMENT MODAL */}
      {showPayModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-1">Receive Credit Payment</h3>
            <p className="text-xs text-emerald-400 mb-4">{selectedCustomer.name}</p>

            <form onSubmit={handleReceivePayment} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Amount Received (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-950 border-2 border-emerald-500/60 rounded-xl px-3 py-2.5 text-white font-mono font-bold text-base focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online (Easypaisa)">Online (Easypaisa)</option>
                  <option value="Online (JazzCash)">Online (JazzCash)</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Received partial cash at shop counter"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Record Payment & Update Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs"
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
