const bcrypt = require('bcryptjs');
const db = require('./connection');

function seedDatabase() {
  const existingUsers = db.prepare('SELECT count(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    console.log('Database already seeded. Skipping initial seed.');
    return;
  }

  console.log('Seeding initial data for Mian Mobiles POS...');

  // 1. Seed Settings
  const settings = [
    { key: 'shop_name', value: 'MIAN MOBILES' },
    { key: 'shop_tagline', value: 'Mobile Phones & Accessories' },
    { key: 'shop_address', value: 'Goal Market, Layyah Road,\nWard No. 1, Chowk Azam 31450, Pakistan' },
    { key: 'shop_phone', value: '+92 302 8764613' },
    { key: 'receipt_header_msg', value: 'Mobile Phones & Accessories' },
    { key: 'receipt_footer_title', value: 'Thank You for Shopping with\nMIAN MOBILES!' },
    { key: 'receipt_footer_subtitle', value: '— Your Trust Is Our Priority —' },
    { key: 'receipt_powered_by', value: '— Powered by Mian Mobiles —' },
    { key: 'invoice_prefix', value: 'INV-' },
    { key: 'tax_enabled', value: '0' },
    { key: 'tax_rate', value: '0' },
    { key: 'credit_module_enabled', value: '1' },
    { key: 'cashier_discount_limit', value: '10' },
    { key: 'cashier_can_edit_products', value: '0' },
    { key: 'paper_width', value: '80mm' },
    { key: 'currency', value: 'Rs.' }
  ];

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const s of settings) {
    insertSetting.run(s.key, s.value);
  }

  // 2. Seed Users
  // Admin PIN: 1234, Cashier PIN: 0000
  const salt = bcrypt.genSaltSync(10);
  const adminPinHash = bcrypt.hashSync('1234', salt);
  const adminPassHash = bcrypt.hashSync('admin123', salt);
  const cashierPinHash = bcrypt.hashSync('0000', salt);
  const cashierPassHash = bcrypt.hashSync('cashier123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (name, username, pin_hash, password_hash, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const adminUser = insertUser.run('Owner (Admin)', 'admin', adminPinHash, adminPassHash, 'admin');
  const cashierUser = insertUser.run('Cashier 1', 'cashier', cashierPinHash, cashierPassHash, 'cashier');

  // 3. Seed Categories
  const categories = [
    { name: 'Mobile Phones', track_imei: 1, default_warranty_days: 365 },
    { name: 'Chargers & Adapters', track_imei: 0, default_warranty_days: 180 },
    { name: 'Handsfree & Earphones', track_imei: 0, default_warranty_days: 90 },
    { name: 'Cables', track_imei: 0, default_warranty_days: 90 },
    { name: 'Earbuds & Wireless', track_imei: 0, default_warranty_days: 180 },
    { name: 'Covers & Cases', track_imei: 0, default_warranty_days: 0 },
    { name: 'Screen Protectors & Glass', track_imei: 0, default_warranty_days: 0 },
    { name: 'Power Banks', track_imei: 0, default_warranty_days: 180 }
  ];

  const insertCat = db.prepare(`
    INSERT INTO categories (name, track_imei, default_warranty_days)
    VALUES (?, ?, ?)
  `);
  const catMap = {};
  for (const cat of categories) {
    const res = insertCat.run(cat.name, cat.track_imei, cat.default_warranty_days);
    catMap[cat.name] = res.lastInsertRowid;
  }

  // 4. Seed Products
  const products = [
    {
      barcode: '890123456001',
      name: 'Techno Spark 50c (4GB/128GB)',
      brand: 'Tecno',
      model: 'Spark 50c',
      category_id: catMap['Mobile Phones'],
      cost_price: 22000,
      sale_price: 24999,
      stock_qty: 0, // tracked by IMEI
      min_stock: 2,
      warranty_days: 365
    },
    {
      barcode: '890123456002',
      name: 'Infinix Note 30 (8GB/256GB)',
      brand: 'Infinix',
      model: 'Note 30',
      category_id: catMap['Mobile Phones'],
      cost_price: 39500,
      sale_price: 43999,
      stock_qty: 0,
      min_stock: 2,
      warranty_days: 365
    },
    {
      barcode: '890123456003',
      name: 'Samsung Galaxy A15 (6GB/128GB)',
      brand: 'Samsung',
      model: 'Galaxy A15',
      category_id: catMap['Mobile Phones'],
      cost_price: 48000,
      sale_price: 52999,
      stock_qty: 0,
      min_stock: 2,
      warranty_days: 365
    },
    {
      barcode: '890123456004',
      name: 'Redmi 13c (6GB/128GB)',
      brand: 'Xiaomi',
      model: 'Redmi 13c',
      category_id: catMap['Mobile Phones'],
      cost_price: 28500,
      sale_price: 31999,
      stock_qty: 0,
      min_stock: 2,
      warranty_days: 365
    },
    {
      barcode: '890123456010',
      name: 'Infinix Charger (Original)',
      brand: 'Infinix',
      model: '33W Fast Charger',
      category_id: catMap['Chargers & Adapters'],
      cost_price: 1300,
      sale_price: 2000,
      stock_qty: 44, // 45 minus 1 sold in demo invoice
      min_stock: 5,
      warranty_days: 180
    },
    {
      barcode: '890123456011',
      name: 'Mobile Hand Free (Type-C)',
      brand: 'Generic',
      model: 'Type-C Stereo',
      category_id: catMap['Handsfree & Earphones'],
      cost_price: 750,
      sale_price: 1500,
      stock_qty: 79, // 80 minus 1 sold in demo invoice
      min_stock: 10,
      warranty_days: 90
    },
    {
      barcode: '890123456012',
      name: 'Samsung 25W Type-C Adapter',
      brand: 'Samsung',
      model: 'EP-TA800',
      category_id: catMap['Chargers & Adapters'],
      cost_price: 2200,
      sale_price: 3200,
      stock_qty: 25,
      min_stock: 5,
      warranty_days: 180
    },
    {
      barcode: '890123456013',
      name: 'Ronin R-540 Fast Cable 65W',
      brand: 'Ronin',
      model: 'R-540',
      category_id: catMap['Cables'],
      cost_price: 550,
      sale_price: 950,
      stock_qty: 55,
      min_stock: 10,
      warranty_days: 90
    },
    {
      barcode: '890123456014',
      name: 'Audionic Airbud 425 TWS',
      brand: 'Audionic',
      model: 'Airbud 425',
      category_id: catMap['Earbuds & Wireless'],
      cost_price: 3500,
      sale_price: 4800,
      stock_qty: 18,
      min_stock: 3,
      warranty_days: 180
    },
    {
      barcode: '890123456015',
      name: '9D Tempered Glass Screen Protector',
      brand: 'KingKong',
      model: 'Universal 9D',
      category_id: catMap['Screen Protectors & Glass'],
      cost_price: 120,
      sale_price: 400,
      stock_qty: 140,
      min_stock: 20,
      warranty_days: 0
    },
    {
      barcode: '890123456016',
      name: 'Silicon Clear Shockproof Case',
      brand: 'Generic',
      model: 'Clear TPU',
      category_id: catMap['Covers & Cases'],
      cost_price: 180,
      sale_price: 500,
      stock_qty: 95,
      min_stock: 15,
      warranty_days: 0
    }
  ];

  const insertProd = db.prepare(`
    INSERT INTO products (barcode, name, brand, model, category_id, cost_price, sale_price, stock_qty, min_stock, warranty_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const prodMap = {};
  for (const prod of products) {
    const res = insertProd.run(
      prod.barcode,
      prod.name,
      prod.brand,
      prod.model,
      prod.category_id,
      prod.cost_price,
      prod.sale_price,
      prod.stock_qty,
      prod.min_stock,
      prod.warranty_days
    );
    prodMap[prod.barcode] = res.lastInsertRowid;
  }

  // 5. Seed Phone Units (IMEIs)
  const phoneUnits = [
    // Techno Spark 50c (Units)
    { product_id: prodMap['890123456001'], imei1: '869402061234501', imei2: '869402061234502', status: 'sold' }, // Sold in INV-0004
    { product_id: prodMap['890123456001'], imei1: '869402061234503', imei2: '869402061234504', status: 'in_stock' },
    { product_id: prodMap['890123456001'], imei1: '869402061234505', imei2: '869402061234506', status: 'in_stock' },
    { product_id: prodMap['890123456001'], imei1: '869402061234507', imei2: '869402061234508', status: 'in_stock' },

    // Infinix Note 30
    { product_id: prodMap['890123456002'], imei1: '354928091234511', imei2: '354928091234512', status: 'in_stock' },
    { product_id: prodMap['890123456002'], imei1: '354928091234513', imei2: '354928091234514', status: 'in_stock' },

    // Samsung Galaxy A15
    { product_id: prodMap['890123456003'], imei1: '358765091234521', imei2: '358765091234522', status: 'in_stock' },
    { product_id: prodMap['890123456003'], imei1: '358765091234523', imei2: '358765091234524', status: 'in_stock' },

    // Redmi 13c
    { product_id: prodMap['890123456004'], imei1: '863345091234531', imei2: '863345091234532', status: 'in_stock' },
    { product_id: prodMap['890123456004'], imei1: '863345091234533', imei2: '863345091234534', status: 'in_stock' }
  ];

  const insertUnit = db.prepare(`
    INSERT INTO phone_units (product_id, imei1, imei2, status, added_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const unitMap = {};
  for (const u of phoneUnits) {
    const res = insertUnit.run(u.product_id, u.imei1, u.imei2, u.status);
    unitMap[u.imei1] = res.lastInsertRowid;
  }

  // 6. Seed Customers
  const insertCust = db.prepare(`
    INSERT INTO customers (name, phone, address, balance)
    VALUES (?, ?, ?, ?)
  `);
  const cWalkIn = insertCust.run('Walk-in Customer', '--------------', 'Chowk Azam', 0).lastInsertRowid;
  const cBilal = insertCust.run('Muhammad Bilal', '0300-1234567', 'Layyah Road', 0).lastInsertRowid;
  const cTariq = insertCust.run('Tariq Mehmood (Credit Account)', '0312-9876543', 'Main Bazar', 4500).lastInsertRowid;

  // 7. Seed Suppliers
  const insertSupp = db.prepare(`
    INSERT INTO suppliers (name, phone, address, balance)
    VALUES (?, ?, ?, ?)
  `);
  insertSupp.run('Lahore Mobile Market Wholesalers', '0321-5554321', 'Hafeez Centre, Lahore', 0);
  insertSupp.run('Multan Accessories Distribution', '0301-7778899', 'Haram Gate, Multan', 12000);

  // 8. Seed the exact Demo Invoice INV-0004 from User's Receipt Image!
  const insertSale = db.prepare(`
    INSERT INTO sales (
      bill_no, customer_id, customer_name, customer_phone, cashier_id, cashier_name,
      counter, subtotal, discount, tax, total, paid, balance, payment_method, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const saleRes = insertSale.run(
    'INV-0004',
    cWalkIn,
    'Walk-in Customer',
    '--------------',
    cashierUser.lastInsertRowid,
    'Cashier 1',
    'Counter 1',
    28499.00,
    0.00,
    0.00,
    28499.00,
    28499.00,
    0.00,
    'Cash / Online',
    'PAID',
    '2026-10-14 10:00:00'
  );
  const saleId = saleRes.lastInsertRowid;

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, product_id, product_name, phone_unit_id, imei1, qty, price, cost_snapshot, discount, warranty_until, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Item 1: Techno Spark 50c
  const soldUnitId = unitMap['869402061234501'];
  const sItem1 = insertSaleItem.run(
    saleId,
    prodMap['890123456001'],
    'Techno Spark 50c (4GB/128GB)',
    soldUnitId,
    '869402061234501',
    1,
    24999.00,
    22000.00,
    0,
    '2027-10-14',
    '2026-10-14 10:00:00'
  );
  // Update unit status to link with sale item
  db.prepare('UPDATE phone_units SET sale_item_id = ?, sold_at = ? WHERE id = ?')
    .run(sItem1.lastInsertRowid, '2026-10-14 10:00:00', soldUnitId);

  // Item 2: Infinix Charger (Original)
  insertSaleItem.run(
    saleId,
    prodMap['890123456010'],
    'Infinix Charger (Original)',
    null,
    null,
    1,
    2000.00,
    1300.00,
    0,
    '2027-04-14',
    '2026-10-14 10:00:00'
  );

  // Item 3: Mobile Hand Free (Type-C)
  insertSaleItem.run(
    saleId,
    prodMap['890123456011'],
    'Mobile Hand Free (Type-C)',
    null,
    null,
    1,
    1500.00,
    750.00,
    0,
    '2027-01-14',
    '2026-10-14 10:00:00'
  );

  // Seed Payment record
  db.prepare(`
    INSERT INTO payments (sale_id, method, amount, reference_no, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(saleId, 'Cash / Online', 28499.00, 'DEMO-TXN-01', '2026-10-14 10:00:00');

  // Seed earlier demo sales INV-0001, INV-0002, INV-0003 for realistic reports
  const s1 = insertSale.run('INV-0001', cBilal, 'Muhammad Bilal', '0300-1234567', cashierUser.lastInsertRowid, 'Cashier 1', 'Counter 1', 950, 0, 0, 950, 950, 0, 'Cash', 'PAID', '2026-10-13 11:30:00');
  insertSaleItem.run(s1.lastInsertRowid, prodMap['890123456013'], 'Ronin R-540 Fast Cable 65W', null, null, 1, 950, 550, 0, null, '2026-10-13 11:30:00');
  db.prepare('INSERT INTO payments (sale_id, method, amount, created_at) VALUES (?, ?, ?, ?)').run(s1.lastInsertRowid, 'Cash', 950, '2026-10-13 11:30:00');

  const s2 = insertSale.run('INV-0002', cWalkIn, 'Walk-in Customer', '--------------', cashierUser.lastInsertRowid, 'Cashier 1', 'Counter 2', 4800, 0, 0, 4800, 4800, 0, 'Online', 'PAID', '2026-10-13 15:45:00');
  insertSaleItem.run(s2.lastInsertRowid, prodMap['890123456014'], 'Audionic Airbud 425 TWS', null, null, 1, 4800, 3500, 0, '2027-04-13', '2026-10-13 15:45:00');
  db.prepare('INSERT INTO payments (sale_id, method, amount, created_at) VALUES (?, ?, ?, ?)').run(s2.lastInsertRowid, 'Online', 4800, '2026-10-13 15:45:00');

  const s3 = insertSale.run('INV-0003', cTariq, 'Tariq Mehmood', '0312-9876543', adminUser.lastInsertRowid, 'Owner (Admin)', 'Counter 1', 7500, 500, 0, 7000, 2500, 4500, 'Credit', 'PARTIAL', '2026-10-14 09:15:00');
  insertSaleItem.run(s3.lastInsertRowid, prodMap['890123456012'], 'Samsung 25W Type-C Adapter', null, null, 2, 3200, 2200, 0, '2027-04-14', '2026-10-14 09:15:00');
  insertSaleItem.run(s3.lastInsertRowid, prodMap['890123456016'], 'Silicon Clear Shockproof Case', null, null, 2, 550, 180, 0, null, '2026-10-14 09:15:00');
  db.prepare('INSERT INTO payments (sale_id, method, amount, created_at) VALUES (?, ?, ?, ?)').run(s3.lastInsertRowid, 'Cash', 2500, '2026-10-14 09:15:00');
  db.prepare('INSERT INTO ledger_entries (party_type, party_id, type, amount, ref, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('customer', cTariq, 'debit', 4500, 'INV-0003', 'Remaining balance for INV-0003', '2026-10-14');

  // Seed sample expenses
  const insertExpense = db.prepare('INSERT INTO expenses (title, category, amount, date, notes) VALUES (?, ?, ?, ?, ?)');
  insertExpense.run('Shop Electricity Bill', 'Utilities', 8500, '2026-10-10', 'September electricity bill');
  insertExpense.run('Tea & Refreshment for customers', 'Refreshments', 1200, '2026-10-13', 'Daily tea');

  // Seed initial audit log
  db.prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
    .run(adminUser.lastInsertRowid, 'admin', 'SYSTEM_INITIALIZED', 'Initial database schema & seed created successfully', '127.0.0.1');

  console.log('Seeding completed successfully!');
}

module.exports = { seedDatabase };

if (require.main === module) {
  seedDatabase();
}
