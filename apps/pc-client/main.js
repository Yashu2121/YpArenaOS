const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const dgram = require('dgram');
const fs = require('fs');
const watchdog = require('./watchdog');
const launcher = require('./launcher');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'connection.json');
let discoveredServerUrl = '';

function getCachedServerUrl() {
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.serverUrl) {
        return config.serverUrl;
      }
    } catch (e) {
      console.error('[Config] Failed to read config:', e.message);
    }
  }
  return '';
}

function saveCachedServerUrl(url) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ serverUrl: url }, null, 2), 'utf8');
    console.log('[Config] Saved server URL:', url);
  } catch (e) {
    console.error('[Config] Failed to save config:', e.message);
  }
}

function startUdpDiscovery() {
  const udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const listenPort = 41234;
  
  udpServer.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.serverName === 'YP Arena OS Edge Server') {
        const ip = rinfo.address;
        const port = data.port || 4000;
        
        const cleanIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
        const serverUrl = `http://${cleanIp}:${port}`;
        
        if (serverUrl !== discoveredServerUrl) {
          discoveredServerUrl = serverUrl;
          console.log(`[UDP Discovery] Server discovered at ${serverUrl}`);
          saveCachedServerUrl(serverUrl);
          
          if (mainWindow) {
            mainWindow.webContents.send('server-discovered', serverUrl);
          }
        }
      }
    } catch (e) {
      // Ignore packet parse errors
    }
  });

  udpServer.on('error', (err) => {
    console.error('[UDP Discovery] Listener error:', err.message);
  });

  udpServer.bind(listenPort, '0.0.0.0', () => {
    console.log(`[UDP Discovery] Listening for server broadcast on port ${listenPort}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    kiosk: true,        
    fullscreen: true,   
    alwaysOnTop: true,  
    frame: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    type: 'toolbar', // Helps keep it above other windows
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false 
    }
  });

  // Since we are using Vite, we load localhost in dev mode
  // In production, we would load the built index.html
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Prevent closing the window via Alt+F4 or Taskbar
  mainWindow.on('close', (e) => {
    e.preventDefault();
  });
}

app.whenReady().then(() => {
  startUdpDiscovery();
  createWindow();
  watchdog.startWatchdog(); // Start the process killer

  // IPC configuration queries
  ipcMain.on('get-server-url', (event) => {
    const cached = getCachedServerUrl();
    event.returnValue = cached || discoveredServerUrl || 'http://localhost:4000';
  });

  ipcMain.on('save-server-url', (event, url) => {
    saveCachedServerUrl(url);
    discoveredServerUrl = url;
    event.reply('server-url-saved', true);
  });

  // Admin Override to unlock PC (Ctrl + Alt + L)
  globalShortcut.register('CommandOrControl+Alt+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('admin-unlock-triggered');
      watchdog.setLockdownState(false); // Pause lockdown for admin
    }
  });
  
  // Tournament Mode Override (Ctrl + Alt + T)
  globalShortcut.register('CommandOrControl+Alt+T', () => {
    if (mainWindow) {
      mainWindow.webContents.send('tournament-mode-activated');
    }
  });

  // Block common exit shortcuts that might bypass kiosk
  globalShortcut.register('CommandOrControl+W', () => {});
  globalShortcut.register('CommandOrControl+Q', () => {});
  globalShortcut.register('Alt+F4', () => {}); 

});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC listeners from React frontend
ipcMain.on('unlock-pc', () => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.minimize(); // Hide overlay, reveal desktop/games
    // Note: Watchdog stays active to prevent browsers while gaming
  }
});

ipcMain.on('lock-pc', () => {
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    watchdog.setLockdownState(true); // Re-enable lockdown if admin left
  }
});

// Steam / Epic Launcher Handler
ipcMain.on('trigger-cli-update', (e, { platform, appId }) => {
  console.log(`[IPC] Received update trigger for ${platform}:${appId}`);
  
  launcher.updateGame(platform, appId, 
    (prog) => {
      if (mainWindow) mainWindow.webContents.send('cli-update-progress', prog);
    },
    (success) => {
      if (mainWindow) mainWindow.webContents.send('cli-update-complete', success);
    }
  );
});
