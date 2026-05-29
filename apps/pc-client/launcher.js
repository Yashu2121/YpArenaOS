const { spawn } = require('child_process');

/**
 * Executes a game update using the official command-line tools.
 * Since this is a demo, it simulates the CLI output for steamcmd and legendary.
 * In production, this would spawn the actual 'steamcmd.exe' or 'legendary.exe'.
 * 
 * @param {string} platform 'steam' or 'epic'
 * @param {string} appId The ID of the app to update
 * @param {function} onProgress Callback for parsed progress percentages
 * @param {function} onComplete Callback when the CLI exits
 */
function updateGame(platform, appId, onProgress, onComplete) {
  console.log(`[LAUNCHER] Starting update for ${platform} app ${appId}`);

  // In production, we would use:
  // const cmd = platform === 'steam' ? 'steamcmd' : 'legendary';
  // const args = platform === 'steam' 
  //    ? ['+login', 'anonymous', '+app_update', appId, 'validate', '+quit']
  //    : ['update', appId, '-y'];
  // const proc = spawn(cmd, args);

  // ── MOCK CLI SIMULATION ──
  // Simulating the stdout stream of steamcmd / legendary
  let progress = 0;
  
  const timer = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5;
    
    if (progress >= 100) {
      progress = 100;
      clearInterval(timer);
      
      const finishMsg = platform === 'steam' 
        ? `Success! App '${appId}' fully installed.` 
        : `[cli] INFO: ${appId} is up to date`;
        
      console.log(`[LAUNCHER-STDOUT] ${finishMsg}`);
      onProgress(100);
      onComplete(true);
    } else {
      const msg = platform === 'steam'
        ? `Update state (0x61) downloading, progress: ${progress.toFixed(2)} (${(progress * 350).toFixed(0)} / 35000 MB)`
        : `[cli] INFO: Downloading ${appId}... ${progress}%`;
      
      console.log(`[LAUNCHER-STDOUT] ${msg}`);
      
      // We extract the percentage just like we would parse real stdout
      const match = platform === 'steam' 
        ? msg.match(/progress: (\d+)/) 
        : msg.match(/(\d+)%/);
        
      if (match && match[1]) {
        onProgress(parseInt(match[1], 10));
      }
    }
  }, 1000);
}

module.exports = {
  updateGame
};
