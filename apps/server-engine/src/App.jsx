import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Server, Activity, Lock, Unlock, Wifi, Radio, Zap } from 'lucide-react';

const API = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000';

function App() {
  const [view, setView] = useState('connect'); // 'connect' | 'auth' | 'dashboard'
  const [authMode, setAuthMode] = useState('login');
  const [isConnecting, setIsConnecting] = useState(false);
  const [hardwareId, setHardwareId] = useState('');
  const [serverStatus, setServerStatus] = useState('offline');
  const [license, setLicense] = useState({ status: 'expired', expiresAt: null });
  
  const [email, setEmail] = useState('owner@yparenaos.com');
  const [password, setPassword] = useState('admin123');
  const [cafeName, setCafeName] = useState('');
  
  // Real Data
  const [stats, setStats] = useState(null);
  const [wsStatus, setWsStatus] = useState('offline');
  const wsRef = useRef(null);

  useEffect(() => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('get-hardware-id').then(setHardwareId);
    } else {
      setTimeout(() => setHardwareId('HWID-0x9F3B2A'), 0);
    }
  }, []);

  // ─── WEBSOCKET & DATA ───────────────────────────
  function connectWs() {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('online');
        fetchStats();
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === 'DEVICE_STATUS_UPDATE' || msg.event === 'SESSION_STARTED' || msg.event === 'SESSION_ENDED') {
          fetchStats();
        }
      };
      ws.onclose = () => { setWsStatus('offline'); setTimeout(connectWs, 3000); };
      ws.onerror = () => setWsStatus('error');
    } catch { setWsStatus('error'); }
  }

  async function fetchStats() {
    try {
      const r = await fetch(`${API}/stats?gamezone_id=b0000000-0000-0000-0000-000000000001`);
      const data = await r.json();
      setStats(data);
    } catch { console.error('fetchStats error'); }
  }

  // ─── HANDLERS ───────────────────────────────────
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const r = await fetch(`${API}/health`);
      if (r.ok) {
        setIsConnecting(false);
        setView('auth');
      } else {
        throw new Error('Server not ready');
      }
    } catch {
      setIsConnecting(false);
      alert('Edge Server is offline. Please run it first.');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      
      if (r.ok || data.mock) {
        setView('dashboard');
        const newLicense = { status: 'active', expiresAt: new Date(Date.now() + 30 * 86400000).toLocaleDateString() };
        setLicense(newLicense);
        setServerStatus('online');
        connectWs();
      } else {
        alert('Login failed: ' + data.error);
      }
    } catch {
      alert('Network error communicating with Edge Server.');
    }
  };

  const handleBroadcast = async () => {
    const msg = prompt('Enter message to broadcast to all terminals:');
    if (!msg) return;
    try {
      const token = 'MOCK_TOKEN_OR_REAL_JWT'; // Would normally use stored token
      const r = await fetch(`${API}/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: msg, type: 'warning' })
      });
      if (r.ok) alert('Message broadcast sent!');
    } catch { alert('Failed to send broadcast'); }
  };

  const handleLockAll = async () => {
    if (!window.confirm('WARNING: This will lock all PCs immediately. Proceed?')) return;
    try {
      const r = await fetch(`${API}/remote/lock-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer MOCK_TOKEN` },
        body: JSON.stringify({ reason: 'Emergency Lock' })
      });
      if (r.ok) alert('All PCs locked.');
    } catch { alert('Failed to lock PCs'); }
  };

  /* ===== PRE-DASHBOARD SCREENS ===== */
  if (view !== 'dashboard') {
    return (
      <div className="screen">
        <div className="orb orb-cyan" />
        <div className="orb orb-gold" />
        <div className="auth-card glass animate-fade-in">
          <div className="auth-logo">
            <h1>YpArena<span>os</span></h1>
            <p>Core Engine Terminal</p>
          </div>

          {view === 'connect' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="connect-box">
                <div className={`connect-icon ${isConnecting ? 'connecting' : ''}`}>
                  <Wifi size={52} />
                </div>
                <h2>Central Node Link</h2>
                <p>Establish uplink to the cloud authorization server before booting the local edge node.</p>
              </div>
              <button className="btn-gold" onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? '⚡ Establishing Uplink...' : 'Connect to Server'}
              </button>
            </div>
          )}

          {view === 'auth' && (
            <>
              <div className="auth-tabs">
                <button className={`auth-tab ${authMode === 'login' ? 'active-cyan' : ''}`} onClick={() => setAuthMode('login')}>Login</button>
                <button className={`auth-tab ${authMode === 'signup' ? 'active-gold' : ''}`} onClick={() => setAuthMode('signup')}>Sign Up</button>
              </div>
              <form className="form" onSubmit={handleAuth}>
                {authMode === 'signup' && (
                  <div className="field">
                    <label>Café Name</label>
                    <input type="text" value={cafeName} onChange={e => setCafeName(e.target.value)} placeholder="e.g. NextGen Esports" />
                  </div>
                )}
                <div className="field">
                  <label>Authorized Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@yparenaos.com" />
                </div>
                <div className="field">
                  <label>Security Clearance</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <button className={authMode === 'login' ? 'btn-cyan' : 'btn-gold'} type="submit">
                  {authMode === 'login' ? 'Initiate Boot Sequence' : 'Register Core Engine'}
                </button>
              </form>
            </>
          )}

          <div className="hwid-footer">
            <ShieldAlert size={14} style={{ color: 'var(--muted)' }} />
            <span>HWID: {hardwareId}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ===== DASHBOARD ===== */
  return (
    <div className="dashboard">
      <div className="orb orb-cyan" />
      <div className="orb orb-gold" />

      {/* Header */}
      <div className="dash-header glass">
        <div className="dash-brand">
          <div className={`server-icon-box ${serverStatus !== 'online' ? 'offline' : ''}`}>
            <Server size={36} />
          </div>
          <div>
            <div className="brand-title">YpArena<span>os</span></div>
            <div className="status-badge">
              <div className={`status-dot-small ${wsStatus === 'online' ? 'online' : 'offline'}`} />
              <span>{wsStatus === 'online' ? 'Connected to Edge Server' : 'Edge Server Offline'}</span>
            </div>
          </div>
        </div>
        <div className="hwid-chip">
          <small>Hardware Fingerprint</small>
          {hardwareId}
        </div>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        
        {/* NETWORK STATUS */}
        <div className="dash-card glass" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <Activity size={18} style={{ color: 'var(--cyan)' }} />
            Network Telemetry
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(0,212,255,0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>Active Terminals</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--cyan)' }}>
                {stats?.devices?.online || 0} / {stats?.devices?.total || 0}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,184,0,0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>Live Sessions</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--gold)' }}>
                {stats?.active_sessions || 0}
              </div>
            </div>
          </div>
          <div className="cache-badge" style={{ marginTop: '20px' }}>
            <span className="label">Database Sync</span>
            <span className="value">
              <div className={`dot-${wsStatus === 'online' ? 'green' : 'red'}`} /> {wsStatus === 'online' ? 'Active (PostgreSQL)' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* QUICK COMMANDS */}
        <div className="dash-card glass" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <Zap size={18} style={{ color: 'var(--gold)' }} />
            Emergency Operations
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <button onClick={handleBroadcast} style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: 'var(--cyan)', padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: '0.2s' }}>
              <Radio size={28} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 900, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Broadcast Msg</div>
            </button>
            <button onClick={handleLockAll} style={{ background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)', color: 'var(--red)', padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: '0.2s' }}>
              <Lock size={28} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 900, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Lock All PCs</div>
            </button>
          </div>
        </div>

        {/* LICENSE CARD */}
        <div className="dash-card glass" style={{ gridColumn: 'span 2' }}>
          <div className="license-glow" />
          <div className="card-title">
            {license.status === 'active' ? <Unlock size={18} style={{ color: 'var(--gold)' }} /> : <Lock size={18} style={{ color: 'var(--red)' }} />}
            License Verification
          </div>
          <div className="license-status">
            {license.status.toUpperCase()}
            <div className="license-expiry" style={{ marginTop: '4px' }}>Valid until: {license.expiresAt}</div>
            {license.status === 'active' && (
              <div className="license-pill" style={{ marginTop: '12px' }}>30 Days Remaining</div>
            )}
          </div>
        </div>

        {/* REVENUE PREVIEW */}
        <div className="dash-card glass" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <Activity size={18} style={{ color: 'var(--green)' }} />
            Today's Telemetry
          </div>
          <div className="metric-row" style={{ marginTop: '20px' }}>
            <div className="metric-top">
              <span className="metric-label">Revenue Generated</span>
              <span className="metric-value gold">₹{stats?.today?.revenue?.toLocaleString() || 0}</span>
            </div>
          </div>
          <div className="metric-row">
            <div className="metric-top">
              <span className="metric-label">Gaming Hours</span>
              <span className="metric-value cyan">{stats?.today?.hours || 0}h</span>
            </div>
          </div>
          <div className="metric-row">
            <div className="metric-top">
              <span className="metric-label">Footfall (Customers)</span>
              <span className="metric-value purple">{stats?.total_customers || 0}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
