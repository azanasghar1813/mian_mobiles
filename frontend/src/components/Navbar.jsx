import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  PlusCircle,
  PackageCheck,
  Boxes,
  ReceiptText,
  SearchCode,
  Users,
  Truck,
  BarChart3,
  Settings,
  Wifi,
  LogOut,
  UserCheck,
  Clock,
  Laptop
} from 'lucide-react';
import { api } from '../api';

export default function Navbar({
  currentView,
  setCurrentView,
  user,
  onSwitchUser,
  counterName,
  setCounterName
}) {
  const [lanInfo, setLanInfo] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLanModal, setShowLanModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get('/settings/lan-info')
      .then(res => setLanInfo(res))
      .catch(() => {});
  }, []);

  const navItems = [
    { id: 'pos', label: 'POS / Sale', icon: ShoppingCart, hotkey: 'F1' },
    { id: 'add-product', label: 'Add Product', icon: PlusCircle },
    { id: 'stock-in', label: 'Stock In / IMEI', icon: PackageCheck },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'sales-history', label: 'Sales & Receipts', icon: ReceiptText },
    { id: 'imei-lookup', label: 'IMEI Warranty', icon: SearchCode },
    { id: 'customers', label: 'Credit / Udhar', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    ...(user?.role === 'admin' ? [
      { id: 'dashboard', label: 'Reports & Profit', icon: BarChart3 },
      { id: 'settings', label: 'Settings', icon: Settings }
    ] : [])
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 select-none shadow-lg">
      {/* Top Banner Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          {/* Shop Logo & Name */}
          <div className="flex items-center gap-2 text-white font-extrabold tracking-wide">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
              <path d="M11 18h2" />
              <path d="M2 13a10 10 0 0 0 10 9" />
              <path d="M22 11a10 10 0 0 0-10-9" />
            </svg>
            <span className="text-base text-emerald-400 font-black">MIAN MOBILES</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-normal">| Mobile Phones & Accessories</span>
          </div>

          {/* Counter Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={counterName}
              onChange={(e) => setCounterName(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Counter 1 (Server)" className="bg-slate-900">Counter 1 (Server)</option>
              <option value="Counter 2 (LAN)" className="bg-slate-900">Counter 2 (LAN)</option>
            </select>
          </div>
        </div>

        {/* Right Info: LAN IP, Live Clock, Cashier User Badge */}
        <div className="flex items-center gap-4">
          {/* LAN Connection helper */}
          <button
            onClick={() => setShowLanModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
            title="Click to view Counter 2 LAN IP connection info"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] font-medium">LAN: {lanInfo?.lanUrls?.[0]?.ip || 'Online'}</span>
          </button>

          {/* Clock */}
          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {currentTime.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>

          {/* User Info */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">{user?.name || user?.username}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                user?.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {user?.role}
              </span>
            </div>

            <button
              onClick={onSwitchUser}
              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-slate-400 transition-colors"
              title="Switch Cashier / Lock Counter"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <nav className="px-3 flex items-center gap-1 overflow-x-auto py-1.5 no-scrollbar bg-slate-900/60">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.hotkey && (
                <span className={`text-[10px] px-1 rounded ${
                  isActive ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.hotkey}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* LAN Setup Dialog Modal */}
      {showLanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Connect Counter 2 or Mobile</h3>
                  <p className="text-xs text-slate-400">Both PCs must be on the same shop Wi-Fi / LAN</p>
                </div>
              </div>
              <button
                onClick={() => setShowLanModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-300">
                To use <strong className="text-white">Counter 2</strong> or view live sales on your phone inside the shop, open this URL in any browser:
              </p>

              {lanInfo?.lanUrls?.map((net, i) => (
                <div key={i} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-400 font-bold uppercase">{net.interface}</span>
                    <div className="text-base font-mono font-bold text-white tracking-wide">{net.url}</div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(net.url);
                      alert('Copied URL to clipboard!');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg"
                  >
                    Copy
                  </button>
                </div>
              ))}

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-xs text-emerald-300 space-y-1">
                <div className="font-bold text-emerald-400">Counter 2 Setup Tips:</div>
                <div>• PC 1 runs this server. Keep PC 1 powered on.</div>
                <div>• PC 2 has no database setup needed — it accesses live data via the URL above.</div>
                <div>• Both counters share live stock and can sell simultaneously without bill number collisions.</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowLanModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
