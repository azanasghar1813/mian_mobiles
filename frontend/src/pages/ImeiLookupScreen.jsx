import React, { useState, useRef } from 'react';
import {
  SearchCode,
  Scan,
  Smartphone,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  User,
  Phone,
  FileText,
  Clock,
  Plus,
  MessageSquare
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';

export default function ImeiLookupScreen({ user }) {
  const [imeiQuery, setImeiQuery] = useState('');
  const [unitDetails, setUnitDetails] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const clean = imeiQuery.trim();
    if (!clean) return;

    setLoading(true);
    setErrorMsg('');
    setUnitDetails(null);

    try {
      const res = await api.get(`/phone-units/lookup/${clean}`);
      playScanBeep();
      setUnitDetails(res.unit);
    } catch (err) {
      playErrorBuzzer();
      setErrorMsg(err.message || 'No phone found with this IMEI');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !unitDetails) return;

    try {
      const res = await api.post(`/phone-units/${unitDetails.id}/note`, {
        note: newNote.trim()
      });
      playSuccessChime();
      setUnitDetails(prev => ({ ...prev, notes: res.notes }));
      setNewNote('');
    } catch (err) {
      alert(err.message || 'Failed to add note');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-4xl mx-auto w-full gap-4">
      {/* Header & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <SearchCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">IMEI & Warranty Lifecycle Lookup</h2>
            <p className="text-xs text-slate-400">Scan or type phone IMEI to check status, customer bill, and remaining warranty</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Scan className="w-5 h-5 absolute left-3.5 top-3.5 text-emerald-400" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={imeiQuery}
              onChange={(e) => setImeiQuery(e.target.value)}
              placeholder="Scan or type 15-digit IMEI number..."
              className="w-full bg-slate-950 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl pl-11 pr-4 py-3 font-mono font-bold text-white text-base focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition-colors cursor-pointer"
          >
            {loading ? 'Searching...' : 'Search IMEI'}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Unit Details Display Card */}
      {unitDetails && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in">
          {/* Top Row: Model & Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-emerald-400">
                <Smartphone className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-white">{unitDetails.product_name}</h3>
                <p className="text-xs text-slate-400">{unitDetails.brand} • {unitDetails.model}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wide ${
                unitDetails.status === 'in_stock' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                unitDetails.status === 'sold' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                STATUS: {unitDetails.status.replace('_', ' ')}
              </span>

              {unitDetails.warrantyStatus === 'VALID' && (
                <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-500 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                  <ShieldCheck className="w-4 h-4" />
                  <span>WARRANTY VALID ({unitDetails.daysRemaining} days left)</span>
                </span>
              )}

              {unitDetails.warrantyStatus === 'EXPIRED' && (
                <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>WARRANTY EXPIRED</span>
                </span>
              )}
            </div>
          </div>

          {/* Grid: Purchase Info vs Sale Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase & Device Meta */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Device & Intake Info
              </span>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">IMEI 1:</span>
                <span className="text-white font-bold">{unitDetails.imei1}</span>
              </div>
              {unitDetails.imei2 && (
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">IMEI 2:</span>
                  <span className="text-slate-300">{unitDetails.imei2}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Added Date:</span>
                <span className="text-slate-300">{new Date(unitDetails.added_at).toLocaleDateString('en-PK')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="text-slate-300">{unitDetails.supplier_name || 'Direct / Stock-in'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Retail Price:</span>
                <span className="text-emerald-400 font-bold">Rs. {unitDetails.sale_price?.toLocaleString()}</span>
              </div>
            </div>

            {/* Sale & Warranty Meta */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Sale & Customer Info
              </span>
              {unitDetails.bill_no ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice #:</span>
                    <span className="text-emerald-400 font-mono font-bold">{unitDetails.bill_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sale Date:</span>
                    <span className="text-slate-300">{new Date(unitDetails.sale_date).toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="text-white font-semibold">{unitDetails.customer_name}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Customer Phone:</span>
                    <span className="text-slate-300">{unitDetails.customer_phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Warranty Until:</span>
                    <span className="text-amber-400 font-mono font-bold">{unitDetails.warranty_until || 'No Warranty'}</span>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-slate-500">
                  This unit has not been sold yet. It is currently in shop stock.
                </div>
              )}
            </div>
          </div>

          {/* Warranty Claim & Service Notes Log */}
          <div className="pt-2 space-y-3">
            <span className="font-bold text-sm text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Warranty Claims & Service Notes</span>
            </span>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 min-h-[70px] text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
              {unitDetails.notes || 'No notes logged for this phone unit.'}
            </div>

            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log a warranty claim or service note (e.g. Sent for warranty replacement on 16/10)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Note</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
