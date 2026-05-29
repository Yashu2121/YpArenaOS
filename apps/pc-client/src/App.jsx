import { useState, useEffect, useRef } from 'react';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

const GAMES = [
  { id: 1, name: 'Valorant',        icon: '🎯', genre: 'Tactical Shooter',  color: '#FF4655' },
  { id: 2, name: 'BGMI',            icon: '🪖', genre: 'Battle Royale',      color: '#FFB800' },
  { id: 3, name: 'Free Fire',       icon: '🔥', genre: 'Battle Royale',      color: '#FF5722' },
  { id: 4, name: 'Minecraft',       icon: '⛏️',  genre: 'Sandbox',            color: '#4CAF50' },
  { id: 5, name: 'GTA V',           icon: '🚗', genre: 'Open World',         color: '#2196F3' },
  { id: 6, name: 'FIFA 24',         icon: '⚽', genre: 'Sports',             color: '#00E5FF' },
  { id: 7, name: 'CS2',             icon: '💣', genre: 'FPS',                color: '#FF9800' },
  { id: 8, name: 'Fortnite',        icon: '🏗️', genre: 'Battle Royale',      color: '#9C27B0' },
  { id: 9, name: 'Apex Legends',    icon: '⚡', genre: 'Battle Royale',      color: '#CF6679' },
  { id: 10, name: 'Street Fighter', icon: '🥊', genre: 'Fighting',           color: '#FF5252' },
  { id: 11, name: 'Rocket League',  icon: '🚀', genre: 'Sports',             color: '#00BCD4' },
  { id: 12, name: 'Among Us',       icon: '🛸', genre: 'Social Deduction',   color: '#C62828' },
];

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [isConnected, setIsConnected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [manualIp, setManualIp] = useState('');
  const [testStatus, setTestStatus] = useState(''); // '' | 'testing' | 'success' | 'failed'

  const [view, setView]     = useState('login'); // 'login' | 'smartdisk' | 'session' | 'updating'
  const [loginMode, setLoginMode] = useState('membership');
  const [sessionTab, setSessionTab] = useState('games'); // 'games' | 'store' | 'stats' | 'leaderboard'
  const [username, setUsername] = useState('');
  const [pin, setPin]       = useState('');
  const [guestTicket, setGuestTicket] = useState('');
  const [error, setError]   = useState('');
  const [wsStatus, setWsStatus] = useState('offline');
  const [lowBalanceWarning, setLowBalanceWarning] = useState(false);
  const [sessionData, setSessionData] = useState({
    user: '', balance: 0, secondsRemaining: 0, type: '',
    pointsEarned: 0, gamesPlayed: []
  });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const updateTimerRef = useRef(null);

  // ── Auto-Discovery & Connection Verification on Startup ──
  useEffect(() => {
    const cachedUrl = ipcRenderer ? ipcRenderer.sendSync('get-server-url') : 'http://localhost:4000';
    setServerUrl(cachedUrl);
    setManualIp(cachedUrl.replace(/^http:\/\//, '').split(':')[0]);

    async function verifyInitialConnection() {
      try {
        const res = await fetch(`${cachedUrl}/health`);
        if (res.ok) {
          setIsConnected(true);
          setIsVerifying(false);
          return;
        }
      } catch (e) {
        // Retry shortly in case network or server is booting
      }

      setTimeout(async () => {
        try {
          const res = await fetch(`${cachedUrl}/health`);
          if (res.ok) {
            setIsConnected(true);
          } else {
            setIsConnected(false);
          }
        } catch (e) {
          setIsConnected(false);
        } finally {
          setIsVerifying(false);
        }
      }, 2000);
    }

    verifyInitialConnection();
  }, []);

  // ── Listen for Server Auto-Discovery from Electron ──
  useEffect(() => {
    if (!ipcRenderer) return;

    const handleDiscovered = async (event, url) => {
      console.log('[Auto-Discovery] Detected server broadcast at:', url);
      try {
        const res = await fetch(`${url}/health`);
        if (res.ok) {
          setServerUrl(url);
          setIsConnected(true);
          setManualIp(url.replace(/^http:\/\//, '').split(':')[0]);
        }
      } catch (e) {
        // Discovered server offline or unreachable
      }
    };

    ipcRenderer.on('server-discovered', handleDiscovered);
    return () => {
      ipcRenderer.removeListener('server-discovered', handleDiscovered);
    };
  }, []);

  // ── WebSocket ─────────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;
    connectWs();
    return () => wsRef.current?.close();
  }, [serverUrl, isConnected]);

  function connectWs() {
    try {
      const wsProto = serverUrl.replace(/^http/, 'ws');
      const ws = new WebSocket(wsProto);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('online');
        ws.send(JSON.stringify({ type: 'REGISTER_PC', pcId: 'PC-01' }));
      };

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === 'SESSION_STARTED' || data.type === 'SESSION_START') {
          setView('session');
        }
        if (data.event === 'DEVICE_STATUS_UPDATE' && data.data?.status === 'offline') {
          handleLogout();
        }
        if (data.type === 'REMOTE_LOCK' || data.type === 'SESSION_END' || data.event === 'SESSION_ENDED') {
          handleLogout();
        }
        if (data.event === 'TRIGGER_GAME_UPDATE') {
          startGameUpdate(data.data);
        }
      };

      ws.onclose = () => { setWsStatus('offline'); setTimeout(connectWs, 5000); };
      ws.onerror = () => setWsStatus('error');
    } catch (e) { setWsStatus('error'); }
  }

  // ── Session Timer ─────────────────────────────────
  useEffect(() => {
    if (view !== 'session') return;
    timerRef.current = setInterval(() => {
      setSessionData(prev => {
        const next = prev.secondsRemaining - 1;
        if (next <= 0) { clearInterval(timerRef.current); handleLogout(); return prev; }
        if (next === 600) setLowBalanceWarning(true);

        if (next % 30 === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'SESSION_HEARTBEAT', pcId: 'PC-01', userId: prev.user, seconds: next }));
        }

        return { ...prev, secondsRemaining: next };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [view]);

  // ── Auto Game Update via CLI ─────────────────────
  const startGameUpdate = (info) => {
    if (!ipcRenderer) return; // Need Electron
    
    ipcRenderer.send('lock-pc');
    clearInterval(timerRef.current);
    setView('updating');
    setUpdateInfo(info);
    setUpdateProgress(0);

    // Trigger the real CLI tool in Node backend
    ipcRenderer.send('trigger-cli-update', { platform: info.platform || 'steam', appId: info.app_id || 'unknown' });

    // Stream progress back
    const handleProgress = (e, prog) => {
      setUpdateProgress(prog);
    };

    const handleComplete = async (e, success) => {
      ipcRenderer.removeListener('cli-update-progress', handleProgress);
      ipcRenderer.removeListener('cli-update-complete', handleComplete);
      
      // Report completion to edge server
      try {
        await fetch(`${serverUrl}/games/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'd1', // Hardcoded demo PC ID
            game_id: info.game_id,
            progress: 100,
            status: 'up_to_date',
            version: info.version
          })
        });
      } catch (err) {}
      
      setTimeout(() => {
        setView('login');
        setUpdateInfo(null);
      }, 1500);
    };

    ipcRenderer.on('cli-update-progress', handleProgress);
    ipcRenderer.on('cli-update-complete', handleComplete);
  };

  // ── IPC from Electron ─────────────────────────────
  useEffect(() => {
    if (!ipcRenderer) return;
    ipcRenderer.on('admin-unlock-triggered', () => {
      ipcRenderer.send('unlock-pc');
      setSessionData({ user: 'Admin Override', balance: 9999, secondsRemaining: 99999, type: 'admin', pointsEarned: 0, gamesPlayed: [] });
      setView('session');
    });
    ipcRenderer.on('tournament-mode-activated', () => {
      ipcRenderer.send('unlock-pc');
      setSessionData({ user: 'Tournament Match', balance: 0, secondsRemaining: 14400, type: 'tournament', pointsEarned: 0, gamesPlayed: [] });
      setView('session');
    });
  }, []);

  // ── Login via API ─────────────────────────────────
  const handleLogin = async () => {
    if (loginMode === 'membership' && (!username || !pin)) { showError('Please enter username and PIN'); return; }
    if (loginMode === 'guest' && !guestTicket) { showError('Please enter your ticket code'); return; }

    setView('smartdisk');

    try {
      const res = await fetch(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password: pin }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionData({ user: data.user?.name || username, balance: 500.00, secondsRemaining: 5400, type: 'membership', pointsEarned: 0, gamesPlayed: [] });
        setTimeout(() => setView('session'), 1200);
        return;
      }
    } catch (e) {}

    setTimeout(() => {
      if (loginMode === 'membership') {
        setSessionData({ user: username || 'Guest Member', balance: 500.00, secondsRemaining: 5400, type: 'membership', pointsEarned: 0, gamesPlayed: [] });
      } else {
        setSessionData({ user: `Guest-${guestTicket.slice(0, 4)}`, balance: 0, secondsRemaining: 3600, type: 'guest', pointsEarned: 0, gamesPlayed: [] });
      }
      setView('session');
    }, 1200);
  };

  const handleLaunchGame = (game) => {
    setSessionData(prev => ({
      ...prev,
      pointsEarned: prev.pointsEarned + 10,
      gamesPlayed: prev.gamesPlayed.includes(game.name) ? prev.gamesPlayed : [...prev.gamesPlayed, game.name]
    }));
    if (ipcRenderer) ipcRenderer.send('unlock-pc');
    else alert(`Launching ${game.name}...`);
  };

  const handleExtendSession = (hrs = 1, cost = 60) => {
    if (sessionData.balance < cost) { alert('Insufficient balance. Please top up at the front desk.'); return; }
    setSessionData(prev => ({ ...prev, secondsRemaining: prev.secondsRemaining + (hrs * 3600), balance: prev.balance - cost }));
    setLowBalanceWarning(false);
  };

  const handleLogout = () => {
    if (ipcRenderer) ipcRenderer.send('lock-pc');
    clearInterval(timerRef.current);
    setView('login'); setUsername(''); setPin(''); setGuestTicket('');
    setLowBalanceWarning(false);
  };

  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 4000); };

  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  const pct = Math.min(100, (sessionData.secondsRemaining / 5400) * 100);

  if (isVerifying) {
    return (
      <div className="layout-root flex items-center justify-center h-screen bg-[#05070c] relative">
        <div className="ambient-gradient-1" />
        <div className="ambient-gradient-2" />
        <div className="noise-overlay" />
        <div className="glass-modal text-center p-12 rounded-3xl border border-white/5 shadow-2xl relative z-10" style={{ width: '400px', backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.01)' }}>
          <div className="spinner mx-auto mb-8" />
          <h2 className="text-lg font-light tracking-[0.2em] text-white uppercase mb-2">Connecting</h2>
          <p className="text-gray-400 text-xs tracking-wider">Verifying link with Master Server...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="layout-root flex items-center justify-center h-screen bg-[#05070c] relative">
        <div className="ambient-gradient-1" />
        <div className="ambient-gradient-2" />
        <div className="noise-overlay" />
        
        <div className="glass-modal p-12 rounded-3xl border border-white/5 shadow-2xl relative z-10 animate-fade-in" style={{ width: '480px', backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.01)' }}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-light text-white tracking-widest mb-2">
              YP <span className="font-semibold text-blue-400">ARENA OS</span>
            </h1>
            <p className="text-gray-400 text-xs tracking-widest uppercase">Connection Setup</p>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="text-left">
              <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Server Offline</div>
              <div className="text-gray-400 text-[11px] leading-relaxed">
                Could not connect to the YP Arena OS Edge Server. Make sure the Edge Server is running on the Master Server PC.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 text-left">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                Master Server IP Address
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g. 192.168.1.100" 
                  value={manualIp} 
                  onChange={e => {
                    setManualIp(e.target.value);
                    setTestStatus('');
                  }}
                  className="sleek-input flex-1"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: 'white',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                />
                <button 
                  onClick={async () => {
                    if (!manualIp) return;
                    setTestStatus('testing');
                    const targetUrl = `http://${manualIp}:4000`;
                    try {
                      const res = await fetch(`${targetUrl}/health`);
                      if (res.ok) {
                        setTestStatus('success');
                      } else {
                        setTestStatus('failed');
                      }
                    } catch (err) {
                      setTestStatus('failed');
                    }
                  }} 
                  className="px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>

            {testStatus === 'success' && (
              <div className="text-green-400 text-xs font-semibold flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">
                <span>✓</span> Connection verified successfully!
              </div>
            )}
            {testStatus === 'failed' && (
              <div className="text-red-400 text-xs font-semibold flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                <span>✗</span> Connection failed. Please check the IP.
              </div>
            )}

            <button 
              disabled={testStatus !== 'success'}
              onClick={() => {
                const targetUrl = `http://${manualIp}:4000`;
                setServerUrl(targetUrl);
                setIsConnected(true);
                if (ipcRenderer) {
                  ipcRenderer.send('save-server-url', targetUrl);
                }
              }}
              className={`sleek-btn-primary mt-4 py-3 text-xs font-bold uppercase tracking-widest ${testStatus !== 'success' ? 'opacity-50 cursor-not-allowed bg-blue-500/40 text-blue-300' : ''}`}
              style={{
                borderRadius: '12px',
                padding: '14px',
                fontWeight: 800,
                cursor: testStatus === 'success' ? 'pointer' : 'not-allowed',
                border: 'none',
                background: testStatus === 'success' ? '#3B82F6' : 'rgba(59,130,246,0.2)',
                color: testStatus === 'success' ? 'white' : 'rgba(255,255,255,0.4)',
                textAlign: 'center'
              }}
            >
              Save & Connect
            </button>
          </div>

          <div className="mt-8 text-center text-[10px] text-gray-500 tracking-wider uppercase border-t border-white/5 pt-6">
            Searching for local server beacons via UDP...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-root">
      
      {/* Dynamic Background Effects */}
      <div className="ambient-gradient-1" />
      <div className="ambient-gradient-2" />
      <div className="noise-overlay" />

      {/* ── SMARTDISK VERIFY ── */}
      {view === 'smartdisk' && (
        <div className="full-center z-10 w-full h-full">
          <div className="glass-modal animate-fade-in text-center" style={{ width: '420px', padding: '48px' }}>
            <div className="spinner mx-auto mb-8" />
            <h2 className="text-xl font-medium tracking-widest text-white uppercase mb-2">Syncing Workspace</h2>
            <p className="text-gray-400 text-sm tracking-wide">Retrieving cloud licenses & profiles...</p>
          </div>
        </div>
      )}

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <div className="full-center z-10 w-full h-full">
          <div className="glass-modal flex animate-fade-in overflow-hidden" style={{ width: '900px', height: '540px' }}>
            
            {/* Left Brand Panel */}
            <div className="flex flex-col justify-between" style={{ width: '380px', padding: '48px', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <h1 className="text-3xl font-light text-white tracking-widest">
                  YP <span className="font-semibold text-blue-400">ARENA OS</span>
                </h1>
                <p className="text-gray-400 text-xs tracking-widest uppercase mt-4">Enterprise Gaming Kiosk</p>
              </div>
              
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2 h-2 rounded-full ${wsStatus === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-xs text-gray-400 tracking-widest uppercase">System {wsStatus}</span>
                </div>
                <p className="text-gray-500 text-xs tracking-wider">Station: PC-01 (10.0.0.45)</p>
              </div>
            </div>

            {/* Right Login Panel */}
            <div className="flex-1 flex flex-col justify-center" style={{ padding: '48px 64px' }}>
              <h2 className="text-2xl font-light text-white mb-2 tracking-wide">Sign In</h2>
              <p className="text-gray-400 text-sm mb-8">Access your personalized environment.</p>

              {error && <div className="text-red-400 text-sm mb-6 bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</div>}

              {/* Login Tabs */}
              <div className="flex gap-2 mb-8 p-1 rounded-lg bg-black/40 border border-white/5">
                {['membership', 'guest'].map(m => (
                  <button key={m} onClick={() => setLoginMode(m)} className={`flex-1 py-2 text-xs font-medium tracking-widest uppercase rounded-md transition-colors ${loginMode === m ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    {m === 'membership' ? 'Member' : 'Guest'}
                  </button>
                ))}
              </div>

              {loginMode === 'membership' ? (
                <div className="flex flex-col gap-4">
                  <input type="text" placeholder="Username or Email" value={username} onChange={e=>setUsername(e.target.value)} className="sleek-input" />
                  <input type="password" placeholder="Passcode" value={pin} onChange={e=>setPin(e.target.value)} className="sleek-input" />
                  <button onClick={handleLogin} className="sleek-btn-primary mt-4">Initialize Session</button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <input type="text" placeholder="TICKET CODE (e.g. A4B9-XYZ)" value={guestTicket} onChange={e=>setGuestTicket(e.target.value)} className="sleek-input text-center tracking-[0.2em]" />
                  <button onClick={handleLogin} className="sleek-btn-primary mt-4">Start Guest Access</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATING ── */}
      {view === 'updating' && (
        <div className="full-center z-10 w-full h-full">
          <div className="glass-modal animate-fade-in flex flex-col" style={{ width: '600px', padding: '48px', alignItems: 'center' }}>
            <h2 className="text-xl font-medium tracking-widest text-white uppercase mb-2">System Updating</h2>
            <p className="text-gray-400 text-sm tracking-wide mb-2">Installing patch for {updateInfo?.name} ({updateInfo?.version})</p>
            <div className="text-[10px] text-blue-400 uppercase tracking-widest mb-8 border border-blue-400/20 px-2 py-1 rounded bg-blue-500/10">
              Powered by {updateInfo?.platform === 'steam' ? 'SteamCMD' : updateInfo?.platform === 'epic' ? 'Legendary' : 'Standalone'}
            </div>
            
            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/10 relative">
              <div 
                className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                style={{ width: `${updateProgress}%` }}
              />
            </div>
            <div className="w-full flex justify-between mt-3 text-xs tracking-widest text-gray-500 uppercase">
              <span>{Math.round(updateProgress)}%</span>
              <span>{(updateInfo?.size_mb / 1000).toFixed(1)} GB</span>
            </div>
            <div className="mt-8 text-[10px] text-red-400/80 tracking-widest uppercase text-center border border-red-500/20 bg-red-500/10 px-4 py-2 rounded-lg">
              Terminal Locked: Do not power off this machine
            </div>
          </div>
        </div>
      )}

      {/* ── PROFESSIONAL DASHBOARD ── */}
      {view === 'session' && (
        <div className="z-10 w-full h-full flex flex-col p-6 gap-6 animate-fade-in">
          
          {/* Top Navigation Bar */}
          <div className="glass-panel flex justify-between items-center" style={{ padding: '20px 32px', borderRadius: '24px' }}>
            {/* Logo & Nav */}
            <div className="flex items-center gap-12">
              <h1 className="text-2xl font-light text-white tracking-widest">
                YP <span className="font-semibold text-blue-400">ARENA OS</span>
              </h1>
              <div className="flex gap-6">
                {[
                  { id: 'games', label: 'Library' },
                  { id: 'store', label: 'Store' },
                  { id: 'stats', label: 'Analytics' },
                  { id: 'leaderboard', label: 'Leaderboard' }
                ].map(tab => (
                  <button key={tab.id} onClick={() => setSessionTab(tab.id)} className={`text-sm tracking-widest uppercase transition-colors ${sessionTab === tab.id ? 'text-blue-400 font-medium' : 'text-gray-500 hover:text-gray-300'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User & Timer */}
            <div className="flex items-center gap-8">
              {/* Timer */}
              <div className="flex items-center gap-4 border-r border-white/10 pr-8">
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Time Remaining</div>
                  <div className={`font-mono text-xl tracking-wider ${lowBalanceWarning ? 'text-red-400' : 'text-white'}`}>
                    {fmt(sessionData.secondsRemaining)}
                  </div>
                </div>
                {/* Mini progress ring */}
                <div className="relative w-10 h-10">
                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={lowBalanceWarning ? "#F87171" : "#60A5FA"} strokeWidth="3" strokeDasharray={`${pct}, 100`} className="transition-all duration-1000" />
                  </svg>
                </div>
              </div>

              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <div className="text-[11px] text-white tracking-wide font-medium">{sessionData.user}</div>
                  <div className="text-[10px] text-blue-400 uppercase tracking-widest mt-1">Wallet: ₹{sessionData.balance.toFixed(0)}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-medium">
                  {sessionData.user.charAt(0).toUpperCase()}
                </div>
                
                <button onClick={handleLogout} className="ml-4 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="End Session">
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="flex gap-6 flex-1 min-h-0">
            
            {/* Context Sidebar (Left) */}
            <div className="w-[300px] flex flex-col gap-6">
              
              {/* Quick Actions */}
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px' }}>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-6">Quick Actions</h3>
                <div className="flex flex-col gap-3">
                  <button onClick={() => { if(ipcRenderer) ipcRenderer.send('unlock-pc'); }} className="sleek-btn-secondary flex justify-between items-center">
                    <span>Minimize & Play</span>
                    <span className="text-[10px] text-gray-500 border border-white/10 rounded px-1">F11</span>
                  </button>
                  {sessionData.type === 'membership' && (
                    <button onClick={() => handleExtendSession(1, 60)} className="sleek-btn-secondary flex justify-between items-center">
                      <span>Add 1 Hour</span>
                      <span className="text-[10px] text-blue-400">₹60</span>
                    </button>
                  )}
                  <button className="sleek-btn-secondary flex justify-between items-center">
                    <span>Call Staff</span>
                    <span className="text-[16px]">🛎️</span>
                  </button>
                </div>
              </div>

              {/* Promo / Voucher */}
              <div className="glass-panel flex-1" style={{ padding: '24px', borderRadius: '24px' }}>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-6">Vouchers</h3>
                <input id="promoInput" type="text" placeholder="ENTER CODE" className="sleek-input text-center tracking-widest text-sm mb-3" />
                <button onClick={async () => {
                  const code = document.getElementById('promoInput').value;
                  if(!code) return;
                  if(code === 'WELCOME50' || code === 'GAMERVIP') {
                    const added = code === 'WELCOME50' ? 50 : 200;
                    setSessionData(p => ({ ...p, balance: p.balance + added }));
                    alert(`Voucher Applied: ₹${added} added.`);
                  } else { alert('Invalid Code'); }
                }} className="sleek-btn-primary text-xs w-full">Apply Code</button>
              </div>
            </div>

            {/* Dynamic Content Area (Right) */}
            <div className="glass-panel flex-1 flex flex-col min-h-0" style={{ padding: '32px 40px', borderRadius: '24px' }}>
              
              {/* GAMES */}
              {sessionTab === 'games' && (
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-end mb-8">
                    <h2 className="text-2xl font-light text-white tracking-wide">Application Library</h2>
                    <div className="relative">
                      <input type="text" placeholder="Search library..." className="bg-black/30 border border-white/10 rounded-full px-6 py-2 text-sm text-white outline-none focus:border-white/20 w-[250px]" />
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'20px', alignContent: 'start' }}>
                    {GAMES.map(g => (
                      <div key={g.id} onClick={() => handleLaunchGame(g)} className="cursor-pointer group hover:scale-[1.02] transition-transform">
                        <div className="h-[120px] bg-black/40 rounded-t-xl flex items-center justify-center text-5xl">
                          {g.icon}
                        </div>
                        <div className="p-4 bg-white/[0.02] rounded-b-xl border border-t-0 border-white/5 flex flex-col group-hover:bg-white/[0.04]">
                          <span className="text-sm text-white font-medium truncate">{g.name}</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{g.genre}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STORE */}
              {sessionTab === 'store' && (
                <div className="h-full flex flex-col">
                  <h2 className="text-2xl font-light text-white tracking-wide mb-8">Service & POS</h2>
                  <div className="flex-1 overflow-y-auto pr-2" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'20px', alignContent: 'start' }}>
                    {[
                      { id: 'p1', name: 'Red Bull Energy', price: 120, icon: '🥤', cat: 'Beverage' },
                      { id: 'p2', name: 'Monster Energy', price: 110, icon: '⚡', cat: 'Beverage' },
                      { id: 'p3', name: 'Cheese Pizza', price: 250, icon: '🍕', cat: 'Food' },
                      { id: 'p4', name: 'Chicken Burger', price: 180, icon: '🍔', cat: 'Food' },
                      { id: 'p5', name: 'Doritos Nacho', price: 50, icon: '🧀', cat: 'Snack' },
                      { id: 'p6', name: 'Razer Headset Rental', price: 100, icon: '🎧', cat: 'Peripheral' },
                    ].map(item => (
                      <div key={item.id} className="p-5 border border-white/5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex flex-col cursor-pointer">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center text-2xl">{item.icon}</div>
                          <div>
                            <div className="text-sm font-medium text-white">{item.name}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{item.cat}</div>
                          </div>
                        </div>
                        <div className="mt-auto flex justify-between items-center pt-4 border-t border-white/5">
                          <span className="text-sm text-blue-400 font-medium">₹{item.price}</span>
                          <button onClick={() => {
                            if(sessionData.balance < item.price) { alert('Insufficient balance.'); return; }
                            alert('Order requested.'); setSessionData(p => ({ ...p, balance: p.balance - item.price }));
                          }} className="text-[10px] uppercase tracking-widest text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors">
                            Order
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STATS */}
              {sessionTab === 'stats' && (
                <div>
                  <h2 className="text-2xl font-light text-white tracking-wide mb-8">Analytics Overview</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { l: 'Station Node', v: 'PC-01 (10.0.0.45)' },
                      { l: 'Authorization Type', v: sessionData.type.toUpperCase() },
                      { l: 'Applications Initialized', v: sessionData.gamesPlayed.length > 0 ? sessionData.gamesPlayed.join(', ') : 'None' },
                      { l: 'Activity Score', v: `${sessionData.pointsEarned} pts` },
                    ].map(row => (
                      <div key={row.l} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">{row.l}</span>
                        <span className="text-sm text-white font-medium">{row.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LEADERBOARD */}
              {sessionTab === 'leaderboard' && (
                <div className="h-full flex flex-col">
                  <h2 className="text-2xl font-light text-white tracking-wide mb-8">Global Ranking</h2>
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    {[
                      { name: 'Yash Kumar', pts: 15400, tier: 'Platinum' },
                      { name: 'Priya Singh', pts: 12200, tier: 'Gold' },
                      { name: 'Rahul Dev', pts: 9800, tier: 'Silver' },
                      { name: 'GamerX', pts: 8500, tier: 'Bronze' },
                    ].map((p, i) => (
                      <div key={i} className={`flex justify-between items-center p-4 rounded-lg border ${i===0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                        <div className="flex items-center gap-6">
                          <div className={`w-8 text-center text-xs tracking-widest ${i===0 ? 'text-blue-400' : 'text-gray-500'}`}>#{i+1}</div>
                          <div>
                            <div className="text-sm text-white font-medium mb-1">{p.name}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest">{p.tier}</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-300 font-mono">{p.pts.toLocaleString()} pts</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
