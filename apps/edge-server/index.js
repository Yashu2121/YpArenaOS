/**
 * YP Arena OS Edge Server v2.0
 * Full REST API + WebSocket Hub
 * Connects: Admin Dashboard, PC Client, Server Engine, Mobile Apps
 */

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

// ============================================================
// DATABASE SETUP (Zero-Config Embedded)
// ============================================================
const appDataFolder = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share');
const dataDir = path.join(appDataFolder, 'YpArenaOS');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'yparenaos-db');
const db = new PGlite(dbPath);

// Add a connect method wrapper for backwards compatibility
db.connect = async () => true;

// Run schema on startup
async function initDb() {
  try {
    console.log('[DB] Connecting to Embedded PostgreSQL (PGLite)');
    
    let schemaStr = '';
    // Handle pkg virtual filesystem for reading the schema file
    if (process.pkg) {
      schemaStr = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    } else {
      schemaStr = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf-8');
    }

    // PGLite handles the full postgres schema flawlessly
    await db.query(schemaStr);
    console.log('[DB] Database embedded locally at:', dbPath);
    console.log('[DB] Schema initialized successfully');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    console.log('[DB] Running in MOCK MODE (no database)');
  }
}

// ============================================================
// EXPRESS APP & DRM STATE
// ============================================================
const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
app.use(express.json());

const server = http.createServer(app);

const crypto = require('crypto');
const https = require('https');
const httpModule = require('http');

const SAAS_URL = process.env.SAAS_SERVER_URL || 'http://localhost:5000';
let IS_LICENSED = false;
let LICENSE_DETAILS = null;
let LICENSE_CHECK_INTERVAL = null;

async function validateLicenseWithSaaS(key, hardwareId) {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${SAAS_URL}/api/licenses/validate`);
      const payload = JSON.stringify({ licenseKey: key, hardwareId });
      const client = url.protocol === 'https:' ? https : httpModule;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      const req = client.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ valid: false, message: 'Invalid response from SaaS server' });
          }
        });
      });
      
      req.on('error', (e) => {
        resolve({ valid: false, message: `Could not connect to SaaS license server: ${e.message}` });
      });
      
      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ valid: false, message: `Validation error: ${err.message}` });
    }
  });
}

function getMachineId() {
  const filePath = path.join(__dirname, 'machine.id');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  const id = crypto.randomUUID();
  fs.writeFileSync(filePath, id, 'utf8');
  return id;
}

function getSavedLicenseKey() {
  if (process.env.LICENSE_KEY) {
    return process.env.LICENSE_KEY.trim();
  }
  const filePath = path.join(__dirname, 'license.key');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  const parentPath = path.join(__dirname, '..', 'license.key');
  if (fs.existsSync(parentPath)) {
    return fs.readFileSync(parentPath, 'utf8').trim();
  }
  return null;
}

function lockdownCafe() {
  console.warn('[DRM] LICENSE INVALID OR EXPIRED. LOCKING DOWN CLIENTS...');
  connectedClients.forEach((ws, pcId) => {
    try {
      ws.send(JSON.stringify({ 
        type: 'REMOTE_LOCK', 
        reason: 'License Expired or Invalid. Please contact cafe administrator.' 
      }));
      console.log(`[DRM] Locked client PC: ${pcId}`);
    } catch (err) {
      console.error(`[DRM] Failed to send lock to ${pcId}:`, err.message);
    }
  });
  broadcast('LICENSE_EXPIRED', { 
    error: 'System locked due to lack of a valid enterprise subscription.' 
  });
}

async function verifyLicense() {
  const key = getSavedLicenseKey();
  const machineId = getMachineId();
  
  if (!key) {
    console.warn('[DRM] No license key configured. Edge Server is running in UNLICENSED mode.');
    IS_LICENSED = false;
    LICENSE_DETAILS = null;
    lockdownCafe();
    return false;
  }

  console.log(`[DRM] Verifying license: ${key}...`);
  const res = await validateLicenseWithSaaS(key, machineId);
  
  if (res.valid) {
    console.log(`[DRM] License is VALID. Registered to: ${res.license.cafeName}`);
    IS_LICENSED = true;
    LICENSE_DETAILS = res.license;
    return true;
  } else {
    console.error(`[DRM] License verification failed: ${res.message}`);
    IS_LICENSED = false;
    LICENSE_DETAILS = null;
    lockdownCafe();
    return false;
  }
}

function startLicenseHeartbeat() {
  if (LICENSE_CHECK_INTERVAL) clearInterval(LICENSE_CHECK_INTERVAL);
  // Check license every 10 minutes
  LICENSE_CHECK_INTERVAL = setInterval(verifyLicense, 10 * 60 * 1000);
}

// DRM Request Interception Middleware
app.use((req, res, next) => {
  const bypassPaths = [
    '/health',
    '/auth/login',
    '/auth/register',
    '/api/license/status',
    '/api/license/activate'
  ];
  
  if (bypassPaths.includes(req.path)) {
    return next();
  }
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !IS_LICENSED) {
    return res.status(402).json({ 
      error: 'License Expired or Invalid. Please enter a valid license key in the settings panel.', 
      unlicensed: true 
    });
  }
  
  next();
});

// Licensing Endpoints
app.get('/api/license/status', (req, res) => {
  res.json({
    licensed: IS_LICENSED,
    licenseKey: getSavedLicenseKey() || null,
    machineId: getMachineId(),
    details: LICENSE_DETAILS
  });
});

app.post('/api/license/activate', async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ error: 'licenseKey is required' });
  }

  const machineId = getMachineId();
  console.log(`[DRM] Request to activate license key: ${licenseKey}`);
  
  const validation = await validateLicenseWithSaaS(licenseKey, machineId);
  
  if (validation.valid) {
    fs.writeFileSync(path.join(__dirname, 'license.key'), licenseKey, 'utf8');
    IS_LICENSED = true;
    LICENSE_DETAILS = validation.license;
    
    // Unlock client PCs
    console.log('[DRM] Activation successful. Unlocking clients...');
    connectedClients.forEach((ws, pcId) => {
      ws.send(JSON.stringify({ type: 'REMOTE_UNLOCK' }));
    });
    broadcast('LICENSE_ACTIVATED', { details: validation.license });

    res.json({ success: true, message: 'License activated successfully!', license: validation.license });
  } else {
    IS_LICENSED = false;
    LICENSE_DETAILS = null;
    lockdownCafe();
    res.status(400).json({ error: validation.message || 'Invalid license key' });
  }
});
const PORT   = parseInt(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'yparenaos_dev_secret';
const DEFAULT_GAMEZONE_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'owner@yparenaos.com';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin123';

function createDemoAdminToken(email = DEMO_ADMIN_EMAIL) {
  return jwt.sign(
    { user_id: 'demo-owner-001', role: 'owner', email, name: 'Demo Owner' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function isDemoAdminLogin(email, password) {
  return email === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD;
}

// ============================================================
// WEBSOCKET SETUP
// ============================================================
const wss = new WebSocket.Server({ server });
const connectedClients = new Map(); // pcId → ws connection

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] New connection from ${ip}`);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'REGISTER_PC') {
        const stationName = msg.stationName || msg.pcId || 'PC-UNKNOWN';
        const gamezoneId = msg.gamezoneId || DEFAULT_GAMEZONE_ID;
        let clientId = msg.clientId;

        try {
          const existing = await db.query(
            `SELECT client_id FROM clients WHERE gamezone_id=$1 AND name=$2 LIMIT 1`,
            [gamezoneId, stationName]
          );

          if (existing.rows.length) {
            clientId = existing.rows[0].client_id;
            await db.query(
              `UPDATE clients SET status='online', ip_address=$1, last_seen=NOW() WHERE client_id=$2`,
              [ip, clientId]
            );
          } else {
            const inserted = await db.query(
              `INSERT INTO clients (gamezone_id, name, device_type, status, ip_address, hourly_rate, specs, last_seen)
               VALUES ($1, $2, 'PC', 'online', $3, 60.00, $4, NOW()) RETURNING client_id`,
              [gamezoneId, stationName, ip, JSON.stringify({ source: 'auto_registered' })]
            );
            clientId = inserted.rows[0].client_id;
          }
        } catch (e) {
          let mock = currentMockDevices.find(d => d.name === stationName);
          if (!mock) {
            mock = {
              client_id: crypto.randomUUID(),
              gamezone_id: gamezoneId,
              name: stationName,
              device_type: 'PC',
              status: 'online',
              ip_address: ip,
              specs: { source: 'auto_registered' },
              hourly_rate: 60
            };
            currentMockDevices.push(mock);
          } else {
            mock.status = 'online';
            mock.ip_address = ip;
          }
          clientId = mock.client_id;
        }

        connectedClients.set(clientId, ws);
        ws.pcId = clientId;
        ws.stationName = stationName;
        console.log(`[WS] PC Registered: ${stationName} (${clientId})`);

        broadcast('DEVICE_STATUS_UPDATE', { pcId: clientId, stationName, status: 'online' });

        ws.send(JSON.stringify({
          type: 'REGISTERED',
          clientId,
          stationName,
          message: 'PC registered successfully',
          status: 'UP_TO_DATE'
        }));

        // DRM check: Lock the client immediately if unlicensed!
        if (!IS_LICENSED) {
          ws.send(JSON.stringify({ 
            type: 'REMOTE_LOCK', 
            reason: 'License Expired or Invalid. Please contact cafe administrator.' 
          }));
        }
      }

      if (msg.type === 'SESSION_HEARTBEAT') {
        try {
          await db.query(
            `UPDATE clients SET last_seen=NOW() WHERE client_id=$1`,
            [msg.pcId]
          );
        } catch (e) { /* ignore */ }
        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', serverTime: new Date().toISOString() }));
      }

    } catch (e) {
      console.error('[WS] Parse error:', e.message);
    }
  });

  ws.on('close', async () => {
    if (ws.pcId) {
      connectedClients.delete(ws.pcId);
      try {
        await db.query(`UPDATE clients SET status='offline' WHERE client_id=$1`, [ws.pcId]);
      } catch (e) { /* ignore */ }
      broadcast('DEVICE_STATUS_UPDATE', { pcId: ws.pcId, status: 'offline' });
      console.log(`[WS] PC disconnected: ${ws.pcId}`);
    }
  });
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.user = decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) { /* ignore */ }

  res.json({
    status: 'YP Arena OS Edge Server Online',
    version: '2.0.0',
    database: dbStatus,
    connected_pcs: connectedClients.size,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// AUTH ROUTES
// ============================================================

// POST /auth/login — All apps
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    if (isDemoAdminLogin(email, password)) {
      return res.json({
        token: createDemoAdminToken(email),
        user: { user_id: 'demo-owner-001', name: 'Demo Owner', email, role: 'owner' },
        demo: true
      });
    }

    const result = await db.query('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, email: user.email, name: user.name },
      JWT_SECRET, { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { user_id: user.user_id, name: user.name, email: user.email, role: user.role, phone: user.phone }
    });
  } catch (err) {
    if (!isDemoAdminLogin(email, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // MOCK response when DB not available
    const mockToken = createDemoAdminToken(email);
    res.json({ token: mockToken, user: { user_id: 'mock-001', name: 'Demo User', email, role: 'owner' }, mock: true });
  }
});

// POST /auth/register — New customer or owner signup
app.post('/auth/register', async (req, res) => {
  const { name, email, password, role = 'customer', phone, gamezone_name, city } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const userRes = await db.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING user_id, name, email, role`,
      [name, email, hash, role, phone]
    );
    const newUser = userRes.rows[0];

    // If registering as owner, create their gamezone
    if (role === 'owner' && gamezone_name) {
      await db.query(
        `INSERT INTO gamezones (owner_id, name, city, subscription_status, expiry_date)
         VALUES ($1, $2, $3, 'trial', NOW() + INTERVAL '30 days')`,
        [newUser.user_id, gamezone_name, city || '']
      );
    }

    const token = jwt.sign(
      { user_id: newUser.user_id, role: newUser.role, email: newUser.email, name: newUser.name },
      JWT_SECRET, { expiresIn: '24h' }
    );

    res.status(201).json({ token, user: newUser });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/logout
app.post('/auth/logout', requireAuth(), (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// ============================================================
// USERS ROUTES
// ============================================================

// GET /users — List all users (admin/owner only)
app.get('/users', requireAuth(['owner', 'staff']), async (req, res) => {
  try {
    const { role, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT user_id, name, email, role, phone, is_active, created_at FROM users WHERE 1=1';
    const params = [];
    if (role) { params.push(role); query += ` AND role=$${params.length}`; }
    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await db.query(query, params);
    res.json({ users: result.rows, total: result.rowCount });
  } catch (err) {
    res.json({ users: mockUsers(), total: 5, mock: true });
  }
});

// GET /users/:id — User profile with membership and session history
app.get('/users/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const userRes = await db.query(
      'SELECT user_id, name, email, role, phone, created_at FROM users WHERE user_id=$1',
      [id]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const membershipRes = await db.query(
      'SELECT * FROM memberships WHERE user_id=$1',
      [id]
    );

    const sessionRes = await db.query(
      `SELECT s.*, c.name as device_name FROM sessions s 
       JOIN clients c ON s.client_id=c.client_id
       WHERE s.customer_id=$1 ORDER BY s.start_time DESC LIMIT 10`,
      [id]
    );

    res.json({
      user: userRes.rows[0],
      memberships: membershipRes.rows,
      recent_sessions: sessionRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// WALLET ROUTES
// ============================================================

// POST /users/:id/wallet/topup
app.post('/users/:id/wallet/topup', requireAuth(), async (req, res) => {
  const { id } = req.params;
  const { gamezone_id, amount, method = 'UPI', reference_id } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    // Update membership wallet
    await db.query(
      `INSERT INTO memberships (user_id, gamezone_id, wallet_balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, gamezone_id) DO UPDATE SET wallet_balance = memberships.wallet_balance + $3, updated_at=NOW()`,
      [id, gamezone_id, amount]
    );

    // Record payment
    const payment = await db.query(
      `INSERT INTO payments (user_id, gamezone_id, amount, method, status, reference_id, description)
       VALUES ($1, $2, $3, $4, 'success', $5, 'Wallet Top-Up') RETURNING *`,
      [id, gamezone_id, amount, method, reference_id]
    );

    // Get new balance
    const balance = await db.query(
      'SELECT wallet_balance FROM memberships WHERE user_id=$1 AND gamezone_id=$2',
      [id, gamezone_id]
    );

    broadcast('WALLET_UPDATED', { user_id: id, new_balance: balance.rows[0]?.wallet_balance });
    res.json({ success: true, payment: payment.rows[0], wallet_balance: balance.rows[0]?.wallet_balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/:id/wallet/deduct
app.post('/users/:id/wallet/deduct', requireAuth(['owner', 'staff']), async (req, res) => {
  const { id } = req.params;
  const { gamezone_id, amount, session_id, description = 'Session Payment' } = req.body;

  try {
    const balanceRes = await db.query(
      'SELECT wallet_balance FROM memberships WHERE user_id=$1 AND gamezone_id=$2',
      [id, gamezone_id]
    );
    const balance = balanceRes.rows[0]?.wallet_balance || 0;
    if (balance < amount) return res.status(400).json({ error: 'Insufficient wallet balance' });

    await db.query(
      `UPDATE memberships SET wallet_balance = wallet_balance - $3, updated_at=NOW()
       WHERE user_id=$1 AND gamezone_id=$2`,
      [id, gamezone_id, amount]
    );

    await db.query(
      `INSERT INTO payments (user_id, gamezone_id, session_id, amount, method, status, description)
       VALUES ($1, $2, $3, $4, 'wallet', 'success', $5)`,
      [id, gamezone_id, session_id, amount, description]
    );

    broadcast('WALLET_UPDATED', { user_id: id, deducted: amount });
    res.json({ success: true, deducted: amount, new_balance: balance - amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GAMEZONE ROUTES
// ============================================================

// GET /gamezones
app.get('/gamezones', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*, u.name as owner_name, u.email as owner_email,
              COUNT(c.client_id) as total_devices
       FROM gamezones g 
       JOIN users u ON g.owner_id=u.user_id
       LEFT JOIN clients c ON c.gamezone_id=g.gamezone_id
       GROUP BY g.gamezone_id, u.name, u.email
       ORDER BY g.created_at DESC`
    );
    res.json({ gamezones: result.rows });
  } catch (err) {
    res.json({ gamezones: mockGamezones(), mock: true });
  }
});

// GET /gamezones/:id
app.get('/gamezones/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM gamezones WHERE gamezone_id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Gamezone not found' });
    res.json({ gamezone: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CLIENTS (DEVICES) ROUTES
// ============================================================

// GET /clients — All devices (live status)
app.get('/clients', async (req, res) => {
  const { gamezone_id, status } = req.query;
  try {
    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    if (gamezone_id) { params.push(gamezone_id); query += ` AND gamezone_id=$${params.length}`; }
    if (status) { params.push(status); query += ` AND status=$${params.length}`; }
    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    // Overlay live WS connection status
    const rows = result.rows.map(r => ({
      ...r,
      ws_connected: connectedClients.has(r.client_id)
    }));
    res.json({ clients: rows, total: rows.length });
  } catch (err) {
    res.json({ clients: mockDevices(), total: 7, mock: true });
  }
});

// POST /clients — Add new client device
app.post('/clients', async (req, res) => {
  const { name, device_type, hourly_rate, ip_address, specs, gamezone_id = DEFAULT_GAMEZONE_ID } = req.body;
  if (!name || !device_type) {
    return res.status(400).json({ error: 'name and device_type are required' });
  }

  const newDevice = {
    client_id: crypto.randomUUID(),
    gamezone_id,
    name,
    device_type,
    status: 'offline',
    ip_address: ip_address || '192.168.1.' + (100 + currentMockDevices.length + 1),
    specs: specs || { gpu: 'RTX 4070', ram: '16GB' },
    hourly_rate: parseFloat(hourly_rate) || 50.00
  };

  try {
    const result = await db.query(
      `INSERT INTO clients (gamezone_id, name, device_type, ip_address, specs, hourly_rate, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'offline') RETURNING *`,
      [gamezone_id, name, device_type, newDevice.ip_address, JSON.stringify(newDevice.specs), newDevice.hourly_rate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    currentMockDevices.push(newDevice);
    res.status(201).json(newDevice);
  }
});

// PATCH /clients/:id/status — Update device status
app.patch('/clients/:id/status', requireAuth(['owner', 'staff']), async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE clients SET status=$1, last_seen=NOW() WHERE client_id=$2', [status, req.params.id]);
    broadcast('DEVICE_STATUS_UPDATE', { pcId: req.params.id, status });

    // If WS client is connected, send command
    const ws = connectedClients.get(req.params.id);
    if (ws) ws.send(JSON.stringify({ type: 'STATUS_CHANGE', status }));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SESSION ROUTES
// ============================================================

// GET /sessions — All sessions paginated
app.get('/sessions', requireAuth(['owner', 'staff']), async (req, res) => {
  const { gamezone_id, status, limit = 50, offset = 0 } = req.query;
  try {
    let query = `
      SELECT s.*, c.name as device_name, c.device_type,
             u.name as customer_name, u.email as customer_email
      FROM sessions s
      JOIN clients c ON s.client_id=c.client_id
      LEFT JOIN users u ON s.customer_id=u.user_id
      WHERE 1=1`;
    const params = [];
    if (gamezone_id) { params.push(gamezone_id); query += ` AND s.gamezone_id=$${params.length}`; }
    if (status) { params.push(status); query += ` AND s.status=$${params.length}`; }
    params.push(limit, offset);
    query += ` ORDER BY s.start_time DESC LIMIT $${params.length-1} OFFSET $${params.length}`;
    const result = await db.query(query, params);
    res.json({ sessions: result.rows });
  } catch (err) {
    res.json({ sessions: [], mock: true });
  }
});

// GET /sessions/active — Only active sessions
app.get('/sessions/active', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, c.name as device_name, c.ip_address,
             u.name as customer_name
      FROM sessions s
      JOIN clients c ON s.client_id=c.client_id
      LEFT JOIN users u ON s.customer_id=u.user_id
      WHERE s.status='active'
      ORDER BY s.start_time ASC
    `);
    res.json({ sessions: result.rows, count: result.rowCount });
  } catch (err) {
    const activeSessions = currentMockSessions.filter(s => s.status === 'active');
    res.json({ sessions: activeSessions, count: activeSessions.length, mock: true });
  }
});

// POST /sessions/start — Start a session
app.post('/sessions/start', requireAuth(['owner', 'staff']), async (req, res) => {
  const { client_id, customer_id, gamezone_id, payment_method = 'wallet' } = req.body;
  if (!client_id || !gamezone_id) return res.status(400).json({ error: 'client_id and gamezone_id required' });

  try {
    // Mark device as in_use
    await db.query(`UPDATE clients SET status='in_use', last_seen=NOW() WHERE client_id=$1`, [client_id]);

    // Create session
    const session = await db.query(
      `INSERT INTO sessions (client_id, customer_id, gamezone_id, payment_method, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [client_id, customer_id, gamezone_id, payment_method]
    );

    broadcast('SESSION_STARTED', { session: session.rows[0], client_id, customer_id });
    broadcast('DEVICE_STATUS_UPDATE', { pcId: client_id, status: 'in_use' });

    // Notify specific PC via WS
    const ws = connectedClients.get(client_id);
    if (ws) ws.send(JSON.stringify({ type: 'SESSION_START', session: session.rows[0] }));

    res.status(201).json({ session: session.rows[0] });
  } catch (err) {
    const device = currentMockDevices.find(d => d.client_id === client_id);
    if (!device) return res.status(404).json({ error: 'Client not found' });

    device.status = 'in_use';
    const session = {
      session_id: crypto.randomUUID(),
      client_id,
      customer_id: customer_id || null,
      gamezone_id,
      start_time: new Date().toISOString(),
      end_time: null,
      duration_minutes: null,
      amount: 0,
      payment_method,
      payment_status: 'pending',
      status: 'active',
      device_name: device.name,
      customer_name: customer_id ? 'Demo Customer' : 'Walk-in'
    };
    currentMockSessions.push(session);

    broadcast('SESSION_STARTED', { session, client_id, customer_id });
    broadcast('DEVICE_STATUS_UPDATE', { pcId: client_id, status: 'in_use' });

    const ws = connectedClients.get(client_id);
    if (ws) ws.send(JSON.stringify({ type: 'SESSION_START', session }));

    res.status(201).json({ session, mock: true });
  }
});

// POST /sessions/:id/stop — End a session
app.post('/sessions/:id/stop', requireAuth(['owner', 'staff']), async (req, res) => {
  const { id } = req.params;
  try {
    const sessionRes = await db.query('SELECT * FROM sessions WHERE session_id=$1', [id]);
    if (!sessionRes.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessionRes.rows[0];

    // Calculate duration and cost
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationMinutes = Math.ceil((endTime - startTime) / 60000);

    // Get device rate
    const deviceRes = await db.query('SELECT hourly_rate FROM clients WHERE client_id=$1', [session.client_id]);
    const hourlyRate = deviceRes.rows[0]?.hourly_rate || 40;
    const cost = (durationMinutes / 60) * hourlyRate;

    // Update session
    const updated = await db.query(
      `UPDATE sessions SET status='completed', end_time=NOW(), duration_minutes=$1, amount=$2, payment_status='paid'
       WHERE session_id=$3 RETURNING *`,
      [durationMinutes, cost.toFixed(2), id]
    );

    // Free the device
    await db.query(`UPDATE clients SET status='online', last_seen=NOW() WHERE client_id=$1`, [session.client_id]);

    // Add loyalty points
    if (session.customer_id) {
      const points = Math.floor(cost);
      await db.query(
        `UPDATE memberships SET points = points + $1, updated_at=NOW() WHERE user_id=$2 AND gamezone_id=$3`,
        [points, session.customer_id, session.gamezone_id]
      );
    }

    broadcast('SESSION_ENDED', { session: updated.rows[0], client_id: session.client_id });
    broadcast('DEVICE_STATUS_UPDATE', { pcId: session.client_id, status: 'online' });

    const ws = connectedClients.get(session.client_id);
    if (ws) ws.send(JSON.stringify({ type: 'SESSION_END', session: updated.rows[0] }));

    res.json({ session: updated.rows[0], duration_minutes: durationMinutes, amount: cost.toFixed(2) });
  } catch (err) {
    const session = currentMockSessions.find(s => s.session_id === id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const device = currentMockDevices.find(d => d.client_id === session.client_id);
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationMinutes = Math.max(1, Math.ceil((endTime - startTime) / 60000));
    const hourlyRate = device?.hourly_rate || 40;
    const cost = (durationMinutes / 60) * hourlyRate;

    session.status = 'completed';
    session.end_time = endTime.toISOString();
    session.duration_minutes = durationMinutes;
    session.amount = Number(cost.toFixed(2));
    session.payment_status = 'paid';
    if (device) device.status = 'online';

    broadcast('SESSION_ENDED', { session, client_id: session.client_id });
    broadcast('DEVICE_STATUS_UPDATE', { pcId: session.client_id, status: 'online' });

    const ws = connectedClients.get(session.client_id);
    if (ws) ws.send(JSON.stringify({ type: 'SESSION_END', session }));

    res.json({ session, duration_minutes: durationMinutes, amount: cost.toFixed(2), mock: true });
  }
});

// ============================================================
// STATS ROUTES
// ============================================================

// GET /stats — Dashboard summary
app.get('/stats', async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    const [devicesRes, activeRes, todayRevenueRes, todayHoursRes, totalUsersRes] = await Promise.all([
      db.query(`SELECT COUNT(*) as total, status FROM clients ${gamezone_id ? 'WHERE gamezone_id=$1' : ''} GROUP BY status`, gamezone_id ? [gamezone_id] : []),
      db.query(`SELECT COUNT(*) as count FROM sessions WHERE status='active'${gamezone_id ? ' AND gamezone_id=$1' : ''}`, gamezone_id ? [gamezone_id] : []),
      db.query(`SELECT COALESCE(SUM(amount), 0) as revenue FROM sessions WHERE status='completed' AND DATE(end_time)=CURRENT_DATE${gamezone_id ? ' AND gamezone_id=$1' : ''}`, gamezone_id ? [gamezone_id] : []),
      db.query(`SELECT COALESCE(SUM(duration_minutes), 0) as minutes FROM sessions WHERE status='completed' AND DATE(end_time)=CURRENT_DATE${gamezone_id ? ' AND gamezone_id=$1' : ''}`, gamezone_id ? [gamezone_id] : []),
      db.query('SELECT COUNT(*) as count FROM users WHERE role=\'customer\''),
    ]);

    const deviceMap = {};
    devicesRes.rows.forEach(r => { deviceMap[r.status] = parseInt(r.total); });

    res.json({
      devices: {
        total: Object.values(deviceMap).reduce((a, b) => a + b, 0),
        online: deviceMap['online'] || 0,
        in_use: deviceMap['in_use'] || 0,
        offline: deviceMap['offline'] || 0,
        maintenance: deviceMap['maintenance'] || 0,
      },
      active_sessions: parseInt(activeRes.rows[0]?.count) || 0,
      today: {
        revenue: parseFloat(todayRevenueRes.rows[0]?.revenue) || 0,
        hours: Math.round((parseInt(todayHoursRes.rows[0]?.minutes) || 0) / 60 * 10) / 10,
      },
      total_customers: parseInt(totalUsersRes.rows[0]?.count) || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const completedToday = currentMockSessions.filter(s =>
      s.status === 'completed' && s.end_time && new Date(s.end_time).toDateString() === new Date().toDateString()
    );
    const deviceMap = currentMockDevices.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      devices: {
        total: currentMockDevices.length,
        online: deviceMap.online || 0,
        in_use: deviceMap.in_use || 0,
        offline: deviceMap.offline || 0,
        maintenance: deviceMap.maintenance || 0
      },
      active_sessions: currentMockSessions.filter(s => s.status === 'active').length,
      today: {
        revenue: completedToday.reduce((sum, s) => sum + Number(s.amount || 0), 0),
        hours: Math.round(completedToday.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0) / 60 * 10) / 10
      },
      total_customers: 147,
      mock: true
    });
  }
});

// GET /stats/chart — Hourly revenue for charts
app.get('/stats/chart', requireAuth(['owner', 'staff']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM end_time) as hour,
        COUNT(*) as sessions,
        COALESCE(SUM(amount), 0) as revenue
      FROM sessions
      WHERE status='completed' AND end_time >= NOW() - INTERVAL '24 hours'
      GROUP BY hour ORDER BY hour ASC
    `);
    res.json({ chart: result.rows });
  } catch (err) {
    // Mock chart data
    const chart = Array.from({ length: 12 }, (_, i) => ({
      hour: i + 8,
      sessions: Math.floor(Math.random() * 6) + 1,
      revenue: Math.floor(Math.random() * 2000) + 500
    }));
    res.json({ chart, mock: true });
  }
});

// ============================================================
// TOURNAMENTS ROUTES
// ============================================================

// GET /tournaments
app.get('/tournaments', async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    let query = 'SELECT * FROM tournaments WHERE 1=1';
    const params = [];
    if (gamezone_id) { params.push(gamezone_id); query += ` AND gamezone_id=$${params.length}`; }
    query += ' ORDER BY start_date ASC';
    const result = await db.query(query, params);
    res.json({ tournaments: result.rows });
  } catch (err) {
    res.json({ tournaments: mockTournaments(), mock: true });
  }
});

// POST /tournaments/:id/register
app.post('/tournaments/:id/register', requireAuth(), async (req, res) => {
  const { user_id, team_name } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO tournament_registrations (tournament_id, user_id, team_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.id, user_id, team_name]
    );
    res.status(201).json({ registration: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POS ROUTES
// ============================================================

// GET /pos — Items for a gamezone
app.get('/pos', async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    const result = await db.query(
      'SELECT * FROM pos_items WHERE gamezone_id=$1 AND is_available=TRUE ORDER BY category, item_name',
      [gamezone_id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    res.json({ items: mockPosItems(), mock: true });
  }
});

// POST /pos — Add new POS item
app.post('/pos', async (req, res) => {
  const { item_name, category, price, stock, gamezone_id = 'b0000000-0000-0000-0000-000000000001' } = req.body;
  if (!item_name || !price) {
    return res.status(400).json({ error: 'item_name and price are required' });
  }
  
  const newItem = {
    pos_id: crypto.randomUUID(),
    gamezone_id,
    item_name,
    category: category || 'food',
    price: parseFloat(price),
    stock: parseInt(stock) || 0,
    is_available: true
  };

  try {
    const result = await db.query(
      `INSERT INTO pos_items (gamezone_id, item_name, category, price, stock)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [gamezone_id, item_name, category || 'food', price, stock || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    currentMockPosItems.push(newItem);
    res.status(201).json(newItem);
  }
});

// POST /pos/order — Place an order
app.post('/pos/order', async (req, res) => {
  const { pos_id, user_id, gamezone_id, session_id, quantity = 1 } = req.body;
  try {
    const itemRes = await db.query('SELECT * FROM pos_items WHERE pos_id=$1', [pos_id]);
    if (!itemRes.rows.length) return res.status(404).json({ error: 'Item not found' });
    const item = itemRes.rows[0];
    if (item.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const total = item.price * quantity;

    const order = await db.query(
      `INSERT INTO orders (pos_id, user_id, gamezone_id, session_id, quantity, unit_price, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [pos_id, user_id, gamezone_id, session_id, quantity, item.price, total]
    );

    // Decrement stock
    await db.query('UPDATE pos_items SET stock = stock - $1 WHERE pos_id=$2', [quantity, pos_id]);

    const finalOrder = order.rows[0];
    
    // Broadcast order to Admin Dashboard
    broadcast('NEW_ORDER', { order: finalOrder, item: item.item_name, quantity, total });

    res.status(201).json({ order: finalOrder, item: item.item_name, total });
  } catch (err) {
    const item = currentMockPosItems.find(p => p.pos_id === pos_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const total = item.price * quantity;
    item.stock -= quantity;

    const order = {
      order_id: crypto.randomUUID(),
      pos_id,
      user_id: user_id || null,
      gamezone_id: gamezone_id || DEFAULT_GAMEZONE_ID,
      session_id: session_id || null,
      quantity,
      unit_price: item.price,
      total_amount: total,
      payment_method: 'wallet',
      status: 'completed',
      timestamp: new Date().toISOString()
    };
    currentMockOrders.unshift({ ...order, item_name: item.item_name, category: item.category });

    broadcast('NEW_ORDER', { order, item: item.item_name, quantity, total });
    res.status(201).json({ order, item: item.item_name, total, mock: true });
  }
});

// GET /pos/orders — Order history
app.get('/pos/orders', requireAuth(['owner', 'staff']), async (req, res) => {
  const { gamezone_id, limit = 50 } = req.query;
  try {
    const result = await db.query(
      `SELECT o.*, p.item_name, p.category, u.name as customer_name
       FROM orders o
       JOIN pos_items p ON o.pos_id=p.pos_id
       LEFT JOIN users u ON o.user_id=u.user_id
       WHERE o.gamezone_id=$1
       ORDER BY o.timestamp DESC LIMIT $2`,
      [gamezone_id, limit]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.json({ orders: currentMockOrders.slice(0, Number(limit)), mock: true });
  }
});

// ============================================================
// PAYMENTS ROUTES
// ============================================================

// GET /payments
app.get('/payments', requireAuth(['owner', 'staff']), async (req, res) => {
  const { gamezone_id, limit = 50 } = req.query;
  try {
    const result = await db.query(
      `SELECT p.*, u.name as user_name FROM payments p
       JOIN users u ON p.user_id=u.user_id
       WHERE p.gamezone_id=$1
       ORDER BY p.timestamp DESC LIMIT $2`,
      [gamezone_id, limit]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.json({ payments: [], mock: true });
  }
});

// ============================================================
// GAMES & AUTO-UPDATES ROUTES
// ============================================================

// GET /games — List all games
app.get('/games', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM games ORDER BY name ASC');
    res.json({ games: result.rows });
  } catch (err) {
    res.json({ games: mockGames(), mock: true });
  }
});

// POST /games/update — Trigger an update for a game across all online PCs
app.post('/games/update', requireAuth(['owner', 'staff']), async (req, res) => {
  const { game_id } = req.body;
  if (!game_id) return res.status(400).json({ error: 'game_id is required' });

  try {
    const gameRes = await db.query('SELECT * FROM games WHERE game_id=$1', [game_id]);
    if (!gameRes.rows.length) return res.status(404).json({ error: 'Game not found' });
    const game = gameRes.rows[0];

    // Mark online PCs as updating in DB
    const onlinePcs = await db.query(`SELECT client_id FROM clients WHERE status IN ('online', 'in_use')`);
    for (const pc of onlinePcs.rows) {
      await db.query(`
        INSERT INTO client_games (client_id, game_id, installed_version, status)
        VALUES ($1, $2, 'updating', 'updating')
        ON CONFLICT (client_id, game_id) DO UPDATE SET status='updating', last_updated=NOW()
      `, [pc.client_id, game.game_id]);
    }

    // Broadcast the update command
    broadcast('TRIGGER_GAME_UPDATE', { 
      game_id: game.game_id, 
      name: game.name, 
      platform: game.platform,
      app_id: game.app_id,
      version: game.current_version,
      size_mb: game.size_mb
    });

    res.json({ success: true, message: `Update triggered for ${game.name} on ${onlinePcs.rowCount} online PCs.` });
  } catch (err) {
    // Mock behavior
    broadcast('TRIGGER_GAME_UPDATE', { 
      game_id, 
      name: 'Simulated Game', 
      platform: 'steam',
      app_id: '730', // CS2
      version: 'v2.0',
      size_mb: 25000
    });
    res.json({ success: true, message: 'Update triggered (mock).', mock: true });
  }
});

// POST /games/progress — PC reports update progress
app.post('/games/progress', async (req, res) => {
  const { client_id, game_id, progress, status, version } = req.body;
  // In a real system, you'd update client_games table and broadcast progress to Admin Dashboard.
  broadcast('UPDATE_PROGRESS', { client_id, game_id, progress, status });
  
  if (status === 'completed' || status === 'up_to_date') {
    try {
      await db.query(`
        UPDATE client_games SET status=$1, installed_version=$2, last_updated=NOW()
        WHERE client_id=$3 AND game_id=$4
      `, [status, version, client_id, game_id]);
    } catch (e) { /* ignore */ }
  }
  res.json({ success: true });
});

// ============================================================
// MOCK DATA HELPERS (used when DB is unavailable)
// ============================================================
function mockUsers() {
  return [
    { user_id: 'u1', name: 'Yash Kumar', email: 'yash@test.com', role: 'customer', phone: '9876543210' },
    { user_id: 'u2', name: 'Priya Singh', email: 'priya@test.com', role: 'customer', phone: '9876543211' },
    { user_id: 'u3', name: 'Rahul Dev', email: 'rahul@test.com', role: 'staff', phone: '9876543212' },
  ];
}

let currentMockDevices = [
  { client_id: 'd1', name: 'PC-01', device_type: 'PC', status: 'online', ip_address: '192.168.1.101', specs: { gpu: 'RTX 4070', ram: '16GB' }, hourly_rate: 60 },
  { client_id: 'd2', name: 'PC-02', device_type: 'PC', status: 'in_use', ip_address: '192.168.1.102', specs: { gpu: 'RTX 4070', ram: '16GB' }, hourly_rate: 60 },
  { client_id: 'd3', name: 'PC-03', device_type: 'PC', status: 'online', ip_address: '192.168.1.103', specs: { gpu: 'RTX 3060', ram: '16GB' }, hourly_rate: 40 },
  { client_id: 'd4', name: 'PC-04', device_type: 'PC', status: 'offline', ip_address: '192.168.1.104', specs: { gpu: 'RTX 3060', ram: '16GB' }, hourly_rate: 40 },
  { client_id: 'd5', name: 'PS5-VIP', device_type: 'PS5', status: 'online', ip_address: '192.168.1.201', specs: { storage: '1TB' }, hourly_rate: 80 },
  { client_id: 'd6', name: 'PC-05', device_type: 'PC', status: 'in_use', ip_address: '192.168.1.105', specs: { gpu: 'RTX 4080', ram: '32GB' }, hourly_rate: 80 },
  { client_id: 'd7', name: 'PC-06', device_type: 'PC', status: 'maintenance', ip_address: '192.168.1.106', specs: { gpu: 'RTX 3070', ram: '16GB' }, hourly_rate: 50 },
];

let currentMockSessions = [];
let currentMockOrders = [];

function mockDevices() {
  return currentMockDevices;
}

function mockGamezones() {
  return [{ gamezone_id: 'gz1', name: 'YP Arena OS Downtown', city: 'Hyderabad', subscription_status: 'active' }];
}

function mockTournaments() {
  return [{ tournament_id: 't1', name: 'YP Arena OS Championship #1', game: 'Valorant', prize_pool: 10000, status: 'upcoming' }];
}

let currentMockPosItems = [
  { pos_id: 'p1', item_name: 'Red Bull', category: 'beverage', price: 120, stock: 50 },
  { pos_id: 'p2', item_name: 'Monster Energy', category: 'beverage', price: 100, stock: 40 },
  { pos_id: 'p3', item_name: '1-Hour Voucher', category: 'voucher', price: 60, stock: 100 },
];

function mockPosItems() {
  return currentMockPosItems;
}

function mockGames() {
  return [
    { game_id: 'c0000000-0000-0000-0000-000000000001', name: 'Valorant', platform: 'epic', app_id: 'valorant', current_version: 'v7.08', size_mb: 35000 },
    { game_id: 'c0000000-0000-0000-0000-000000000002', name: 'Counter-Strike 2', platform: 'steam', app_id: '730', current_version: 'v1.39', size_mb: 42000 },
    { game_id: 'c0000000-0000-0000-0000-000000000003', name: 'Apex Legends', platform: 'steam', app_id: '1172470', current_version: 'v19.1', size_mb: 65000 }
  ];
}

// ============================================================
// BOOKINGS / RESERVATIONS
// ============================================================

// GET /bookings — All upcoming bookings
app.get('/bookings', async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    const result = await db.query(
      `SELECT b.*, u.name as customer_name, c.name as device_name
       FROM bookings b
       JOIN users u ON b.customer_id=u.user_id
       JOIN clients c ON b.client_id=c.client_id
       WHERE c.gamezone_id=$1 AND b.status='confirmed' AND b.start_time > NOW()
       ORDER BY b.start_time ASC`,
      [gamezone_id]
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    res.json({ bookings: mockBookings(), mock: true });
  }
});

// POST /bookings — Create a booking
app.post('/bookings', requireAuth(), async (req, res) => {
  const { client_id, gamezone_id, customer_id, start_time, duration_hours } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO bookings (client_id, gamezone_id, customer_id, start_time, duration_hours, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING *`,
      [client_id, gamezone_id, customer_id, start_time, duration_hours]
    );
    broadcast('BOOKING_CREATED', { booking: result.rows[0] });
    res.status(201).json({ booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /bookings/:id — Cancel booking
app.delete('/bookings/:id', requireAuth(), async (req, res) => {
  try {
    await db.query(`UPDATE bookings SET status='cancelled' WHERE booking_id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

const notifications = []; // In-memory notification queue (replace with DB in production)

// POST /notifications/broadcast — Broadcast message to all PCs
app.post('/notifications/broadcast', requireAuth(['owner', 'staff']), (req, res) => {
  const { message, type = 'info' } = req.body;
  const payload = { type: 'BROADCAST_MESSAGE', message, messageType: type, timestamp: new Date().toISOString() };

  // Send to all connected PC WebSocket clients
  let sent = 0;
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      sent++;
    }
  });

  notifications.push(payload);
  res.json({ success: true, sent_to: sent, message });
});

// GET /notifications — Recent notifications
app.get('/notifications', requireAuth(['owner', 'staff']), (req, res) => {
  res.json({ notifications: notifications.slice(-50) });
});

// POST /notifications/pc/:id — Send message to specific PC
app.post('/notifications/pc/:id', requireAuth(['owner', 'staff']), (req, res) => {
  const { message } = req.body;
  const ws = connectedClients.get(req.params.id);
  if (!ws) return res.status(404).json({ error: 'PC not connected' });
  ws.send(JSON.stringify({ type: 'DIRECT_MESSAGE', message, from: 'Admin' }));
  res.json({ success: true, pc: req.params.id });
});

// ============================================================
// STAFF MANAGEMENT
// ============================================================

// GET /staff — All staff for a gamezone
app.get('/staff', requireAuth(['owner']), async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    const result = await db.query(
      `SELECT u.user_id, u.name, u.email, u.phone, u.created_at, u.is_active
       FROM users u
       WHERE u.role='staff'`,
    );
    res.json({ staff: result.rows });
  } catch (err) {
    res.json({ staff: mockStaff(), mock: true });
  }
});

// POST /staff/invite — Add staff member
app.post('/staff/invite', requireAuth(['owner']), async (req, res) => {
  const { name, email, phone, gamezone_id } = req.body;
  try {
    const hash = await bcrypt.hash('Staff@123', 10); // Temp password
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, 'staff', $4) RETURNING user_id, name, email, role`,
      [name, email, hash, phone]
    );
    res.status(201).json({ staff: result.rows[0], temp_password: 'Staff@123' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REPORTS
// ============================================================

// GET /reports/revenue — Revenue report by date range
app.get('/reports/revenue', requireAuth(['owner']), async (req, res) => {
  const { gamezone_id, from, to } = req.query;
  try {
    const result = await db.query(
      `SELECT 
         DATE(end_time) as date,
         COUNT(*) as sessions,
         SUM(amount) as revenue,
         SUM(duration_minutes) as total_minutes
       FROM sessions
       WHERE status='completed' AND gamezone_id=$1
         AND end_time BETWEEN $2 AND $3
       GROUP BY DATE(end_time)
       ORDER BY date DESC`,
      [gamezone_id, from || 'NOW() - INTERVAL 30 days', to || 'NOW()']
    );
    const totals = result.rows.reduce((acc, r) => ({
      sessions: acc.sessions + parseInt(r.sessions),
      revenue: acc.revenue + parseFloat(r.revenue),
    }), { sessions: 0, revenue: 0 });
    res.json({ report: result.rows, totals });
  } catch (err) {
    const rowsByDate = currentMockSessions
      .filter(s => s.status === 'completed' && s.end_time)
      .reduce((acc, s) => {
        const date = s.end_time.split('T')[0];
        if (!acc[date]) acc[date] = { date, sessions: 0, revenue: 0, total_minutes: 0 };
        acc[date].sessions += 1;
        acc[date].revenue += Number(s.amount || 0);
        acc[date].total_minutes += Number(s.duration_minutes || 0);
        return acc;
      }, {});
    const report = Object.values(rowsByDate).sort((a, b) => b.date.localeCompare(a.date));
    const totals = report.reduce((acc, r) => ({
      sessions: acc.sessions + r.sessions,
      revenue: acc.revenue + r.revenue,
    }), { sessions: 0, revenue: 0 });

    res.json({
      report,
      totals,
      mock: true
    });
  }
});

// GET /reports/top-users — Leaderboard of top spending customers
app.get('/reports/top-users', requireAuth(['owner', 'staff']), async (req, res) => {
  const { gamezone_id, limit = 10 } = req.query;
  try {
    const result = await db.query(
      `SELECT u.name, u.email, COUNT(s.session_id) as sessions, SUM(s.amount) as total_spent
       FROM users u
       JOIN sessions s ON s.customer_id=u.user_id
       WHERE s.gamezone_id=$1 AND s.status='completed'
       GROUP BY u.user_id, u.name, u.email
       ORDER BY total_spent DESC
       LIMIT $2`,
      [gamezone_id, limit]
    );
    res.json({ leaderboard: result.rows });
  } catch (err) {
    res.json({
      leaderboard: [
        { name: 'Yash Kumar', sessions: 34, total_spent: 2040 },
        { name: 'Anjali Rao', sessions: 28, total_spent: 1680 },
        { name: 'Priya Singh', sessions: 22, total_spent: 1320 },
      ],
      mock: true
    });
  }
});

// GET /reports/device-usage — Most/least used devices
app.get('/reports/device-usage', requireAuth(['owner', 'staff']), async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    const result = await db.query(
      `SELECT c.name, c.device_type, COUNT(s.session_id) as total_sessions, SUM(s.amount) as total_revenue,
              COALESCE(SUM(s.duration_minutes), 0) as total_minutes
       FROM clients c
       LEFT JOIN sessions s ON s.client_id=c.client_id AND s.status='completed'
       WHERE c.gamezone_id=$1
       GROUP BY c.client_id, c.name, c.device_type
       ORDER BY total_sessions DESC`,
      [gamezone_id]
    );
    res.json({ devices: result.rows });
  } catch (err) {
    res.json({
      devices: [
        { name: 'PC-01', device_type: 'PC', total_sessions: 89, total_revenue: 5340 },
        { name: 'PC-02', device_type: 'PC', total_sessions: 76, total_revenue: 4560 },
        { name: 'PS5-VIP', device_type: 'PS5', total_sessions: 45, total_revenue: 3600 },
      ],
      mock: true
    });
  }
});

// ============================================================
// REMOTE PC CONTROL (via WebSocket)
// ============================================================

// POST /remote/:pcId/lock — Lock a specific PC
app.post('/remote/:pcId/lock', requireAuth(['owner', 'staff']), (req, res) => {
  const ws = connectedClients.get(req.params.pcId);
  if (!ws) return res.status(404).json({ error: 'PC not connected' });
  ws.send(JSON.stringify({ type: 'REMOTE_LOCK', reason: req.body.reason || 'Admin Lock' }));
  res.json({ success: true, action: 'LOCK', pc: req.params.pcId });
});

// POST /remote/:pcId/unlock — Unlock a specific PC
app.post('/remote/:pcId/unlock', requireAuth(['owner', 'staff']), (req, res) => {
  const ws = connectedClients.get(req.params.pcId);
  if (!ws) return res.status(404).json({ error: 'PC not connected' });
  ws.send(JSON.stringify({ type: 'REMOTE_UNLOCK' }));
  res.json({ success: true, action: 'UNLOCK', pc: req.params.pcId });
});

// POST /remote/lock-all — Lock ALL PCs
app.post('/remote/lock-all', requireAuth(['owner']), (req, res) => {
  let count = 0;
  connectedClients.forEach((ws, pcId) => {
    ws.send(JSON.stringify({ type: 'REMOTE_LOCK', reason: 'Mass Admin Lock' }));
    count++;
  });
  broadcast('MASS_LOCK', { reason: req.body.reason || 'Admin initiated mass lock', count });
  res.json({ success: true, locked: count });
});

// ============================================================
// GAMER FEATURES (PC CLIENT)
// ============================================================

// GET /leaderboard — Top players in the café
app.get('/leaderboard', async (req, res) => {
  const { gamezone_id } = req.query;
  try {
    const result = await db.query(
      `SELECT u.name, m.points, m.tier, m.wallet_balance
       FROM memberships m
       JOIN users u ON m.user_id=u.user_id
       WHERE m.gamezone_id=$1
       ORDER BY m.points DESC LIMIT 10`,
      [gamezone_id || 'b0000000-0000-0000-0000-000000000001']
    );
    res.json({ leaderboard: result.rows });
  } catch (err) {
    res.json({
      leaderboard: [
        { name: 'Yash Kumar', points: 15400, tier: 'platinum' },
        { name: 'Priya Singh', points: 12200, tier: 'gold' },
        { name: 'Rahul Dev', points: 9800, tier: 'silver' },
        { name: 'GamerX', points: 8500, tier: 'bronze' },
        { name: 'NinjaPlays', points: 7200, tier: 'bronze' },
      ],
      mock: true
    });
  }
});

// POST /promocodes/redeem — Redeem a promo code
app.post('/promocodes/redeem', requireAuth(), async (req, res) => {
  const { code, gamezone_id } = req.body;
  const user_id = req.user.user_id;

  // Extremely simplified promo code logic for demo
  const codes = {
    'WELCOME50': { amount: 50, type: 'wallet' },
    'GAMERVIP': { amount: 200, type: 'wallet' }
  };

  const promo = codes[code.toUpperCase()];
  if (!promo) return res.status(400).json({ error: 'Invalid or expired promo code' });

  try {
    // Add to wallet
    await db.query(
      `UPDATE memberships SET wallet_balance = wallet_balance + $1, updated_at=NOW()
       WHERE user_id=$2 AND gamezone_id=$3`,
      [promo.amount, user_id, gamezone_id || 'b0000000-0000-0000-0000-000000000001']
    );
    
    // Add payment record
    await db.query(
      `INSERT INTO payments (user_id, gamezone_id, amount, method, status, description)
       VALUES ($1, $2, $3, 'wallet', 'success', $4)`,
      [user_id, gamezone_id || 'b0000000-0000-0000-0000-000000000001', promo.amount, `Promo Code: ${code}`]
    );

    const balanceRes = await db.query(
      'SELECT wallet_balance FROM memberships WHERE user_id=$1 AND gamezone_id=$2',
      [user_id, gamezone_id || 'b0000000-0000-0000-0000-000000000001']
    );

    res.json({ success: true, added: promo.amount, new_balance: balanceRes.rows[0]?.wallet_balance });
  } catch (err) {
    res.json({ success: true, added: promo.amount, new_balance: 550, mock: true });
  }
});

// ============================================================
// MOCK HELPERS (extended)
// ============================================================
function mockBookings() {
  return [
    { booking_id: 'b1', customer_name: 'Yash Kumar', device_name: 'PC-01', start_time: new Date(Date.now() + 3600000).toISOString(), duration_hours: 2 },
    { booking_id: 'b2', customer_name: 'Priya Singh', device_name: 'PS5-VIP', start_time: new Date(Date.now() + 7200000).toISOString(), duration_hours: 1 },
  ];
}

function mockStaff() {
  return [
    { user_id: 's1', name: 'Rahul Dev', email: 'rahul@staff.com', phone: '9876543212', is_active: true },
    { user_id: 's2', name: 'Pooja Sharma', email: 'pooja@staff.com', phone: '9876543213', is_active: true },
  ];
}

function mockRevenueReport() {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    sessions: Math.floor(Math.random() * 20) + 5,
    revenue: Math.floor(Math.random() * 3000) + 1000,
    total_minutes: Math.floor(Math.random() * 1200) + 300,
  }));
}

// ============================================================
// START SERVER
// ============================================================
const dgram = require('dgram');

function startUdpBroadcast() {
  const udpClient = dgram.createSocket('udp4');
  const broadcastPort = 41234;
  const broadcastAddress = '255.255.255.255';
  
  udpClient.bind(() => {
    udpClient.setBroadcast(true);
    
    setInterval(() => {
      try {
        const payload = JSON.stringify({
          serverName: 'YP Arena OS Edge Server',
          port: PORT
        });
        
        udpClient.send(payload, broadcastPort, broadcastAddress, (err) => {
          if (err) {
            // Silently ignore broadcast sending errors
          }
        });
      } catch (err) {
        console.error('[UDP] Broadcast failed:', err.message);
      }
    }, 3000);
    
    console.log(`[UDP] Auto-discovery beacon active on port ${broadcastPort}`);
  });
  
  udpClient.on('error', (err) => {
    console.error('[UDP] Socket error:', err.message);
  });
}

initDb().then(async () => {
  // Validate license on boot
  await verifyLicense();
  startLicenseHeartbeat();

  server.listen(PORT, () => {
    startUdpBroadcast();
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   YP Arena OS Edge Server v2.0 Online    ║`);
    console.log(`╠══════════════════════════════════════════╣`);
    console.log(`║  REST API  →  http://localhost:${PORT}       ║`);
    console.log(`║  WebSocket →  ws://localhost:${PORT}         ║`);
    console.log(`║  Health    →  /health                    ║`);
    console.log(`╠══════════════════════════════════════════╣`);
    console.log(`║  NEW ROUTES:                             ║`);
    console.log(`║  POST /notifications/broadcast           ║`);
    console.log(`║  GET  /bookings  POST /bookings          ║`);
    console.log(`║  GET  /staff     POST /staff/invite      ║`);
    console.log(`║  GET  /reports/revenue                   ║`);
    console.log(`║  GET  /reports/top-users                 ║`);
    console.log(`║  POST /remote/:pcId/lock|unlock          ║`);
    console.log(`║  POST /remote/lock-all                   ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
  });
});
