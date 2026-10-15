const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Initialize database & run seed if empty
const db = require('./db/connection');
const { seedDatabase } = require('./db/seed');
seedDatabase();

const { getLanIps } = require('./utils/lanIp');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all LAN devices
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    shop: 'MIAN MOBILES POS',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/phone-units', require('./routes/phoneUnits'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// Serve frontend static build if built
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
const fs = require('fs');
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send(`
    <h1>MIAN MOBILES POS Backend API is running on port ${PORT}!</h1>
    <p>Vite dev server runs separately on port 5173 or run <code>npm run build</code> in frontend to serve unified app.</p>
  `);
});

// Start listening on 0.0.0.0 so all LAN counters and phones can connect!
app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log('  MIAN MOBILES POS & INVENTORY SERVER STARTED SUCCESSFULLY!     ');
  console.log('================================================================');
  console.log(`  Local PC 1 URL : http://localhost:${PORT}`);
  const lanIps = getLanIps();
  lanIps.forEach(net => {
    console.log(`  LAN URL (PC 2 / Mobile): http://${net.ip}:${PORT} (${net.interface})`);
  });
  console.log('================================================================');
});
