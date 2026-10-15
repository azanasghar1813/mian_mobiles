-- Mian Mobiles POS & Inventory System Schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  track_imei INTEGER NOT NULL DEFAULT 0, -- 1 for Phones, 0 for Accessories
  default_warranty_days INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  cost_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0, -- Only for accessories (non-IMEI)
  min_stock INTEGER NOT NULL DEFAULT 3,
  warranty_days INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phone_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  imei1 TEXT UNIQUE NOT NULL,
  imei2 TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'sold', 'returned', 'damaged')),
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  sale_item_id INTEGER,
  notes TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sold_at DATETIME
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL NOT NULL DEFAULT 0, -- positive means we owe supplier
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_no TEXT,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL DEFAULT 1,
  cost REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL NOT NULL DEFAULT 0, -- positive means customer owes shop (udhar)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone TEXT DEFAULT '--------------',
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cashier_name TEXT,
  counter TEXT DEFAULT 'Counter 1',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash', -- 'Cash', 'Online', 'Mixed', 'Credit'
  status TEXT NOT NULL DEFAULT 'PAID' CHECK(status IN ('PAID', 'PARTIAL', 'CREDIT', 'VOID')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  phone_unit_id INTEGER REFERENCES phone_units(id) ON DELETE SET NULL,
  imei1 TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  cost_snapshot REAL NOT NULL DEFAULT 0, -- cost at the moment of sale for profit tracking
  discount REAL NOT NULL DEFAULT 0,
  warranty_until TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL, -- 'Cash', 'Online (Easypaisa)', 'Online (JazzCash)', 'Bank Transfer'
  amount REAL NOT NULL DEFAULT 0,
  reference_no TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS held_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT DEFAULT 'Walk-in Customer',
  cart_json TEXT NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  bill_no TEXT NOT NULL,
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  refund_type TEXT NOT NULL DEFAULT 'cash' CHECK(refund_type IN ('cash', 'credit', 'exchange')),
  total_refund REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  phone_unit_id INTEGER REFERENCES phone_units(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  refund_amount REAL NOT NULL DEFAULT 0,
  item_condition TEXT NOT NULL DEFAULT 'restock' -- 'restock', 'damaged'
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_type TEXT NOT NULL CHECK(party_type IN ('customer', 'supplier')),
  party_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
  amount REAL NOT NULL DEFAULT 0,
  ref TEXT,
  description TEXT,
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  phone_unit_id INTEGER REFERENCES phone_units(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('purchase', 'sale', 'return', 'adjust', 'damage')),
  qty INTEGER NOT NULL DEFAULT 0, -- positive or negative
  ref TEXT,
  user TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_phone_units_imei1 ON phone_units(imei1);
CREATE INDEX IF NOT EXISTS idx_phone_units_status ON phone_units(status);
CREATE INDEX IF NOT EXISTS idx_sales_bill_no ON sales(bill_no);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
