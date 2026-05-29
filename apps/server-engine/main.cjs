const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const machineId = require('node-machine-id');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_yparenaos';
const PORT = process.env.PORT || 5000;

// Initialize Express API Server
const serverApp = express();
serverApp.use(cors());
serverApp.use(express.json());

// Server state
let serverRunning = false;
let licenseStatus = { status: 'expired', expiresAt: null };
let connectedClients = [];

serverApp.get('/api/status', (req, res) => {
  if (licenseStatus.status !== 'active' && licenseStatus.status !== 'trial') {
    return res.status(403).json({ error: 'Server Locked - License Expired' });
  }
  res.json({ status: 'online', clients: connectedClients.length });
});

// Setup Window
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "YpArenaos Server Control Panel"
  });

  mainWindow.setMenuBarVisibility(false);

  // Load the Vite dev server in development, or local files in production
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// IPC Handlers
ipcMain.handle('get-hardware-id', async () => {
  try {
    const id = await machineId.machineId();
    return id;
  } catch (error) {
    return 'UNKNOWN_HWID';
  }
});

ipcMain.handle('start-server', async (event, token) => {
  if (!serverRunning) {
    serverApp.listen(PORT, () => {
      console.log(`Express API running on port ${PORT}`);
      serverRunning = true;
    });
    return { success: true, port: PORT };
  }
  return { success: true, alreadyRunning: true };
});

ipcMain.handle('update-license', (event, status) => {
  licenseStatus = status;
  return { success: true };
});

ipcMain.handle('get-connected-clients', () => {
  return connectedClients;
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
