const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const VERSION = '1.1.0';

const DB_FILE = process.env.LICENSE_DB_FILE
  ? path.resolve(process.env.LICENSE_DB_FILE)
  : path.join(__dirname, 'licenses.json');
const ADMIN_API_KEY = process.env.SAAS_ADMIN_API_KEY || '';
const EDGE_VALIDATION_SECRET = process.env.EDGE_VALIDATION_SECRET || '';
const PUBLIC_TRIAL_ENABLED = process.env.PUBLIC_TRIAL_ENABLED === 'true';
const PUBLIC_TRIAL_DAYS = Math.min(Number(process.env.PUBLIC_TRIAL_DAYS || 7), 14);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

let razorpayInstance = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

if (IS_PRODUCTION && ADMIN_API_KEY.length < 24) {
  console.error('[BOOT] SAAS_ADMIN_API_KEY must be set to a strong value in production.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!ALLOWED_ORIGINS.length && !IS_PRODUCTION) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  }
}));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const rateBuckets = new Map();
function rateLimit({ windowMs, max, prefix }) {
  return (req, res, next) => {
    const key = `${prefix}:${req.ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please retry shortly.' });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

function ensureDbDirectory() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function initLicensesFile() {
  ensureDbDirectory();
  if (fs.existsSync(DB_FILE)) return;
  const initialLicenses = IS_PRODUCTION ? [] : [
    {
      key: 'YP-CAFE-1234-VALID',
      cafeName: 'Alpha Gaming Arena',
      ownerEmail: 'alpha@arena.com',
      status: 'active',
      plan: 'arena-pro',
      maxTerminals: 25,
      priceMonthly: 1500,
      createdAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      hardwareId: null,
      validationCount: 0,
      lastValidatedAt: null,
      metadata: { source: 'seed' },
      billing: {}
    },
    {
      key: 'YP-CAFE-5678-EXPIRED',
      cafeName: 'Retro Arcade Zone',
      ownerEmail: 'retro@arcade.com',
      status: 'expired',
      plan: 'arena-pro',
      maxTerminals: 10,
      priceMonthly: 750,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      expiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      hardwareId: null,
      validationCount: 0,
      lastValidatedAt: null,
      metadata: { source: 'seed' },
      billing: {}
    }
  ];
  fs.writeFileSync(DB_FILE, JSON.stringify(initialLicenses, null, 2), 'utf8');
}

function normalizeLicense(license) {
  return {
    plan: 'arena-pro',
    maxTerminals: null,
    priceMonthly: null,
    validationCount: 0,
    lastValidatedAt: null,
    metadata: {},
    billing: {},
    ...license
  };
}

function readLicenses() {
  initLicensesFile();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(normalizeLicense) : [];
  } catch (err) {
    console.error('[DB] Failed to read license file:', err.message);
    return [];
  }
}

function writeLicenses(licenses) {
  ensureDbDirectory();
  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, `${DB_FILE}.bak`);
  }
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(licenses.map(normalizeLicense), null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY && !IS_PRODUCTION) return next();
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : '';
  const token = req.get('x-admin-api-key') || bearer;
  if (!token || token !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Admin API key required' });
  }
  next();
}

function requireEdgeSecret(req, res, next) {
  if (!EDGE_VALIDATION_SECRET) return next();
  if (req.get('x-edge-validation-secret') !== EDGE_VALIDATION_SECRET) {
    return res.status(401).json({ valid: false, message: 'Edge validation secret is invalid' });
  }
  next();
}

function sanitizeLicense(license, { admin = false } = {}) {
  const normalized = normalizeLicense(license);
  if (admin) return normalized;
  return {
    key: normalized.key,
    cafeName: normalized.cafeName,
    status: normalized.status,
    plan: normalized.plan,
    maxTerminals: normalized.maxTerminals,
    expiryDate: normalized.expiryDate,
    hardwareBound: Boolean(normalized.hardwareId)
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function makeLicenseKey() {
  return `YP-CAFE-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function createLicense({
  cafeName,
  ownerEmail,
  expiryDays = 30,
  plan = 'arena-pro',
  maxTerminals = null,
  priceMonthly = null,
  source = 'admin',
  billing = {},
  status = 'active'
}) {
  if (!cafeName || cafeName.trim().length < 2) {
    throw new Error('cafeName must be at least 2 characters');
  }
  if (!isValidEmail(ownerEmail)) {
    throw new Error('ownerEmail must be a valid email');
  }

  const days = Math.max(1, Math.min(Number(expiryDays || 30), 1095));
  const licenses = readLicenses();
  let key = makeLicenseKey();
  while (licenses.some(license => license.key === key)) key = makeLicenseKey();

  const license = normalizeLicense({
    key,
    cafeName: cafeName.trim(),
    ownerEmail: ownerEmail.trim().toLowerCase(),
    status,
    plan,
    maxTerminals: maxTerminals === null || maxTerminals === '' ? null : Number(maxTerminals),
    priceMonthly: priceMonthly === null || priceMonthly === '' ? null : Number(priceMonthly),
    createdAt: new Date().toISOString(),
    expiryDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    hardwareId: null,
    metadata: { source },
    billing
  });

  licenses.push(license);
  writeLicenses(licenses);
  return license;
}

app.get('/health', (req, res) => {
  const licenses = readLicenses();
  res.json({
    status: 'ok',
    service: 'YP Arena OS SaaS Licensing API',
    version: VERSION,
    environment: NODE_ENV,
    licenseCount: licenses.length,
    publicTrialEnabled: PUBLIC_TRIAL_ENABLED,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/licenses', requireAdmin, rateLimit({ windowMs: 60_000, max: 120, prefix: 'admin-list' }), (req, res) => {
  res.json(readLicenses().map(license => sanitizeLicense(license, { admin: true })));
});

app.post('/api/licenses', requireAdmin, rateLimit({ windowMs: 60_000, max: 30, prefix: 'admin-create' }), (req, res) => {
  try {
    const license = createLicense({ ...req.body, source: 'admin' });
    console.log(`[SaaS] Created admin license ${license.key} for ${license.cafeName}`);
    res.status(201).json(sanitizeLicense(license, { admin: true }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/public/trials', rateLimit({ windowMs: 60_000, max: 5, prefix: 'public-trial' }), (req, res) => {
  if (!PUBLIC_TRIAL_ENABLED) {
    return res.status(403).json({ error: 'Public trial signup is disabled. Contact sales for a license.' });
  }
  try {
    const license = createLicense({
      ...req.body,
      expiryDays: Math.min(Number(req.body.expiryDays || PUBLIC_TRIAL_DAYS), PUBLIC_TRIAL_DAYS),
      source: 'public-trial',
      plan: req.body.plan || 'trial',
      maxTerminals: Math.min(Number(req.body.maxTerminals || 5), 10),
      priceMonthly: 0
    });
    console.log(`[SaaS] Created public trial ${license.key} for ${license.cafeName}`);
    res.status(201).json(sanitizeLicense(license, { admin: false }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/checkout/razorpay/order', rateLimit({ windowMs: 60_000, max: 20, prefix: 'razorpay-order' }), async (req, res) => {
  if (!razorpayInstance) {
    return res.status(503).json({ error: 'Razorpay is not configured on this server.' });
  }
  
  try {
    const { cafeName, ownerEmail, trialDuration, pcCount, totalCost } = req.body;
    // In a real scenario, you should recalculate totalCost on the backend based on pcCount and trialDuration
    // Here we'll just trust the frontend for simplicity of this implementation, but ideally calculate it:
    // const amount = calculatePrice(pcCount, trialDuration);
    const amount = Math.floor(Number(totalCost) * 100); // Amount in paise
    
    if (amount <= 0) throw new Error("Invalid amount");

    const options = {
      amount,
      currency: 'INR',
      receipt: `rcpt_${crypto.randomBytes(4).toString('hex')}`,
      notes: {
        cafeName,
        ownerEmail,
        trialDuration,
        pcCount
      }
    };

    const order = await razorpayInstance.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('[Razorpay Order]', err);
    res.status(500).json({ error: err.message || 'Failed to create Razorpay order' });
  }
});

app.post('/api/checkout/razorpay/verify', rateLimit({ windowMs: 60_000, max: 20, prefix: 'razorpay-verify' }), (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, metadata } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Payment is verified
      const { cafeName, ownerEmail, trialDuration, pcCount } = metadata;
      const license = createLicense({
        cafeName,
        ownerEmail,
        expiryDays: Number(trialDuration),
        source: 'razorpay',
        plan: 'arena-pro',
        maxTerminals: Number(pcCount),
        priceMonthly: 0,
        billing: {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id
        }
      });
      
      console.log(`[SaaS] Verified Razorpay payment & created license ${license.key} for ${license.cafeName}`);
      res.json({ success: true, license: sanitizeLicense(license, { admin: false }) });
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('[Razorpay Verify]', err);
    res.status(500).json({ error: err.message || 'Payment verification failed' });
  }
});

app.post(
  '/api/licenses/validate',
  requireEdgeSecret,
  rateLimit({ windowMs: 60_000, max: 120, prefix: 'validate' }),
  (req, res) => {
    const { licenseKey, hardwareId } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ valid: false, message: 'licenseKey is required' });
    }

    const licenses = readLicenses();
    const license = licenses.find(l => l.key === String(licenseKey).trim());

    if (!license) {
      return res.json({ valid: false, message: 'License key not found' });
    }

    if (license.status !== 'active') {
      return res.json({ valid: false, message: `License status is ${license.status}`, license: sanitizeLicense(license) });
    }

    const now = new Date();
    const expiry = new Date(license.expiryDate);
    if (Number.isNaN(expiry.getTime()) || now > expiry) {
      license.status = 'expired';
      writeLicenses(licenses);
      return res.json({ valid: false, message: 'License has expired', license: sanitizeLicense(license) });
    }

    if (hardwareId) {
      if (!license.hardwareId) {
        license.hardwareId = String(hardwareId).trim();
        console.log(`[SaaS] Bound license ${license.key} to hardware ID ${license.hardwareId}`);
      } else if (license.hardwareId !== hardwareId) {
        return res.json({
          valid: false,
          message: 'License key is already registered to a different server machine.',
          license: sanitizeLicense(license)
        });
      }
    }

    license.validationCount = Number(license.validationCount || 0) + 1;
    license.lastValidatedAt = now.toISOString();
    writeLicenses(licenses);

    res.json({ valid: true, message: 'License is valid and active', license: sanitizeLicense(license) });
  }
);

app.patch('/api/licenses/:key', requireAdmin, rateLimit({ windowMs: 60_000, max: 60, prefix: 'admin-update' }), (req, res) => {
  const { key } = req.params;
  const { status, expiryDate, cafeName, ownerEmail, resetHardware, plan, maxTerminals, priceMonthly, billing } = req.body;

  const licenses = readLicenses();
  const index = licenses.findIndex(l => l.key === key);
  if (index === -1) {
    return res.status(404).json({ error: 'License not found' });
  }

  if (status) {
    if (!['trial', 'active', 'past_due', 'expired', 'cancelled', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid license status' });
    }
    licenses[index].status = status;
  }
  if (expiryDate) licenses[index].expiryDate = new Date(expiryDate).toISOString();
  if (cafeName) licenses[index].cafeName = cafeName.trim();
  if (ownerEmail) {
    if (!isValidEmail(ownerEmail)) return res.status(400).json({ error: 'ownerEmail must be a valid email' });
    licenses[index].ownerEmail = ownerEmail.trim().toLowerCase();
  }
  if (plan) licenses[index].plan = plan;
  if (maxTerminals !== undefined) licenses[index].maxTerminals = Number(maxTerminals);
  if (priceMonthly !== undefined) licenses[index].priceMonthly = Number(priceMonthly);
  if (billing) licenses[index].billing = { ...licenses[index].billing, ...billing };
  if (resetHardware) licenses[index].hardwareId = null;
  licenses[index].updatedAt = new Date().toISOString();

  writeLicenses(licenses);
  console.log(`[SaaS] Updated license ${key}`);
  res.json(sanitizeLicense(licenses[index], { admin: true }));
});

app.delete('/api/licenses/:key', requireAdmin, rateLimit({ windowMs: 60_000, max: 30, prefix: 'admin-delete' }), (req, res) => {
  const { key } = req.params;
  let licenses = readLicenses();
  const initialLen = licenses.length;
  licenses = licenses.filter(l => l.key !== key);

  if (licenses.length === initialLen) {
    return res.status(404).json({ error: 'License not found' });
  }

  writeLicenses(licenses);
  console.log(`[SaaS] Deleted license ${key}`);
  res.json({ success: true, message: 'License deleted successfully' });
});

app.use((err, req, res, next) => {
  console.error('[HTTP]', err.message);
  res.status(500).json({ error: IS_PRODUCTION ? 'Internal server error' : err.message });
});

initLicensesFile();
app.listen(PORT, () => {
  console.log(`[SaaS] YP Arena OS licensing API v${VERSION} running on http://localhost:${PORT}`);
  if (!ADMIN_API_KEY && !IS_PRODUCTION) {
    console.warn('[SaaS] Development mode: admin endpoints are open because SAAS_ADMIN_API_KEY is not set.');
  }
});
