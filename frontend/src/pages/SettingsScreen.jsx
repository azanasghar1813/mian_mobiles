import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Receipt,
  ShieldCheck,
  Database,
  Wifi,
  Users,
  Save,
  Download,
  Upload,
  KeyRound,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { api } from '../api';
import { playSuccessChime } from '../utils/audio';

export default function SettingsScreen({ user }) {
  const [activeTab, setActiveTab] = useState('shop'); // 'shop', 'lan', 'users', 'backup', 'permissions'
  const [settings, setSettings] = useState({});
  const [lanInfo, setLanInfo] = useState(null);
  const [usersList, setUsersList] = useState([]);

  // User creation modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState('cashier');

  // Restore file
  const [restoreFile, setRestoreFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchLanInfo();
    fetchUsers();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.settings || {});
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLanInfo = async () => {
    try {
      const res = await api.get('/settings/lan-info');
      setLanInfo(res);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsersList(res.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      await api.put('/settings', { settings });
      playSuccessChime();
      setStatusMsg({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('mian_mobiles_token');
    window.location.href = `/api/settings/backup?token=${token}`;
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      alert('Please select a .db backup file to restore');
      return;
    }
    if (!window.confirm('WARNING: Restoring will overwrite current database records. Continue?')) {
      return;
    }

    const formData = new FormData();
    formData.append('backup_file', restoreFile);

    const token = localStorage.getItem('mian_mobiles_token');
    setLoading(true);

    try {
      const res = await fetch('/api/settings/restore', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');

      playSuccessChime();
      alert('Database restored successfully! Refreshing page...');
      window.location.reload();
    } catch (err) {
      alert(err.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUsername.trim() || !newUserPin.trim()) return;

    try {
      await api.post('/auth/users', {
        name: newUserName.trim(),
        username: newUsername.trim(),
        pin: newUserPin.trim(),
        role: newUserRole
      });
      playSuccessChime();
      setShowAddUser(false);
      setNewUserName('');
      setNewUsername('');
      setNewUserPin('');
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to create user');
    }
  };

  const updateSettingField = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-6xl mx-auto w-full gap-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">System Settings & Shop Configuration</h2>
            <p className="text-xs text-slate-400">Configure receipt formatting, LAN networking, user accounts, and backups</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'shop', label: 'Shop Profile', icon: Store },
            { id: 'lan', label: 'LAN Networking', icon: Wifi },
            { id: 'users', label: 'Staff PINs', icon: Users },
            { id: 'backup', label: 'Backup & Safety', icon: Database }
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setActiveTab(t.id); setStatusMsg(null); }}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between ${
          statusMsg.type === 'error'
            ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
        }`}>
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)}>✕</button>
        </div>
      )}

      {/* TAB 1: SHOP & RECEIPT SETTINGS */}
      {activeTab === 'shop' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Shop Name *
              </label>
              <input
                type="text"
                value={settings.shop_name || ''}
                onChange={(e) => updateSettingField('shop_name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Shop Slogan / Tagline
              </label>
              <input
                type="text"
                value={settings.shop_tagline || ''}
                onChange={(e) => updateSettingField('shop_tagline', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Shop Address (Shown on 80mm Receipt)
            </label>
            <textarea
              rows="2"
              value={settings.shop_address || ''}
              onChange={(e) => updateSettingField('shop_address', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={settings.shop_phone || ''}
                onChange={(e) => updateSettingField('shop_phone', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={settings.invoice_prefix || 'INV-'}
                onChange={(e) => updateSettingField('invoice_prefix', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Cashier Max Discount Limit (%)
              </label>
              <input
                type="number"
                value={settings.cashier_discount_limit || '10'}
                onChange={(e) => updateSettingField('cashier_discount_limit', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-white"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Shop Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: LAN NETWORKING (COUNTER 2 & MOBILE ACCESS) */}
      {activeTab === 'lan' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="font-bold text-white text-base">Shop LAN Multi-Counter Setup</h3>
            <p className="text-xs text-slate-400 mt-1">
              Antigravity offline-first architecture allows Counter 1 to act as the central database server. Counter 2 or mobile phones on the shop LAN connect directly to these URLs:
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {lanInfo?.lanUrls?.map((net, idx) => (
              <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Network Interface: {net.interface}
                  </span>
                  <div className="text-lg font-mono font-bold text-white mt-1">
                    {net.url}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(net.url);
                    alert(`Copied ${net.url} to clipboard!`);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Address</span>
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 space-y-2 mt-4">
            <div className="font-bold text-emerald-400 text-sm">How to Connect Counter 2 (Step-by-Step):</div>
            <div>1. Open Google Chrome or Microsoft Edge on Counter 2.</div>
            <div>2. Type <strong className="text-white font-mono">{lanInfo?.primaryUrl}</strong> in the address bar and press Enter.</div>
            <div>3. In the top navbar on PC 2, select <strong>"Counter 2"</strong> from the dropdown.</div>
            <div>4. PC 2 can now sell, scan, and print locally to its own printer. Real-time stock stays synchronized automatically!</div>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF & CASHIER PINS */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base">Staff Accounts & PINs</h3>
              <p className="text-xs text-slate-400">Cashiers log in at the counter using their 4-digit PIN</p>
            </div>
            <button
              onClick={() => setShowAddUser(true)}
              className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">PIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-white">{u.name}</td>
                    <td className="p-3 font-mono text-slate-400">{u.username}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-emerald-400 font-bold">Active</span>
                    </td>
                    <td className="p-3 text-center font-mono text-slate-400">
                      ••••
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Download Backup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Download Backup</h3>
                  <p className="text-xs text-slate-400">1-Click export of the entire shop database</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                SQLite stores all shop data in a single file (<code className="text-slate-300">mian_mobiles.db</code>).
                Click below to download an exact copy to a USB drive or your PC.
              </p>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="mt-6 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Database File (.db)</span>
            </button>
          </div>

          {/* Restore Backup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Restore from Backup</h3>
                  <p className="text-xs text-slate-400">Restore database from a saved backup file</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Select a previous <code className="text-slate-300">.db</code> file to restore your products, sales, and accounts. A safety copy of your current database will be saved before restoring.
              </p>
              <input
                type="file"
                accept=".db"
                onChange={(e) => setRestoreFile(e.target.files[0])}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
              />
            </div>

            <button
              onClick={handleRestoreSubmit}
              disabled={loading || !restoreFile}
              className="mt-6 w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Restore Database</span>
            </button>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-white mb-4">Add Staff Member</h3>
            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Asad Ali (Cashier 2)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. asad"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">4-Digit Login PIN *</label>
                <input
                  type="password"
                  maxLength="4"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  placeholder="e.g. 5555"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="cashier">Cashier (POS & Sales only)</option>
                  <option value="admin">Admin / Owner (Full access & Reports)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Create Staff Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
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
