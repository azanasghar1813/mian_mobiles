import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import PosScreen from './pages/PosScreen';
import AddProductScreen from './pages/AddProductScreen';
import StockInScreen from './pages/StockInScreen';
import InventoryScreen from './pages/InventoryScreen';
import SalesHistoryScreen from './pages/SalesHistoryScreen';
import ImeiLookupScreen from './pages/ImeiLookupScreen';
import CustomersCreditScreen from './pages/CustomersCreditScreen';
import SuppliersPurchasesScreen from './pages/SuppliersPurchasesScreen';
import ReportsDashboardScreen from './pages/ReportsDashboardScreen';
import SettingsScreen from './pages/SettingsScreen';
import { getCurrentUser, setToken, setCurrentUser } from './api';

export default function App() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [showLoginModal, setShowLoginModal] = useState(!user);
  const [currentView, setCurrentView] = useState('pos');
  const [counterName, setCounterName] = useState(() => {
    return localStorage.getItem('mian_mobiles_counter') || 'Counter 1 (Server)';
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('mian_mobiles_theme') || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('mian_mobiles_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSetCounter = (name) => {
    setCounterName(name);
    localStorage.setItem('mian_mobiles_counter', name);
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setShowLoginModal(false);
  };

  const handleSwitchUser = () => {
    setShowLoginModal(true);
  };

  // Global F1 shortcut to switch straight to POS screen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentView('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        onSwitchUser={handleSwitchUser}
        counterName={counterName}
        setCounterName={handleSetCounter}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {currentView === 'pos' && (
          <PosScreen user={user} counterName={counterName} />
        )}
        {currentView === 'add-product' && (
          <AddProductScreen user={user} />
        )}
        {currentView === 'stock-in' && (
          <StockInScreen user={user} />
        )}
        {currentView === 'inventory' && (
          <InventoryScreen user={user} />
        )}
        {currentView === 'sales-history' && (
          <SalesHistoryScreen user={user} />
        )}
        {currentView === 'imei-lookup' && (
          <ImeiLookupScreen user={user} />
        )}
        {currentView === 'customers' && (
          <CustomersCreditScreen user={user} />
        )}
        {currentView === 'suppliers' && (
          <SuppliersPurchasesScreen user={user} />
        )}
        {currentView === 'dashboard' && (
          <ReportsDashboardScreen user={user} />
        )}
        {currentView === 'settings' && (
          <SettingsScreen user={user} />
        )}
      </main>

      {/* Quick Cashier Login & Switch Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={user ? () => setShowLoginModal(false) : null}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
