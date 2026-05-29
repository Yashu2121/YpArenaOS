const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'licenses.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Licenses file if not exists
function initLicensesFile() {
  if (!fs.existsSync(DB_FILE)) {
    const initialLicenses = [
      {
        key: 'YP-CAFE-1234-VALID',
        cafeName: 'Alpha Gaming Arena',
        ownerEmail: 'alpha@arena.com',
        status: 'active',
        createdAt: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        hardwareId: null
      },
      {
        key: 'YP-CAFE-5678-EXPIRED',
        cafeName: 'Retro Arcade Zone',
        ownerEmail: 'retro@arcade.com',
        status: 'expired',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        expiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Expired 30 days ago
        hardwareId: null
      }
    ];
    fs.writeFileSync(DB_FILE, JSON.stringify(initialLicenses, null, 2));
  }
}
initLicensesFile();

// Helper to read licenses
function readLicenses() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Helper to write licenses
function writeLicenses(licenses) {
  fs.writeFileSync(DB_FILE, JSON.stringify(licenses, null, 2));
}

// API: Get all licenses
app.get('/api/licenses', (req, res) => {
  res.json(readLicenses());
});

// API: Create new license key
app.post('/api/licenses', (req, res) => {
  const { cafeName, ownerEmail, expiryDays = 30 } = req.body;
  if (!cafeName || !ownerEmail) {
    return res.status(400).json({ error: 'cafeName and ownerEmail are required' });
  }

  const licenses = readLicenses();
  const rawUuid = uuidv4().toUpperCase().split('-');
  const key = `YP-CAFE-${rawUuid[0]}-${rawUuid[1]}`;

  const newLicense = {
    key,
    cafeName,
    ownerEmail,
    status: 'active',
    createdAt: new Date().toISOString(),
    expiryDate: new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000).toISOString(),
    hardwareId: null
  };

  licenses.push(newLicense);
  writeLicenses(licenses);

  console.log(`[SaaS Server] Generated new license for ${cafeName}: ${key}`);
  res.status(201).json(newLicense);
});

// API: Validate license key (Called by Edge Server)
app.post('/api/licenses/validate', (req, res) => {
  const { licenseKey, hardwareId } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ error: 'licenseKey is required' });
  }

  const licenses = readLicenses();
  const license = licenses.find(l => l.key === licenseKey);

  if (!license) {
    return res.json({ valid: false, message: 'License key not found' });
  }

  // Check status
  if (license.status !== 'active') {
    return res.json({ valid: false, message: `License status is ${license.status}`, license });
  }

  // Check expiration date
  const now = new Date();
  const expiry = new Date(license.expiryDate);
  if (now > expiry) {
    license.status = 'expired';
    writeLicenses(licenses);
    return res.json({ valid: false, message: 'License has expired', license });
  }

  // Bind hardwareId if not already bound, or verify it matches
  if (hardwareId) {
    if (!license.hardwareId) {
      license.hardwareId = hardwareId;
      writeLicenses(licenses);
      console.log(`[SaaS Server] Bound license ${licenseKey} to hardware ID: ${hardwareId}`);
    } else if (license.hardwareId !== hardwareId) {
      return res.json({ 
        valid: false, 
        message: 'License key is already registered to a different server machine.', 
        license 
      });
    }
  }

  res.json({ valid: true, message: 'License is valid and active', license });
});

// API: Update license status or details
app.patch('/api/licenses/:key', (req, res) => {
  const { key } = req.params;
  const { status, expiryDate, cafeName, ownerEmail, resetHardware } = req.body;

  const licenses = readLicenses();
  const index = licenses.findIndex(l => l.key === key);

  if (index === -1) {
    return res.status(404).json({ error: 'License not found' });
  }

  if (status) licenses[index].status = status;
  if (expiryDate) licenses[index].expiryDate = new Date(expiryDate).toISOString();
  if (cafeName) licenses[index].cafeName = cafeName;
  if (ownerEmail) licenses[index].ownerEmail = ownerEmail;
  if (resetHardware) licenses[index].hardwareId = null;

  writeLicenses(licenses);
  console.log(`[SaaS Server] Updated license ${key}`);
  res.json(licenses[index]);
});

// API: Delete a license
app.delete('/api/licenses/:key', (req, res) => {
  const { key } = req.params;
  let licenses = readLicenses();
  const initialLen = licenses.length;
  licenses = licenses.filter(l => l.key !== key);
  
  if (licenses.length === initialLen) {
    return res.status(404).json({ error: 'License not found' });
  }

  writeLicenses(licenses);
  console.log(`[SaaS Server] Deleted license ${key}`);
  res.json({ success: true, message: 'License deleted successfully' });
});

app.listen(PORT, () => {
  console.log(`[SaaS Central Server] Running on http://localhost:${PORT}`);
});
