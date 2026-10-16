import React, { useState, useEffect } from 'react';
import { api, setToken, setCurrentUser } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';
import { Lock, User, KeyRound, ShieldCheck, X } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [tab, setTab] = useState('pin'); // 'pin' or 'credentials'
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinDigit = (digit) => {
    if (loading) return;
    if (pin.length < 4) {
      playScanBeep();
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        handlePinSubmit(null, nextPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
  };

  const handlePinSubmit = async (e, pinToSubmit) => {
    if (e) e.preventDefault();
    const activePin = pinToSubmit !== undefined ? pinToSubmit : pin;
    if (!activePin || activePin.length < 4 || loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { pin: activePin });
      setToken(res.token);
      setCurrentUser(res.user);
      playSuccessChime();
      setPin('');
      onLoginSuccess(res.user);
    } catch (err) {
      playErrorBuzzer();
      setError(err.message || 'Incorrect PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Enable physical keyboard input (Numpad, number row, Backspace, Enter, Esc)
  useEffect(() => {
    if (!isOpen || tab !== 'pin') return;

    const handleKeyDown = (e) => {
      // Don't intercept if an actual input element is focused
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlePinBackspace();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handlePinClear();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (pin.length > 0) {
          handlePinClear();
        } else if (onClose) {
          onClose();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) {
          handlePinSubmit(null, pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tab, pin, loading, onClose]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      setToken(res.token);
      setCurrentUser(res.user);
      playSuccessChime();
      setUsername('');
      setPassword('');
      onLoginSuccess(res.user);
    } catch (err) {
      playErrorBuzzer();
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Mian Mobiles POS</h3>
              <p className="text-xs text-emerald-100">Quick Cashier Switch / Login</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1">
          <button
            onClick={() => { setTab('pin'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              tab === 'pin' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Quick PIN Pad
          </button>
          <button
            onClick={() => { setTab('credentials'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              tab === 'credentials' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Username & Password
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {/* PIN Pad View */}
        {tab === 'pin' && (
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-xs text-slate-400 mb-1">Enter Cashier (0000) or Admin (1234) PIN</p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[11px] text-emerald-400 font-medium mb-3 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Keyboard & Numpad Active
              </div>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                      pin.length > idx
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-105'
                        : 'border-slate-800 bg-slate-950/60 text-slate-600'
                    }`}
                  >
                    {pin.length > idx ? '●' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(num)}
                  className="h-14 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-xl font-bold text-slate-100 rounded-xl border border-slate-700/50 transition-all flex items-center justify-center shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinClear}
                className="h-14 bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 rounded-xl border border-slate-700/30 transition-all"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit(0)}
                className="h-14 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-xl font-bold text-slate-100 rounded-xl border border-slate-700/50 transition-all flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinBackspace}
                className="h-14 bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 rounded-xl border border-slate-700/30 transition-all"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={handlePinSubmit}
              disabled={loading || pin.length < 4}
              className="mt-6 w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-sm"
            >
              {loading ? 'Authenticating...' : 'Unlock POS Counter'}
            </button>
          </div>
        )}

        {/* Username & Password View */}
        {tab === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or cashier"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-sm mt-2"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
