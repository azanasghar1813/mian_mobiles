import React, { useState, useEffect, useRef } from 'react';
import {
  PlusCircle,
  Barcode,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Edit2,
  Printer,
  Boxes,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';
import { playScanBeep, playErrorBuzzer, playSuccessChime } from '../utils/audio';
import JsBarcode from 'jsbarcode';

export default function AddProductScreen({ user }) {
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'list'
  const [categories, setCategories] = useState([]);
  
  // Add Product Form State
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [minStock, setMinStock] = useState('3');
  const [warrantyDays, setWarrantyDays] = useState('0');

  // Existing Product Alert (when barcode is already registered)
  const [existingProduct, setExistingProduct] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  // Product List & Edit State
  const [products, setProducts] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);

  // Barcode Label Print Modal
  const [printLabelProduct, setPrintLabelProduct] = useState(null);
  const labelBarcodeRef = useRef(null);
  const barcodeInputRef = useRef(null);

  // Load Categories on mount
  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  // Auto-focus barcode input
  useEffect(() => {
    if (activeTab === 'add') {
      barcodeInputRef.current?.focus();
    }
  }, [activeTab]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.categories || []);
      if (res.categories && res.categories.length > 0 && !categoryId) {
        setCategoryId(res.categories[0].id);
        setWarrantyDays(res.categories[0].default_warranty_days || 0);
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.products || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  // When category changes, auto-set default warranty days
  const handleCategoryChange = (catId) => {
    setCategoryId(catId);
    const cat = categories.find(c => c.id === parseInt(catId));
    if (cat) {
      setWarrantyDays(cat.default_warranty_days || 0);
    }
  };

  const selectedCategory = categories.find(c => c.id === parseInt(categoryId));
  const isPhoneCategory = selectedCategory?.track_imei === 1;

  // Check barcode on scanner input (or blur / enter)
  const handleBarcodeChange = async (val) => {
    setBarcode(val);
    const clean = val.trim();
    if (clean.length >= 4) {
      try {
        const res = await api.get(`/products/check-barcode/${clean}`);
        if (res.exists) {
          playScanBeep();
          setExistingProduct(res.product);
        } else {
          setExistingProduct(null);
        }
      } catch (e) {
        // Ignore
      }
    } else {
      setExistingProduct(null);
    }
  };

  // Generate Unique Code128 Barcode
  const handleGenerateBarcode = async () => {
    try {
      const res = await api.get('/products/generate-barcode');
      setBarcode(res.barcode);
      setExistingProduct(null);
      playScanBeep();
    } catch (e) {
      alert('Failed to generate barcode');
    }
  };

  // Save Product (and Next)
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!barcode.trim()) {
      alert('Please enter or scan a barcode');
      return;
    }
    if (!name.trim()) {
      alert('Please enter a product name');
      return;
    }
    if (!categoryId) {
      alert('Please select a category');
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      await api.post('/products', {
        barcode: barcode.trim(),
        name: name.trim(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        category_id: parseInt(categoryId),
        cost_price: parseFloat(costPrice) || 0,
        sale_price: parseFloat(salePrice) || 0,
        stock_qty: isPhoneCategory ? 0 : (parseInt(stockQty) || 0),
        min_stock: parseInt(minStock) || 3,
        warranty_days: parseInt(warrantyDays) || 0
      });

      playSuccessChime();
      setFeedback({
        type: 'success',
        text: `Successfully added "${name.trim()}"! Ready for next product.`
      });

      // Rapid entry flow: Clear product fields, keep the category selected, refocus barcode!
      setBarcode('');
      setName('');
      setBrand('');
      setModel('');
      setCostPrice('');
      setSalePrice('');
      setStockQty('0');
      setExistingProduct(null);
      fetchProducts();

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);

    } catch (err) {
      playErrorBuzzer();
      setFeedback({ type: 'error', text: err.message || 'Failed to save product' });
    } finally {
      setLoading(false);
    }
  };

  // Render Barcode label when printing modal opens
  useEffect(() => {
    if (printLabelProduct && labelBarcodeRef.current) {
      try {
        JsBarcode(labelBarcodeRef.current, printLabelProduct.barcode, {
          format: 'CODE128',
          width: 2,
          height: 48,
          displayValue: true,
          fontSize: 12,
          font: 'JetBrains Mono',
          textMargin: 2
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [printLabelProduct]);

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full gap-4">
      {/* Top Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Product Catalog & Add Product</h2>
            <p className="text-xs text-slate-400">Rapid barcode scanning flow with Code128 generation</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'add'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product (Scanner Flow)</span>
          </button>
          <button
            onClick={() => { setActiveTab('list'); fetchProducts(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'list'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Product List ({products.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADD PRODUCT RAPID SCANNER FLOW */}
      {activeTab === 'add' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {feedback && (
              <div className={`p-4 mb-5 rounded-xl text-xs font-bold flex items-center justify-between ${
                feedback.type === 'error'
                  ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
              }`}>
                <span>{feedback.text}</span>
                <button onClick={() => setFeedback(null)}>✕</button>
              </div>
            )}

            {/* Existing Product Alert Banner */}
            {existingProduct && (
              <div className="mb-5 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-bold text-amber-300 text-sm">
                      Already Added: {existingProduct.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Barcode: <span className="font-mono text-white">{existingProduct.barcode}</span> •
                      Price: <span className="text-emerald-400 font-bold">Rs. {existingProduct.sale_price.toLocaleString()}</span> •
                      Stock: <span className="text-white font-bold">{existingProduct.current_stock}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(existingProduct);
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Edit Product
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Barcode & Code128 Generator */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  1. Barcode (Auto-Focused for Scanner)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-5 h-5 absolute left-3 top-3 text-emerald-400" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcode}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      placeholder="Scan product barcode here..."
                      className="w-full bg-slate-950 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold text-white focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-700 transition-colors"
                    title="Generate unique 12-digit Code128 barcode"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Generate Barcode</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Category Selector (Retained across entries) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  2. Category (Remembers selection for next product)
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.track_imei ? '📱 (Tracked by IMEI)' : '📦 (Tracked by Quantity)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: Product Name, Brand, Model */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Techno Spark 50c (4GB/128GB)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Tecno / Samsung / Infinix"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Spark 50c / R-540"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 4: Cost Price, Sale Price, Min Stock, Warranty */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Cost Price (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                    Sale Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border-2 border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Warranty Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(e.target.value)}
                    placeholder="365"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 5: Stock Quantity (Only for accessories) */}
              {!isPhoneCategory ? (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Opening Stock Quantity (Accessories)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                  <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Mobile Phones are tracked by IMEI.</strong> After saving this model, receive units by scanning IMEIs in the <strong>"Stock In / IMEI"</strong> tab.
                  </span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <Save className="w-5 h-5" />
                  <span>{loading ? 'Saving...' : 'SAVE & NEXT PRODUCT'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Guide Card (1 col) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-sm mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Shop Rapid Entry Guide</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-2.5 leading-relaxed">
                <li>• <strong>Scan & Save:</strong> The cursor stays in the barcode box so you can add 20 items in a row without touching the mouse.</li>
                <li>• <strong>No Barcode on item?</strong> Click <em>"Generate Barcode"</em> and print a sticker label directly.</li>
                <li>• <strong>Mobile Phones:</strong> Mark them under "Mobile Phones" category. Individual stock is tracked per IMEI.</li>
                <li>• <strong>Accessories:</strong> Tracked by total quantity. Opening stock updates immediately.</li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
              <span className="text-xs text-slate-500">Total products in system</span>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {products.length} Items
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT LIST & SEARCH */}
      {activeTab === 'list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search by name, brand, model, barcode..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Barcode</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Sale Price</th>
                  <th className="p-3 text-center">Stock</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products
                  .filter(p => {
                    const matchSearch = !searchFilter ||
                      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                      p.barcode.includes(searchFilter) ||
                      (p.brand && p.brand.toLowerCase().includes(searchFilter.toLowerCase()));
                    const matchCat = !categoryFilter || p.category_id === parseInt(categoryFilter);
                    return matchSearch && matchCat;
                  })
                  .map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-300">{p.barcode}</td>
                      <td className="p-3 font-bold text-white">
                        {p.name}
                        {p.brand && <span className="text-[10px] text-slate-400 font-normal ml-1">({p.brand})</span>}
                      </td>
                      <td className="p-3 text-slate-400">{p.category_name}</td>
                      <td className="p-3 text-right font-mono text-slate-400">Rs. {p.cost_price.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">Rs. {p.sale_price.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold font-mono text-xs ${
                          p.current_stock <= p.min_stock
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {p.current_stock}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPrintLabelProduct(p)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded"
                            title="Print Barcode Label"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingProduct(p)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-lg text-white mb-4">Edit Product</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Barcode</label>
                <input
                  type="text"
                  value={editingProduct.barcode}
                  onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono mt-1"
                />
              </div>
              <div>
                <label className="text-slate-400">Name</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    value={editingProduct.cost_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-emerald-400 font-bold">Sale Price (Rs.)</label>
                  <input
                    type="number"
                    value={editingProduct.sale_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await api.put(`/products/${editingProduct.id}`, editingProduct);
                    playSuccessChime();
                    setEditingProduct(null);
                    fetchProducts();
                  } catch (e) {
                    alert(e.message || 'Failed to update');
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT BARCODE LABEL MODAL */}
      {printLabelProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center">
            <h3 className="font-bold text-base text-white mb-1">Barcode Sticker Preview</h3>
            <p className="text-xs text-slate-400 mb-4">Print on thermal label or sticker paper</p>

            {/* Sticker Preview Box */}
            <div className="bg-white p-4 rounded-xl text-black text-center border-2 border-slate-700 shadow-xl w-full">
              <div className="text-[11px] font-black tracking-wide truncate">
                MIAN MOBILES
              </div>
              <div className="text-[10px] font-bold text-slate-800 truncate mt-0.5">
                {printLabelProduct.name}
              </div>
              <div className="my-2 flex justify-center">
                <svg ref={labelBarcodeRef} className="max-w-full"></svg>
              </div>
              <div className="text-xs font-black">
                Price: Rs. {printLabelProduct.sale_price.toLocaleString()}
              </div>
            </div>

            <div className="mt-5 flex gap-2 w-full">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Sticker
              </button>
              <button
                onClick={() => setPrintLabelProduct(null)}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
