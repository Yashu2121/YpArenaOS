const { exec } = require('child_process');

// The list of executables we do not want the customer to run
const BLACKLIST = [
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  'Taskmgr.exe',
  'SystemSettings.exe',
  'cmd.exe',
  'powershell.exe',
  'mmc.exe',
  'Control.exe'
];

let watchdogInterval = null;
let isLockedDown = true; // Default to locked down

function startWatchdog() {
  if (watchdogInterval) return;
  console.log('[WATCHDOG] Started OS Lockdown');
  
  watchdogInterval = setInterval(() => {
    if (!isLockedDown) return;

    // Use tasklist to find running processes
    exec('tasklist /fo csv /nh', { windowsHide: true }, (err, stdout) => {
      if (err) return;
      
      const runningProcesses = stdout.split('\n')
        .map(line => line.split(',')[0]?.replace(/"/g, '').toLowerCase())
        .filter(Boolean);

      BLACKLIST.forEach(app => {
        if (runningProcesses.includes(app.toLowerCase())) {
          console.log(`[WATCHDOG] Unauthorized app detected! Killing ${app}...`);
          exec(`taskkill /F /IM ${app}`, { windowsHide: true }, (kErr) => {
            if (!kErr) console.log(`[WATCHDOG] Terminated ${app}`);
          });
        }
      });
    });
  }, 2000); // Check every 2 seconds
}

function stopWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    console.log('[WATCHDOG] Stopped OS Lockdown');
  }
}

function setLockdownState(state) {
  isLockedDown = state;
  console.log(`[WATCHDOG] Lockdown state set to: ${state}`);
}

module.exports = {
  startWatchdog,
  stopWatchdog,
  setLockdownState
};
