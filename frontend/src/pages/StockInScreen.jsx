import React, { useState, useEffect, useRef } from 'react';
import {
  PackageCheck,
  Smartphone,
  Layers,
  Plus,
  Trash2,
  Scan,
  CheckCircle2,
  AlertCircle,
  Truck,
  Hash,
  Save,
  Barcode,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';

export default function StockInScreen({ user }) {
  const [activeTab, setActiveTab] = useState('phones'); // 'phones' or 'accessories'
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);

  // Phones Tab State
  const [boxBarcode, setBoxBarcode] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [showNewModelForm, setShowNewModelForm] = useState(false);
  
  // Quick New Phone Model Form State
  const [newModelName, setNewModelName] = useState('');
  const [newBrand, setNewBrand] = useState('Tecno');
  const [newModelCode, setNewModelCode] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newWarrantyDays, setNewWarrantyDays] = useState('365');

  // IMEI Scanning State
  const [imeiInput1, setImeiInput1] = useState('');
  const [imeiInput2, setImeiInput2] = useState('');
  const [imeiList, setImeiList] = useState([]); // array of { imei1, imei2 }
  
  // Optional Purchase Meta
  const [phoneSupplierId, setPhoneSupplierId] = useState('');
  const [phoneInvoiceNo, setPhoneInvoiceNo] = useState('');
  const [phoneUnitCost, setPhoneUnitCost] = useState('');

  // Accessories Tab State
  const [selectedAccId, setSelectedAccId] = useState('');
  const [accQty, setAccQty] = useState('1');
  const [accCost, setAccCost] = useState('');
  const [accSupplierId, setAccSupplierId] = useState('');
  const [accInvoiceNo, setAccInvoiceNo] = useState('');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const boxBarcodeRef = useRef(null);
  const imeiInput1Ref = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'phones') {
      if (!selectedPhone) {
        boxBarcodeRef.current?.focus();
      } else {
        imeiInput1Ref.current?.focus();
      }
    }
  }, [activeTab, selectedPhone]);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.products || []);
      const phoneProds = (res.products || []).filter(p => p.track_imei === 1);
      if (phoneProds.length > 0 && !selectedPhone) {
        setSelectedPhone(phoneProds[0]);
        setPhoneUnitCost(phoneProds[0].cost_price);
      }
      const accProds = (res.products || []).filter(p => p.track_imei === 0);
      if (accProds.length > 0 && !selectedAccId) {
        setSelectedAccId(accProds[0].id);
        setAccCost(accProds[0].cost_price);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.suppliers || []);
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

  // Step 1: Scan Box Barcode
  const handleScanBoxBarcode = async (e) => {
    if (e) e.preventDefault();
    const barcode = boxBarcode.trim();
    if (!barcode) return;

    try {
      const checkRes = await api.get(`/products/check-barcode/${barcode}`);
      if (checkRes && checkRes.exists) {
        const prod = checkRes.product;
        if (prod.track_imei === 1) {
          playScanBeep();
          setSelectedPhone(prod);
          setPhoneUnitCost(prod.cost_price);
          setShowNewModelForm(false);
          setStatusMsg({
            type: 'success',
            text: `Step 1 & 2 Complete: Found "${prod.name}". Now scan each phone's IMEI below.`
          });
          setTimeout(() => imeiInput1Ref.current?.focus(), 100);
        } else {
          playErrorBuzzer();
          alert(`Barcode ${barcode} belongs to an accessory ("${prod.name}"), not a mobile phone.`);
        }
      } else {
        // Model not found in database! Open quick creation form
        playErrorBuzzer();
        setShowNewModelForm(true);
        setNewModelName('');
        setNewModelCode('');
        setNewCostPrice('');
        setNewSalePrice('');
        setStatusMsg({
          type: 'info',
          text: `Box barcode "${barcode}" is not yet registered. Enter phone model details once below.`
        });
      }
    } catch (err) {
      alert('Error checking box barcode');
    }
  };

  // Step 2: Quick Register New Phone Model
  const handleCreateNewModel = async (e) => {
    e.preventDefault();
    if (!newModelName.trim()) {
      alert('Please enter model name (e.g. TECNO Spark 50C)');
      return;
    }

    // Find Mobile Phones category
    const phoneCat = categories.find(c => c.track_imei === 1) || categories[0];
    if (!phoneCat) {
      alert('Mobile phones category not found');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/products', {
        barcode: boxBarcode.trim(),
        name: newModelName.trim(),
        brand: newBrand.trim(),
        model: newModelCode.trim() || newModelName.trim(),
        category_id: phoneCat.id,
        cost_price: parseFloat(newCostPrice) || 0,
        sale_price: parseFloat(newSalePrice) || 0,
        stock_qty: 0,
        warranty_days: parseInt(newWarrantyDays) || 365
      });

      playSuccessChime();
      const newProd = {
        id: res.id,
        name: newModelName.trim(),
        brand: newBrand.trim(),
        model: newModelCode.trim() || newModelName.trim(),
        cost_price: parseFloat(newCostPrice) || 0,
        sale_price: parseFloat(newSalePrice) || 0,
        barcode: boxBarcode.trim(),
        track_imei: 1,
        current_stock: 0
      };

      setSelectedPhone(newProd);
      setPhoneUnitCost(newCostPrice || 0);
      setShowNewModelForm(false);
      fetchProducts();
      setStatusMsg({
        type: 'success',
        text: `Model "${newModelName.trim()}" registered! Now scan each phone's IMEI in Step 3.`
      });
      setTimeout(() => imeiInput1Ref.current?.focus(), 100);
    } catch (err) {
      alert(err.message || 'Failed to register model');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Add IMEI to staging list
  const handleAddImei = async (e) => {
    if (e) e.preventDefault();
    const clean1 = imeiInput1.trim();
    const clean2 = imeiInput2.trim();

    if (!clean1) return;

    // Check duplicate in current staging queue
    if (imeiList.some(item => item.imei1 === clean1)) {
      playErrorBuzzer();
      alert(`IMEI ${clean1} is already in the queue below!`);
      return;
    }

    // Check if IMEI already exists in database
    try {
      const lookup = await api.get(`/phone-units/lookup/${clean1}`);
      if (lookup && lookup.unit) {
        playErrorBuzzer();
        alert(`IMEI ${clean1} is already registered in the system (Status: ${lookup.unit.status.toUpperCase()})`);
        return;
      }
    } catch (err) {
      // 404 is expected for new IMEIs
    }

    playScanBeep();
    setImeiList(prev => [...prev, { imei1: clean1, imei2: clean2 || null }]);
    setImeiInput1('');
    setImeiInput2('');
    imeiInput1Ref.current?.focus();
  };

  const removeImei = (idx) => {
    setImeiList(prev => prev.filter((_, i) => i !== idx));
  };

  // Step 4: Save All Phone Units to Stock
  const handleSavePhones = async () => {
    if (!selectedPhone) {
      alert('Please select or scan a phone model first');
      return;
    }
    if (imeiList.length === 0) {
      alert('Please scan at least one phone IMEI first');
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      await api.post('/phone-units/receive', {
        product_id: selectedPhone.id,
        imeis: imeiList,
        supplier_id: phoneSupplierId ? parseInt(phoneSupplierId) : null,
        purchase_invoice: phoneInvoiceNo || null,
        unit_cost: parseFloat(phoneUnitCost) || selectedPhone.cost_price
      });

      playSuccessChime();
      setStatusMsg({
        type: 'success',
        text: `Success! Added ${imeiList.length} individual phone unit(s) under "${selectedPhone.name}".`
      });
      setImeiList([]);
      setBoxBarcode('');
      fetchProducts();
    } catch (err) {
      playErrorBuzzer();
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save phones' });
    } finally {
      setLoading(false);
    }
  };

  // Accessory Stock Save
  const handleSaveAccessories = async (e) => {
    e.preventDefault();
    if (!selectedAccId) {
      alert('Please select an accessory product');
      return;
    }
    const qty = parseInt(accQty);
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      const cost = parseFloat(accCost) || 0;
      await api.post('/suppliers/purchases', {
        supplier_id: accSupplierId ? parseInt(accSupplierId) : null,
        invoice_no: accInvoiceNo || null,
        items: [{ product_id: parseInt(selectedAccId), qty, cost }],
        total: cost * qty,
        paid: cost * qty
      });

      playSuccessChime();
      setStatusMsg({
        type: 'success',
        text: `Successfully added ${qty} units to accessory stock!`
      });
      setAccQty('1');
      setAccInvoiceNo('');
      fetchProducts();
    } catch (err) {
      playErrorBuzzer();
      setStatusMsg({ type: 'error', text: err.message || 'Failed to receive accessories' });
    } finally {
      setLoading(false);
    }
  };

  const phoneProducts = products.filter(p => p.track_imei === 1);
  const accProducts = products.filter(p => p.track_imei === 0);

  return (
    <div className="flex-1 flex flex-col p-4 max-w-6xl mx-auto w-full gap-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Stock In / Mobile Phone Intake</h2>
            <p className="text-xs text-slate-400">Step-by-step box scan, model creation, and individual IMEI tracking</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setActiveTab('phones'); setStatusMsg(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'phones'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile Phone Intake (Box + IMEI)</span>
          </button>
          <button
            onClick={() => { setActiveTab('accessories'); setStatusMsg(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'accessories'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Accessories Intake (Quantity)</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between ${
          statusMsg.type === 'error'
            ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
            : statusMsg.type === 'info'
            ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
            : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
        }`}>
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)}>✕</button>
        </div>
      )}

      {/* TAB 1: EXACT 4-STEP PHONE INTAKE FLOW */}
      {activeTab === 'phones' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Wizard Form (2 cols) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            {/* STEP 1: Scan Box Barcode OR Select Model */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[11px]">1</span>
                  Step 1: Scan Mobile Box Barcode
                </span>
                {selectedPhone && (
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Selected: {selectedPhone.name}
                  </span>
                )}
              </div>

              <form onSubmit={handleScanBoxBarcode} className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-5 h-5 absolute left-3 top-2.5 text-emerald-400" />
                  <input
                    ref={boxBarcodeRef}
                    type="text"
                    value={boxBarcode}
                    onChange={(e) => setBoxBarcode(e.target.value)}
                    placeholder="Scan mobile box barcode (e.g. 890123456001)..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-3 py-2 text-sm font-mono text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Scan className="w-4 h-4" />
                  <span>Check Box</span>
                </button>
              </form>

              {/* Or Select from existing dropdown */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Or pick existing:</span>
                <select
                  value={selectedPhone?.id || ''}
                  onChange={(e) => {
                    const found = phoneProducts.find(p => p.id === parseInt(e.target.value));
                    if (found) {
                      setSelectedPhone(found);
                      setPhoneUnitCost(found.cost_price);
                      setShowNewModelForm(false);
                      setTimeout(() => imeiInput1Ref.current?.focus(), 100);
                    }
                  }}
                  className="flex-1 bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="">Select phone model...</option>
                  {phoneProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand}) — Stock: {p.current_stock}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* STEP 2: Quick Model Registration (Only shows if model not found) */}
            {showNewModelForm && (
              <form onSubmit={handleCreateNewModel} className="p-4 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-in zoom-in-95">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase">
                  <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center font-bold text-[11px]">2</span>
                  Step 2: Model Not Found — Enter Model Name Once
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Phone Model Name *</label>
                    <input
                      type="text"
                      autoFocus
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      placeholder="e.g. TECNO Spark 50C"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Brand</label>
                    <input
                      type="text"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="e.g. Tecno / Infinix / Samsung"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Purchase Cost (Rs.)</label>
                    <input
                      type="number"
                      value={newCostPrice}
                      onChange={(e) => setNewCostPrice(e.target.value)}
                      placeholder="e.g. 22000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-emerald-400 font-bold block mb-1">Retail Sale Price (Rs.)</label>
                    <input
                      type="number"
                      value={newSalePrice}
                      onChange={(e) => setNewSalePrice(e.target.value)}
                      placeholder="e.g. 24999"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewModelForm(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg shadow"
                  >
                    Save Model & Continue to Step 3
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Scan Each Phone's IMEI */}
            <div className={`p-4 rounded-2xl border transition-all ${
              selectedPhone ? 'bg-slate-950 border-emerald-500/50' : 'bg-slate-950/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[11px]">3</span>
                  Step 3: Scan Each Phone's IMEI (One by One)
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Phones Ready: <strong className="text-emerald-400 font-bold text-sm">{imeiList.length}</strong>
                </span>
              </div>

              <form onSubmit={handleAddImei} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <input
                      ref={imeiInput1Ref}
                      disabled={!selectedPhone}
                      type="text"
                      value={imeiInput1}
                      onChange={(e) => setImeiInput1(e.target.value)}
                      placeholder="Scan IMEI 1 (Press Enter to add)..."
                      className="w-full bg-slate-900 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      disabled={!selectedPhone}
                      type="text"
                      value={imeiInput2}
                      onChange={(e) => setImeiInput2(e.target.value)}
                      placeholder="Scan IMEI 2 (optional)..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedPhone || !imeiInput1}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add IMEI to Phone Queue (Enter)</span>
                  </button>
                </div>
              </form>
            </div>

            {/* STEP 4: Purchase Cost & Confirmation */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[11px]">4</span>
                Step 4: Confirm Cost & Supplier (Optional)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Purchase Cost (Rs.)</label>
                  <input
                    type="number"
                    value={phoneUnitCost}
                    onChange={(e) => setPhoneUnitCost(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Supplier</label>
                  <select
                    value={phoneSupplierId}
                    onChange={(e) => setPhoneSupplierId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">Direct / None</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={phoneInvoiceNo}
                    onChange={(e) => setPhoneInvoiceNo(e.target.value)}
                    placeholder="e.g. WH-1092"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              {/* Final Confirm Button */}
              <button
                onClick={handleSavePhones}
                disabled={loading || imeiList.length === 0}
                className="w-full py-4 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Save className="w-5 h-5 stroke-[2.5]" />
                <span>
                  CONFIRM & REGISTER {imeiList.length} PHONES UNDER {selectedPhone ? `"${selectedPhone.name}"` : 'MODEL'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Scanned Phone Units Queue (1 col) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider block">
                  Scanned Phones Queue
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold truncate max-w-[200px] block">
                  {selectedPhone ? selectedPhone.name : 'No model selected'}
                </span>
              </div>
              {imeiList.length > 0 && (
                <button
                  onClick={() => setImeiList([])}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 my-2">
              {imeiList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-12">
                  <Smartphone className="w-12 h-12 stroke-1 mb-2 text-slate-600 animate-pulse" />
                  <span className="font-semibold text-slate-400">Queue is Empty</span>
                  <span className="text-[10px] text-slate-500 mt-1">Scan Phone 1, Phone 2, Phone 3 IMEIs above</span>
                </div>
              ) : (
                imeiList.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-xs text-emerald-400">
                        Unit #{idx + 1} — IMEI: {item.imei1}
                      </div>
                      {item.imei2 && (
                        <div className="font-mono text-[10px] text-slate-400">
                          IMEI 2: {item.imei2}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeImei(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span>Total Phones in Batch:</span>
              <strong className="text-emerald-400 font-mono text-base font-black">{imeiList.length} Units</strong>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCESSORIES (QUANTITY TRACKED) */}
      {activeTab === 'accessories' && (
        <form onSubmit={handleSaveAccessories} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-2xl mx-auto w-full space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Select Accessory Product *
            </label>
            <select
              value={selectedAccId}
              onChange={(e) => {
                setSelectedAccId(e.target.value);
                const p = products.find(prod => prod.id === parseInt(e.target.value));
                if (p) setAccCost(p.cost_price);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
            >
              {accProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brand}) — Current Stock: {p.current_stock}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Quantity Received *
              </label>
              <input
                type="number"
                min="1"
                value={accQty}
                onChange={(e) => setAccQty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Unit Cost (Rs.)
              </label>
              <input
                type="number"
                min="0"
                value={accCost}
                onChange={(e) => setAccCost(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Supplier (Optional)
              </label>
              <select
                value={accSupplierId}
                onChange={(e) => setAccSupplierId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                <option value="">Direct Purchase</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Purchase Invoice # (Optional)
              </label>
              <input
                type="text"
                value={accInvoiceNo}
                onChange={(e) => setAccInvoiceNo(e.target.value)}
                placeholder="e.g. INV-ACC-101"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? 'Receiving...' : 'ADD TO ACCESSORY STOCK'}</span>
          </button>
        </form>
      )}
    </div>
  );
}
