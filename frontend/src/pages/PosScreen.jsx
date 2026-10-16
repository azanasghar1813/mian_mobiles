import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Search,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  Pause,
  Play,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Phone,
  Tag,
  DollarSign,
  Receipt as ReceiptIcon,
  Check
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';
import Receipt from '../components/Receipt';

export default function PosScreen({ user, counterName }) {
  const [cart, setCart] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Auto format Pakistani mobile numbers: 0300-0000000
  const formatPhoneNumber = (value) => {
    let raw = value.replace(/\D/g, '');
    if (raw.startsWith('92') && raw.length > 10) {
      raw = '0' + raw.slice(2);
    }
    raw = raw.slice(0, 11);
    if (raw.length > 4) {
      return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    }
    return raw;
  };

  const handlePhoneChange = (e) => {
    setCustomerPhone(formatPhoneNumber(e.target.value));
  };
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash', 'Online', 'Mixed', 'Credit'
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [currentBillNo, setCurrentBillNo] = useState('');

  const fetchNextBillNo = async () => {
    try {
      const res = await api.get('/sales/next-bill-no');
      if (res && res.nextBillNo) {
        setCurrentBillNo(res.nextBillNo);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchNextBillNo();
  }, []);
  
  // Modals
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showImeiPicker, setShowImeiPicker] = useState(false);
  const [selectedProductForImei, setSelectedProductForImei] = useState(null);
  const [availableImeis, setAvailableImeis] = useState([]);
  const [imeiFilter, setImeiFilter] = useState('');
  
  // Held Bills
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [heldBills, setHeldBills] = useState([]);

  // Completed Sale Receipt for Printing
  const [completedSale, setCompletedSale] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const scanInputRef = useRef(null);

  // Keep scan input focused
  useEffect(() => {
    if (!showSearchModal && !showImeiPicker && !showHeldModal && !showReceiptModal) {
      scanInputRef.current?.focus();
    }
  }, [showSearchModal, showImeiPicker, showHeldModal, showReceiptModal]);

  // Global Keyboard Shortcuts (F2: Search, F4: Pay & Print, F8: Hold, F9: Held Bills)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setShowSearchModal(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handlePayAndPrint();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === 'F9') {
        e.preventDefault();
        fetchHeldBills();
      } else if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowImeiPicker(false);
        setShowHeldModal(false);
        setShowReceiptModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentMethod, discountAmount, cashAmount, onlineAmount, customerName, customerPhone]);

  // Handle Barcode or IMEI scan
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const query = scanInput.trim();
    if (!query) return;

    setScanInput('');

    try {
      // 1. First, check if scanned input matches a phone IMEI directly
      try {
        const imeiRes = await api.get(`/phone-units/lookup/${query}`);
        if (imeiRes && imeiRes.unit) {
          if (imeiRes.unit.status !== 'in_stock') {
            playErrorBuzzer();
            setFeedbackMsg({
              type: 'error',
              text: `This IMEI is already ${imeiRes.unit.status.toUpperCase()}! Cannot sell.`
            });
            return;
          }

          // Check if already in cart
          const alreadyInCart = cart.some(item => item.imei1 === imeiRes.unit.imei1);
          if (alreadyInCart) {
            playErrorBuzzer();
            setFeedbackMsg({ type: 'error', text: `IMEI ${imeiRes.unit.imei1} is already in the cart!` });
            return;
          }

          // Add phone unit to cart
          playScanBeep();
          setCart(prev => [
            ...prev,
            {
              product_id: imeiRes.unit.product_id,
              name: imeiRes.unit.product_name,
              brand: imeiRes.unit.brand,
              model: imeiRes.unit.model,
              track_imei: 1,
              phone_unit_id: imeiRes.unit.id,
              imei1: imeiRes.unit.imei1,
              imei2: imeiRes.unit.imei2,
              price: imeiRes.unit.sale_price,
              cost_price: imeiRes.unit.cost_price,
              warranty_days: imeiRes.unit.warranty_days,
              qty: 1,
              discount: 0
            }
          ]);
          setFeedbackMsg({ type: 'success', text: `Added phone: ${imeiRes.unit.product_name} (IMEI: ${imeiRes.unit.imei1})` });
          return;
        }
      } catch (err) {
        // Not a direct IMEI, proceed to product barcode lookup
      }

      // 2. Check if scanned input matches a product barcode
      const prodCheck = await api.get(`/products/check-barcode/${query}`);
      if (prodCheck && prodCheck.exists) {
        const prod = prodCheck.product;

        if (prod.track_imei === 1) {
          // It's a phone model box barcode! Open IMEI picker so cashier can scan or select specific IMEI
          playScanBeep();
          openImeiPickerForProduct(prod);
        } else {
          // It's an accessory: increment quantity or add new item
          playScanBeep();
          setCart(prev => {
            const existingIndex = prev.findIndex(item => item.product_id === prod.id && !item.track_imei);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex].qty += 1;
              return updated;
            } else {
              return [
                ...prev,
                {
                  product_id: prod.id,
                  name: prod.name,
                  brand: prod.brand,
                  model: prod.model,
                  track_imei: 0,
                  price: prod.sale_price,
                  cost_price: prod.cost_price,
                  warranty_days: prod.warranty_days,
                  qty: 1,
                  discount: 0
                }
              ];
            }
          });
          setFeedbackMsg({ type: 'success', text: `Added: ${prod.name}` });
        }
        return;
      }

      // 3. Fallback: Search by name
      const searchRes = await api.get(`/products?search=${encodeURIComponent(query)}`);
      if (searchRes.products && searchRes.products.length > 0) {
        setSearchResults(searchRes.products);
        setSearchQuery(query);
        setShowSearchModal(true);
      } else {
        playErrorBuzzer();
        setFeedbackMsg({ type: 'error', text: `No product or IMEI found for: "${query}"` });
      }
    } catch (err) {
      playErrorBuzzer();
      setFeedbackMsg({ type: 'error', text: err.message || 'Error scanning item' });
    }
  };

  const openImeiPickerForProduct = async (product) => {
    try {
      const res = await api.get(`/phone-units/product/${product.id}`);
      setSelectedProductForImei(product);
      setAvailableImeis(res.units || []);
      setImeiFilter('');
      setShowImeiPicker(true);
    } catch (e) {
      playErrorBuzzer();
      alert('Could not fetch in-stock IMEIs for this product');
    }
  };

  const addPhoneUnitToCart = (product, unit) => {
    // Check if already in cart
    if (cart.some(item => item.phone_unit_id === unit.id)) {
      playErrorBuzzer();
      alert('This IMEI is already in your cart!');
      return;
    }

    playScanBeep();
    setCart(prev => [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        track_imei: 1,
        phone_unit_id: unit.id,
        imei1: unit.imei1,
        imei2: unit.ime2,
        price: product.sale_price,
        cost_price: product.cost_price,
        warranty_days: product.warranty_days,
        qty: 1,
        discount: 0
      }
    ]);
    setShowImeiPicker(false);
    setFeedbackMsg({ type: 'success', text: `Added phone: ${product.name} (IMEI: ${unit.imei1})` });
  };

  const addAccessoryToCart = (product) => {
    playScanBeep();
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product_id === product.id && !item.track_imei);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].qty += 1;
        return updated;
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            brand: product.brand,
            model: product.model,
            track_imei: 0,
            price: product.sale_price,
            cost_price: product.cost_price,
            warranty_days: product.warranty_days,
            qty: 1,
            discount: 0
          }
        ];
      }
    });
    setShowSearchModal(false);
    setFeedbackMsg({ type: 'success', text: `Added: ${product.name}` });
  };

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty) - (item.discount || 0), 0);
  const discountVal = parseFloat(discountAmount) || 0;
  const total = Math.max(0, subtotal - discountVal);

  // Cart item modifiers
  const updateQty = (index, delta) => {
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (item.track_imei === 1) {
        // Phones are always qty 1 per IMEI
        return updated;
      }
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        item.qty = newQty;
      }
      return updated;
    });
  };

  const removeItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length > 0 && window.confirm('Clear current sale?')) {
      setCart([]);
      setDiscountAmount(0);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setFeedbackMsg(null);
    }
  };

  // Hold Bill
  const handleHoldBill = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Nothing to hold.');
      return;
    }

    try {
      await api.post('/sales/hold', {
        cart,
        customer_name: customerName.trim() || 'Guest',
        note: notes
      });
      playSuccessChime();
      alert('Bill held successfully! Press F9 to resume anytime.');
      setCart([]);
      setDiscountAmount(0);
      setNotes('');
    } catch (e) {
      alert(e.message || 'Failed to hold bill');
    }
  };

  // Fetch Held Bills
  const fetchHeldBills = async () => {
    try {
      const res = await api.get('/sales/held/list');
      setHeldBills(res.heldBills || []);
      setShowHeldModal(true);
    } catch (e) {
      alert('Could not fetch held bills');
    }
  };

  const resumeHeldBill = async (bill) => {
    try {
      const parsedCart = JSON.parse(bill.cart_json);
      setCart(parsedCart);
      setCustomerName(bill.customer_name === 'Guest' || bill.customer_name === 'Walk-in Customer' ? '' : (bill.customer_name || ''));
      setNotes(bill.note || '');
      await api.delete(`/sales/held/${bill.id}`);
      setShowHeldModal(false);
      playSuccessChime();
    } catch (e) {
      alert('Failed to resume bill');
    }
  };

  // One-Click Pay & Print
  const handlePayAndPrint = async () => {
    if (cart.length === 0) {
      playErrorBuzzer();
      alert('Cart is empty. Scan an item first!');
      return;
    }

    setIsProcessing(true);

    try {
      let paidAmt = total;
      let paymentsList = [];

      if (paymentMethod === 'Cash') {
        paidAmt = total;
        paymentsList = [{ method: 'Cash', amount: total }];
      } else if (paymentMethod === 'Online') {
        paidAmt = total;
        paymentsList = [{ method: 'Online (Easypaisa/JazzCash)', amount: total }];
      } else if (paymentMethod === 'Mixed') {
        const cashPart = parseFloat(cashAmount) || 0;
        const onlinePart = parseFloat(onlineAmount) || 0;
        paidAmt = cashPart + onlinePart;
        paymentsList = [
          { method: 'Cash', amount: cashPart },
          { method: 'Online', amount: onlinePart }
        ];
      } else if (paymentMethod === 'Credit') {
        paidAmt = 0; // Unpaid / Udhar
        paymentsList = [];
      }

      const payload = {
        customer_name: customerName.trim() || 'Guest',
        customer_phone: customerPhone.trim() || '--------------',
        items: cart.map(item => ({
          product_id: item.product_id,
          phone_unit_id: item.phone_unit_id || null,
          imei1: item.imei1 || null,
          qty: item.qty,
          price: item.price,
          discount: item.discount || 0
        })),
        subtotal,
        discount: discountVal,
        tax: 0,
        total,
        paid: paidAmt,
        payment_method: paymentMethod,
        payments: paymentsList,
        notes,
        counter: counterName
      };

      const res = await api.post('/sales', payload);

      playSuccessChime();
      setCompletedSale(res.sale);
      setShowReceiptModal(true);

      // Reset cart ready for next customer
      setCart([]);
      setDiscountAmount(0);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setCashAmount('');
      setOnlineAmount('');
      fetchNextBillNo();

      // Auto trigger print after brief render delay
      setTimeout(() => {
        window.print();
      }, 350);

    } catch (err) {
      playErrorBuzzer();
      alert(`Sale Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-3.5 p-3.5 max-w-[1600px] mx-auto w-full lg:h-[calc(100vh-86px)] min-h-0">
      {/* LEFT COLUMN: Scan Banner, Cart Table, Shortcuts (Width: ~65%) */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 h-full">
        {/* Fast Scanner Input Banner */}
        <form onSubmit={handleScanSubmit} className="relative shrink-0">
          <div className="flex items-center gap-2.5 bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-2 shadow-sm pos-search-box focus-within:border-emerald-500 transition-all">
            <div className="p-2.5 bg-[#079669] text-white rounded-xl font-bold flex items-center justify-center shrink-0">
              <Scan className="w-5 h-5 stroke-[2.2]" />
            </div>
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="SCAN BARCODE OR PHONE IMEI (or type & press Enter)..."
              className="pos-scan-input flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 font-mono font-medium text-sm md:text-base focus:outline-none px-2 border-0 outline-none shadow-none ring-0"
            />
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="px-4 py-2 bg-[#079669] hover:bg-[#06835B] text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search (F2)</span>
            </button>
          </div>
        </form>

        {/* Feedback Alert Bar */}
        {feedbackMsg && (
          <div className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between shrink-0 transition-all animate-in fade-in ${
            feedbackMsg.type === 'error' ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
          }`}>
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* Cart Items Table */}
        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl min-h-[300px] pos-card">
          {/* Table Header */}
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider pos-table-header shrink-0">
            <div className="w-8 text-center shrink-0">#</div>
            <div className="flex-1 min-w-0">Item Details</div>
            <div className="w-28 text-center shrink-0">Quantity</div>
            <div className="w-28 text-right shrink-0">Unit Price</div>
            <div className="w-28 text-right shrink-0">Total Amount</div>
            <div className="w-14 text-center shrink-0">Action</div>
          </div>

          {/* Table Body (Scrolls inside its own card) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[220px]">
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="21" r="1"/>
                      <circle cx="19" cy="21" r="1"/>
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                    </svg>
                  </div>
                  {/* Motion indicator accents */}
                  <div className="absolute -top-1 -right-1 w-2.5 h-1 bg-emerald-400 rounded-full rotate-45" />
                  <div className="absolute top-2 -left-2 w-2 h-1 bg-emerald-400 rounded-full -rotate-45" />
                  <div className="absolute -bottom-1 left-2 w-2 h-1 bg-emerald-400 rounded-full -rotate-12" />
                </div>
                <p className="font-bold text-base text-slate-200">Cart is Empty</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">Scan any barcode or phone IMEI to start selling</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
                  <div className="w-8 text-center font-mono text-xs text-slate-400 shrink-0 font-bold">{idx + 1}</div>
                  {/* Name, Brand & IMEI Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-100 text-sm truncate">{item.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.brand && (
                        <span className="text-[11px] text-slate-400 font-medium">{item.brand}</span>
                      )}
                      {item.track_imei === 1 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold">
                          <Smartphone className="w-3 h-3" />
                          IMEI: {item.imei1}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Accessory</span>
                      )}
                      {item.warranty_days > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                          {item.warranty_days}d War.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="w-28 flex items-center justify-center shrink-0">
                    {item.track_imei === 1 ? (
                      <span className="font-mono font-bold text-slate-300 text-sm">1 unit</span>
                    ) : (
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 qty-stepper">
                        <button
                          type="button"
                          onClick={() => updateQty(idx, -1)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs text-white">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(idx, 1)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Unit Price */}
                  <div className="w-28 text-right font-mono text-xs md:text-sm text-slate-300 shrink-0">
                    Rs. {item.price.toLocaleString()}
                  </div>

                  {/* Line Total */}
                  <div className="w-28 text-right font-mono font-bold text-xs md:text-sm text-emerald-400 pos-total-amount shrink-0">
                    Rs. {((item.price * item.qty) - (item.discount || 0)).toLocaleString()}
                  </div>

                  {/* Delete */}
                  <div className="w-14 text-center shrink-0">
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 pos-footer-bar shrink-0 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-300">Quick Shortcuts:</span>
              <button onClick={() => setShowSearchModal(true)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md pos-shortcut-badge hover:text-emerald-500 cursor-pointer text-[11px] font-semibold">
                <kbd className="font-mono font-bold">F2</kbd> Search
              </button>
              <button onClick={handleHoldBill} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md pos-shortcut-badge hover:text-amber-500 cursor-pointer text-[11px] font-semibold">
                <kbd className="font-mono font-bold">F8</kbd> Hold Bill
              </button>
              <button onClick={fetchHeldBills} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md pos-shortcut-badge hover:text-blue-500 cursor-pointer text-[11px] font-semibold">
                <kbd className="font-mono font-bold">F9</kbd> Resume Bill
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span>Items in cart: <strong className="text-white font-mono font-bold">{cart.length}</strong></span>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-rose-400 hover:text-rose-500 text-xs font-bold cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Customer, Payment, Summary & Pay & Print Button (Width: ~35%) */}
      <div className="w-full lg:w-[400px] flex flex-col gap-3 shrink-0 lg:h-full justify-between min-h-0">
        {/* Customer Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-xl pos-card shrink-0">
          <div className="flex items-center justify-between mb-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-slate-200">
              <User className="w-3.5 h-3.5 text-emerald-500" />
              CUSTOMER DETAILS
            </span>
            {currentBillNo && (
              <span className="font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md tracking-wider">
                INV: {currentBillNo}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
              />
              {customerName && (
                <button
                  type="button"
                  onClick={() => setCustomerName('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={customerPhone}
                onChange={handlePhoneChange}
                placeholder="0300-0000000"
                maxLength={12}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500 font-medium"
              />
              {customerPhone && (
                <button
                  type="button"
                  onClick={() => setCustomerPhone('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-xl pos-card shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider mb-2.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
            PAYMENT METHOD
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'Cash', label: 'Cash', icon: Banknote },
              { id: 'Online', label: 'Online / Bank', icon: Smartphone },
              { id: 'Mixed', label: 'Split / Mixed', icon: CreditCard },
              { id: 'Credit', label: 'Credit (Udhar)', icon: Tag }
            ].map(m => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer pos-payment-btn ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md is-selected'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{m.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Mixed payment split inputs */}
          {paymentMethod === 'Mixed' && (
            <div className="mt-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-14 shrink-0">Cash:</span>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="Cash Rs."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-14 shrink-0">Online:</span>
                <input
                  type="number"
                  value={onlineAmount}
                  onChange={(e) => setOnlineAmount(e.target.value)}
                  placeholder="Online Rs."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bill Totals Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-2.5 pos-card shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-1.5">
            <span className="font-semibold text-slate-400">Current Invoice</span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs tracking-wider">
              {currentBillNo || 'INV-0005'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs md:text-sm text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono font-bold text-slate-200">Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-xs md:text-sm text-slate-400">
            <span>Discount (Rs.)</span>
            <input
              type="number"
              min="0"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0"
              className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-right text-xs md:text-sm font-mono text-white focus:outline-none focus:border-emerald-500 font-bold"
            />
          </div>

          <div className="border-t border-slate-800 pt-2 flex items-baseline justify-between">
            <span className="text-base font-extrabold text-slate-200">TOTAL</span>
            <span className="text-2xl font-black font-mono text-emerald-500 pos-total-amount">
              Rs. {total.toLocaleString()}
            </span>
          </div>

          {/* Optional notes */}
          <div className="relative flex items-center">
            <ReceiptIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sale note / reference (optional)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-slate-700"
            />
          </div>

          {/* ONE-CLICK PAY & PRINT BUTTON (PINNED & PROMINENT) */}
          <button
            onClick={handlePayAndPrint}
            disabled={isProcessing || cart.length === 0}
            className="w-full py-3.5 mt-1 bg-[#079669] hover:bg-[#06835B] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-lg text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer pos-pay-print-btn"
          >
            <Printer className="w-5 h-5 stroke-[2.5]" />
            <span>PAY & PRINT (F4)</span>
          </button>
        </div>
      </div>

      {/* SEARCH PRODUCTS MODAL (F2) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-white">Search Products / Accessories</h3>
              </div>
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-4 border-b border-slate-800">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={async (e) => {
                  setSearchQuery(e.target.value);
                  const res = await api.get(`/products?search=${encodeURIComponent(e.target.value)}`);
                  setSearchResults(res.products || []);
                }}
                placeholder="Type name, brand, or model..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No products found. Start typing above to search.
                </div>
              ) : (
                searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (p.track_imei === 1) {
                        openImeiPickerForProduct(p);
                        setShowSearchModal(false);
                      } else {
                        addAccessoryToCart(p);
                      }
                    }}
                    className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-xs text-slate-400">
                        {p.brand} {p.model} • Stock: <span className="font-bold text-emerald-400">{p.current_stock}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400 text-sm">Rs. {p.sale_price.toLocaleString()}</div>
                      <span className="text-[10px] text-slate-500 uppercase">{p.track_imei ? 'Phone (IMEI)' : 'Accessory'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SELECT IMEI MODAL FOR PHONES */}
      {showImeiPicker && selectedProductForImei && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Select Phone IMEI</h3>
                <p className="text-xs text-emerald-400">{selectedProductForImei.name}</p>
              </div>
              <button onClick={() => setShowImeiPicker(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const matched = availableImeis.filter(u => 
                  u.imei1.includes(imeiFilter.trim()) || (u.imei2 && u.imei2.includes(imeiFilter.trim()))
                );
                if (matched.length > 0) {
                  addPhoneUnitToCart(selectedProductForImei, matched[0]);
                } else {
                  playErrorBuzzer();
                  alert(`No matching IMEI found for "${imeiFilter}"`);
                }
              }}
              className="p-3 border-b border-slate-800"
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5 uppercase">
                <span>Step 2: Scan Specific IMEI for this Phone</span>
                <span className="text-emerald-400 font-mono">{availableImeis.length} in stock</span>
              </div>
              <input
                autoFocus
                type="text"
                value={imeiFilter}
                onChange={(e) => setImeiFilter(e.target.value)}
                placeholder="Scan phone IMEI with barcode scanner (Press Enter)..."
                className="w-full bg-slate-950 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl px-3.5 py-2 text-xs text-white font-mono font-bold focus:outline-none"
              />
            </form>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableImeis.length === 0 ? (
                <div className="text-center py-8 text-rose-400 text-xs font-semibold">
                  No in-stock phone units found for this model. Receive stock in the "Stock In" tab first!
                </div>
              ) : (
                availableImeis
                  .filter(u => u.imei1.includes(imeiFilter) || (u.imei2 && u.imei2.includes(imeiFilter)))
                  .map(unit => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => addPhoneUnitToCart(selectedProductForImei, unit)}
                      className="w-full p-3 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex items-center justify-between text-left transition-all"
                    >
                      <div>
                        <div className="font-mono font-bold text-sm text-emerald-400">IMEI: {unit.imei1}</div>
                        {unit.imei2 && <div className="font-mono text-xs text-slate-400">IMEI 2: {unit.imei2}</div>}
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg">
                        Select
                      </span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* HELD BILLS MODAL (F9) */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Held Bills ({heldBills.length})</h3>
              <button onClick={() => setShowHeldModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {heldBills.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No held bills found.</div>
              ) : (
                heldBills.map(b => (
                  <div key={b.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{b.customer_name}</div>
                      <div className="text-xs text-slate-400">
                        Held by {b.cashier_name} • {new Date(b.created_at).toLocaleTimeString('en-PK')}
                      </div>
                      {b.note && <div className="text-xs text-amber-400 mt-1">Note: {b.note}</div>}
                    </div>
                    <button
                      onClick={() => resumeHeldBill(b)}
                      className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      Resume
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINTED RECEIPT MODAL PREVIEW & DIALOG */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col items-center">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg mb-2">
              <CheckCircle2 className="w-6 h-6" />
              <span>Sale Complete!</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Receipt generated. If printer did not open, click Print below.</p>

            {/* Receipt Preview */}
            <div className="w-full flex justify-center items-center py-4 bg-slate-950/80 rounded-xl border border-slate-800 max-h-[65vh] overflow-y-auto">
              <Receipt sale={completedSale} isPreview={true} />
            </div>

            <div className="flex gap-3 w-full mt-5">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm"
              >
                Next Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Hidden Printable Receipt for browser print */}
      <Receipt sale={completedSale} isPreview={false} />
    </div>
  );
}
