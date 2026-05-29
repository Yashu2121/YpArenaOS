const { app, BrowserWindow } = require('electron');
const path = require('path');
const serve = require('electron-serve');

// We use electron-serve to serve the static exported Next.js files locally
const loadURL = serve({ directory: 'out' });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: "YP Arena OS Administrator"
  });

  mainWindow.setMenuBarVisibility(false);

  if (app.isPackaged) {
    loadURL(mainWindow);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
