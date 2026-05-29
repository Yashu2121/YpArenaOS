"use client";

import { useState, useEffect, useRef } from 'react';
import { Monitor, Settings, BarChart2, Receipt, Trophy, ShoppingCart, Activity, Cpu } from 'lucide-react';

const API = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('grid');
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [posItems, setPosItems] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [newLicenseKey, setNewLicenseKey] = useState('');
  
  // Custom Food Menu & PC/PS States
  const [showAddPosModal, setShowAddPosModal] = useState(false);
  const [newPosItem, setNewPosItem] = useState({ item_name: '', category: 'food', price: '', stock: '' });
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', device_type: 'PC', hourly_rate: '50', ip_address: '' });

  const wsRef = useRef(null);

  // ── Fetch initial data ──────────────────────────────────────
  useEffect(() => {
    fetchDevices();
    fetchStats();
    fetchLicenseStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') fetchSessions();
    if (activeTab === 'pos') fetchPos();
    if (activeTab === 'tournaments') fetchTournaments();
  }, [activeTab]);

  // ── WebSocket for live updates ──────────────────────────────
  useEffect(() => {
    connectWs();
    return () => wsRef.current?.close();
  }, []);

  function connectWs() {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        console.log('[WS] Connected to edge server');
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === 'DEVICE_STATUS_UPDATE') {
          setDevices(prev => prev.map(d =>
            d.client_id === msg.data.pcId ? { ...d, status: msg.data.status } : d
          ));
          fetchStats();
        }
        if (msg.event === 'SESSION_STARTED' || msg.event === 'SESSION_ENDED') {
          fetchStats();
          fetchDevices();
        }
        if (msg.event === 'NEW_ORDER') {
          setIncomingOrders(prev => [msg.data, ...prev]);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connectWs, 3000);
      };

      ws.onerror = () => setWsStatus('error');
    } catch (e) {
      setWsStatus('error');
    }
  }

  async function fetchLicenseStatus() {
    try {
      const r = await fetch(`${API}/api/license/status`);
      const data = await r.json();
      setLicenseStatus(data);
    } catch (e) { console.error('fetchLicenseStatus:', e); }
  }

  async function activateLicense() {
    if (!newLicenseKey) {
      alert('Please enter a license key.');
      return;
    }
    try {
      const r = await fetch(`${API}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: newLicenseKey })
      });
      const data = await r.json();
      if (r.ok) {
        alert('License activated successfully!');
        setNewLicenseKey('');
        fetchLicenseStatus();
        fetchStats();
        fetchDevices();
      } else {
        alert(data.error || 'Failed to activate license');
      }
    } catch (e) {
      alert('Error connecting to edge server to activate license.');
    }
  }

  async function fetchLicenseStatus() {
    try {
      const r = await fetch(`${API}/api/license/status`);
      const data = await r.json();
      setLicenseStatus(data);
    } catch (e) { console.error('fetchLicenseStatus:', e); }
  }

  async function activateLicense() {
    if (!newLicenseKey) {
      alert('Please enter a license key.');
      return;
    }
    try {
      const r = await fetch(`${API}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: newLicenseKey })
      });
      const data = await r.json();
      if (r.ok) {
        alert('License activated successfully!');
        setNewLicenseKey('');
        fetchLicenseStatus();
        fetchStats();
        fetchDevices();
      } else {
        alert(data.error || 'Failed to activate license');
      }
    } catch (e) {
      alert('Error connecting to edge server to activate license.');
    }
  }

  async function addCustomPosItem() {
    if (!newPosItem.item_name || !newPosItem.price) {
      alert('Item name and price are required.');
      return;
    }
    try {
      const r = await fetch(`${API}/pos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPosItem)
      });
      if (r.ok) {
        alert('Custom item added successfully!');
        setNewPosItem({ item_name: '', category: 'food', price: '', stock: '' });
        setShowAddPosModal(false);
        fetchPos();
      } else {
        const data = await r.json();
        alert(data.error || 'Failed to add item');
      }
    } catch (e) {
      alert('Error connecting to edge server.');
    }
  }

  async function addTerminalDevice() {
    if (!newDevice.name || !newDevice.device_type) {
      alert('Device name and type are required.');
      return;
    }
    try {
      const r = await fetch(`${API}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      if (r.ok) {
        alert('Terminal device registered successfully!');
        setNewDevice({ name: '', device_type: 'PC', hourly_rate: '50', ip_address: '' });
        setShowAddDeviceModal(false);
        fetchDevices();
        fetchStats();
      } else {
        const data = await r.json();
        alert(data.error || 'Failed to add device');
      }
    } catch (e) {
      alert('Error connecting to edge server.');
    }
  }

  async function fetchDevices() {
    try {
      const r = await fetch(`${API}/clients`);
      const data = await r.json();
      setDevices(data.clients || []);
    } catch (e) { console.error('fetchDevices:', e); }
  }

  async function fetchStats() {
    try {
      const r = await fetch(`${API}/stats`);
      const data = await r.json();
      setStats(data);
    } catch (e) { console.error('fetchStats:', e); }
  }

  async function fetchSessions() {
    try {
      const r = await fetch(`${API}/sessions/active`);
      const data = await r.json();
      setSessions(data.sessions || []);
    } catch (e) { console.error('fetchSessions:', e); }
  }

  async function fetchPos() {
    try {
      const r = await fetch(`${API}/pos?gamezone_id=b0000000-0000-0000-0000-000000000001`);
      const data = await r.json();
      setPosItems(data.items || []);
    } catch (e) { console.error('fetchPos:', e); }
  }

  async function fetchTournaments() {
    try {
      const r = await fetch(`${API}/tournaments`);
      const data = await r.json();
      setTournaments(data.tournaments || []);
    } catch (e) { console.error('fetchTournaments:', e); }
  }

  async function startSession(clientId) {
    try {
      const r = await fetch(`${API}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, gamezone_id: 'b0000000-0000-0000-0000-000000000001' })
      });
      if (r.ok) { fetchDevices(); fetchStats(); }
    } catch (e) { alert('Could not start session — is the server running?'); }
  }

  async function stopSession(clientId) {
    const active = sessions.find(s => s.client_id === clientId);
    if (!active) {
      alert('Stopping session... (Connect to live DB for full flow)');
      await fetch(`${API}/clients/${clientId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'online' })
      });
      fetchDevices();
      return;
    }
    try {
      const r = await fetch(`${API}/sessions/${active.session_id}/stop`, { method: 'POST' });
      if (r.ok) { fetchDevices(); fetchStats(); fetchSessions(); }
    } catch (e) { alert('Could not stop session'); }
  }

  const completeOrder = (idx) => {
    setIncomingOrders(prev => prev.filter((_, i) => i !== idx));
  };

  const statusColor = { online: 'var(--green)', in_use: 'var(--cyan)', offline: '#444', maintenance: 'var(--gold)' };

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">YP Arena<span> OS</span></div>
        <ul className="sidebar-nav">
          {[
            { id: 'grid', label: 'PC Grid', icon: <Monitor size={18} />, color: 'active-cyan' },
            { id: 'sessions', label: 'Sessions', icon: <BarChart2 size={18} />, color: 'active-cyan' },
            { id: 'pos', label: 'POS System', icon: <ShoppingCart size={18} />, color: 'active-gold' },
            { id: 'tournaments', label: 'Tournaments', icon: <Trophy size={18} />, color: 'active-green' },
            { id: 'config', label: 'Setup', icon: <Settings size={18} />, color: 'active-gold' },
          ].map(item => (
            <li key={item.id}
              className={`nav-item ${activeTab === item.id ? item.color : ''}`}
              onClick={() => setActiveTab(item.id)}>
              {item.icon}{item.label}
              {item.id === 'pos' && incomingOrders.length > 0 && (
                <span style={{ background:'var(--red)', color:'white', fontSize:'10px', padding:'2px 6px', borderRadius:'10px', marginLeft:'auto' }}>{incomingOrders.length}</span>
              )}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 'auto' }}>
          <div className="glass" style={{ padding: '20px', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: wsStatus === 'connected' ? 'var(--green)' : wsStatus === 'connecting' ? 'var(--gold)' : 'var(--red)',
                boxShadow: wsStatus === 'connected' ? '0 0 8px var(--green-glow)' : 'none',
                animation: wsStatus === 'connected' ? 'blink 2s infinite' : 'none'
              }} />
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: wsStatus === 'connected' ? 'var(--green)' : 'var(--muted)' }}>
                {wsStatus === 'connected' ? 'Live' : wsStatus}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'monospace' }}>localhost:4000</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">

        {/* ——— PC GRID ——— */}
        {activeTab === 'grid' && (
          <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>Command Center</h1>
                <p>{stats?.mock ? '⚠ Mock data — start edge-server' : 'Live data from edge-server'}</p>
              </div>
              <button 
                onClick={() => setShowAddDeviceModal(true)} 
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'rgba(0, 229, 255, 0.15)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  color: 'var(--cyan)',
                  fontWeight: 800,
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                + Add Terminal Node
              </button>
            </div>

            {stats && (
              <div className="stats-row">
                <div className="stat-card glass">
                  <span className="stat-label">Today Revenue</span>
                  <span className="stat-value gold">₹{stats.today?.revenue?.toLocaleString()}</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-label">Today Hours</span>
                  <span className="stat-value cyan">{stats.today?.hours} hrs</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-label">Active Sessions</span>
                  <span className="stat-value cyan">{stats.active_sessions}</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-label">Total Customers</span>
                  <span className="stat-value green">{stats.total_customers}</span>
                </div>
              </div>
            )}

            <div>
              <p className="section-title">Terminal Allocation Grid ({devices.length} devices)</p>
              <div className="pc-grid">
                {devices.map((dev, i) => {
                  const cpuLoad = dev.status === 'in_use' ? Math.floor(Math.random() * 40) + 50 : Math.floor(Math.random() * 10) + 1;
                  const gpuLoad = dev.status === 'in_use' ? Math.floor(Math.random() * 30) + 60 : 0;
                  return (
                  <div key={dev.client_id} className="pc-card glass">
                    <div className="status-dot" style={{
                      position: 'absolute', top: '18px', right: '18px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: statusColor[dev.status] || '#444',
                      boxShadow: dev.status !== 'offline' ? `0 0 10px ${statusColor[dev.status]}` : 'none',
                      animation: ['online', 'in_use'].includes(dev.status) ? 'blink 2s infinite' : 'none'
                    }} />
                    <div className="pc-icon">{dev.device_type === 'PS5' ? '🎮' : dev.device_type === 'PS4' ? '🕹️' : '🖥️'}</div>
                    <div className="pc-name">{dev.name}</div>
                    
                    {/* Hardware Telemetry */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginTop:'8px', marginBottom:'12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'9px', color:'var(--muted)' }}>
                        <Cpu size={10} color={cpuLoad > 80 ? 'var(--red)' : 'var(--cyan)'} /> CPU 
                        <div style={{ flex:1, height:'2px', background:'rgba(255,255,255,0.1)', borderRadius:'2px' }}>
                          <div style={{ height:'100%', width:`${cpuLoad}%`, background:cpuLoad > 80 ? 'var(--red)' : 'var(--cyan)' }} />
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'9px', color:'var(--muted)' }}>
                        <Activity size={10} color={gpuLoad > 85 ? 'var(--gold)' : 'var(--green)'} /> GPU
                        <div style={{ flex:1, height:'2px', background:'rgba(255,255,255,0.1)', borderRadius:'2px' }}>
                          <div style={{ height:'100%', width:`${gpuLoad}%`, background:gpuLoad > 85 ? 'var(--gold)' : 'var(--green)' }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10px' }}>
                      <span style={{ color: 'var(--gold)', fontWeight: 800 }}>₹{dev.hourly_rate}/hr</span>
                      <span style={{ color: statusColor[dev.status], fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{dev.status}</span>
                    </div>
                    {dev.status === 'online' && (
                      <button className="card-action-btn btn-start" onClick={() => startSession(dev.client_id)}>Start</button>
                    )}
                    {dev.status === 'in_use' && (
                      <button className="card-action-btn btn-stop" onClick={() => stopSession(dev.client_id)}>Stop</button>
                    )}
                    {dev.status === 'offline' && (
                      <button className="card-action-btn btn-offline" disabled>Offline</button>
                    )}
                    {dev.status === 'maintenance' && (
                      <button className="card-action-btn" style={{ background: 'rgba(255,184,0,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,184,0,0.3)' }} disabled>Maintenance</button>
                    )}
                  </div>
                )})}
              </div>
            </div>
          </>
        )}

        {/* ——— SESSIONS ——— */}
        {activeTab === 'sessions' && (
          <>
            <div className="page-header"><h1>Active Sessions</h1><p>Live gaming sessions</p></div>
            {sessions.length === 0 ? (
              <div className="glass" style={{ padding: '48px', borderRadius: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
                <div style={{ color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>No active sessions</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sessions.map(s => (
                  <div key={s.session_id} className="glass" style={{ padding: '20px 28px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px' }}>{s.device_name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>{s.customer_name || 'Walk-in'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--cyan)', fontWeight: 800, fontSize: '13px' }}>
                        {s.start_time ? new Date(s.start_time).toLocaleTimeString() : '—'}
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Started</div>
                    </div>
                    <div style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', color: 'var(--cyan)', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      LIVE
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ——— POS ——— */}
        {activeTab === 'pos' && (
          <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>POS System</h1>
                <p>Food, Beverages & Vouchers</p>
              </div>
              <button 
                onClick={() => setShowAddPosModal(true)} 
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'rgba(0, 229, 255, 0.15)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  color: 'var(--cyan)',
                  fontWeight: 800,
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                + Add Custom Item
              </button>
            </div>
            
            {/* Live Order Queue */}
            {incomingOrders.length > 0 && (
              <div style={{ marginBottom:'32px', background:'rgba(0,0,0,0.4)', borderRadius:'24px', border:'1px solid rgba(255,184,0,0.3)', padding:'24px' }}>
                <p className="section-title" style={{ color:'var(--gold)' }}>🚨 Incoming PC Orders</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {incomingOrders.map((ord, i) => (
                    <div key={i} className="glass" style={{ padding:'16px 20px', borderRadius:'16px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,184,0,0.05)' }}>
                      <div>
                        <div style={{ color:'var(--gold)', fontWeight:900, fontSize:'16px' }}>{ord.quantity}x {ord.item}</div>
                        <div style={{ color:'var(--muted)', fontSize:'12px', marginTop:'4px' }}>Deliver to: <span style={{ color:'white', fontWeight:800 }}>PC-01</span></div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                        <div style={{ fontWeight:900, fontSize:'18px' }}>₹{ord.total}</div>
                        <button onClick={() => completeOrder(i)} style={{ background:'var(--green)', color:'black', fontWeight:900, fontSize:'11px', padding:'8px 16px', borderRadius:'8px', cursor:'pointer', border:'none' }}>MARK DELIVERED</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pc-grid">
              {posItems.map(item => (
                <div key={item.pos_id} className="glass" style={{ padding: '24px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>{item.category}</div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>{item.item_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 900, fontSize: '20px' }}>₹{item.price}</span>
                    <span style={{ color: item.stock > 10 ? 'var(--green)' : 'var(--red)', fontSize: '11px', fontWeight: 800 }}>Stock: {item.stock}</span>
                  </div>
                  <button className="card-action-btn btn-start">Add to Order</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ——— TOURNAMENTS ——— */}
        {activeTab === 'tournaments' && (
          <>
            <div className="page-header"><h1>Tournaments</h1><p>Esports Events</p></div>
            {tournaments.length === 0 ? (
              <div className="glass" style={{ padding: '48px', borderRadius: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
                <div style={{ color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>No tournaments yet</div>
              </div>
            ) : tournaments.map(t => (
              <div key={t.tournament_id} className="glass" style={{ padding: '28px', borderRadius: '24px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '20px' }}>{t.name}</div>
                    <div style={{ color: 'var(--cyan)', fontWeight: 700, marginTop: '8px', fontSize: '13px' }}>{t.game}</div>
                  </div>
                  <div style={{ background: 'rgba(0,255,102,0.1)', border: '1px solid rgba(0,255,102,0.3)', color: 'var(--green)', padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                    {t.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', marginTop: '20px' }}>
                  <div><div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Prize Pool</div><div style={{ color: 'var(--gold)', fontWeight: 900, fontSize: '24px' }}>₹{t.prize_pool?.toLocaleString()}</div></div>
                  <div><div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Entry Fee</div><div style={{ fontWeight: 900, fontSize: '24px' }}>₹{t.entry_fee}</div></div>
                  <div><div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Max Players</div><div style={{ fontWeight: 900, fontSize: '24px' }}>{t.max_participants}</div></div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ——— CONFIG ——— */}
        {activeTab === 'config' && (
          <div style={{ display:'flex', gap:'24px' }}>
            <div style={{ flex:1 }}>
              <div className="page-header"><h1>System Setup</h1><p>Server Configuration</p></div>

              {/* B2B SaaS Licensing Card */}
              <div className="glass" style={{ padding: '40px', borderRadius: '28px', marginBottom: '24px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <p className="section-title" style={{ color: 'var(--cyan)' }}>YP Arena OS License Status</p>
                {licenseStatus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Status:</span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: licenseStatus.licensed ? 'rgba(0,255,102,0.1)' : 'rgba(255,68,68,0.1)',
                        border: licenseStatus.licensed ? '1px solid rgba(0,255,102,0.3)' : '1px solid rgba(255,68,68,0.3)',
                        color: licenseStatus.licensed ? 'var(--green)' : 'var(--red)',
                        textTransform: 'uppercase'
                      }}>
                        {licenseStatus.licensed ? 'Active / Licensed' : 'Unlicensed / Expired'}
                      </span>
                    </div>

                    {licenseStatus.details && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Café Client:</span>
                          <span style={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}>{licenseStatus.details.cafeName}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Contact:</span>
                          <span style={{ fontSize: '12px', color: 'white' }}>{licenseStatus.details.ownerEmail}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Expires:</span>
                          <span style={{ fontSize: '12px', color: 'white' }}>
                            {new Date(licenseStatus.details.expiryDate).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Hardware Lock ID:</span>
                      <span style={{ fontSize: '10px', color: 'var(--cyan)', fontFamily: 'monospace' }}>{licenseStatus.machineId?.substring(0, 18)}...</span>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                        {licenseStatus.licensed ? 'Change License Key' : 'Activate License Key'}
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          placeholder="YP-CAFE-XXXX-XXXX"
                          value={newLicenseKey}
                          onChange={(e) => setNewLicenseKey(e.target.value)}
                          style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: 'white',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={activateLicense}
                          style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            background: 'var(--cyan)',
                            color: 'black',
                            fontWeight: 800,
                            fontSize: '11px',
                            cursor: 'pointer',
                            border: 'none',
                            textTransform: 'uppercase'
                          }}
                        >
                          Activate
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Loading license details...</span>
                )}
              </div>
              <div className="glass" style={{ padding: '40px', borderRadius: '28px', marginBottom:'24px' }}>
                <p className="section-title">Edge Server Connection</p>
                {[
                  { label: 'API Endpoint', val: 'http://localhost:4000' },
                  { label: 'WebSocket', val: 'ws://localhost:4000' },
                  { label: 'Database', val: 'PostgreSQL @ localhost:5432/yparenaos' },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>{f.label}</label>
                    <input defaultValue={f.val} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 18px', color: 'var(--cyan)', fontSize: '14px', fontFamily: 'monospace', outline: 'none' }} />
                  </div>
                ))}
                <button style={{ padding: '14px 32px', borderRadius: '12px', background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', color: 'var(--cyan)', fontWeight: 800, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Save & Reconnect
                </button>
              </div>

              <div className="glass" style={{ padding: '40px', borderRadius: '28px' }}>
                <p className="section-title" style={{ color:'var(--gold)' }}>Dynamic Pricing</p>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.4)', padding:'16px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ color:'white', fontWeight:800, fontSize:'14px' }}>Happy Hours Activation</div>
                    <div style={{ color:'var(--muted)', fontSize:'12px' }}>Automatically drop PC rates by 30% from 8AM to 12PM.</div>
                  </div>
                  <div style={{ background:'var(--green)', color:'black', padding:'6px 12px', borderRadius:'100px', fontSize:'10px', fontWeight:900 }}>ACTIVE</div>
                </div>
              </div>
            </div>

            <div style={{ flex:1 }}>
              <div className="page-header"><h1>Staff Shifts</h1><p>Manage Employees</p></div>
              <div className="glass" style={{ padding: '32px', borderRadius: '28px' }}>
                {[
                  { name: 'Rahul Dev', role: 'Manager', status: 'Clocked In', time: '08:00 AM', color: 'var(--green)' },
                  { name: 'Pooja Sharma', role: 'Support', status: 'Clocked In', time: '09:30 AM', color: 'var(--green)' },
                  { name: 'Arjun Reddy', role: 'Technician', status: 'Offline', time: '—', color: 'var(--muted)' },
                ].map((s, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: i===2 ? 'none' : '1px solid rgba(255,255,255,0.05)', padding:'16px 0' }}>
                    <div>
                      <div style={{ color:'white', fontWeight:800, fontSize:'15px' }}>{s.name}</div>
                      <div style={{ color:'var(--cyan)', fontSize:'11px', fontWeight:700 }}>{s.role}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:s.color, fontWeight:800, fontSize:'12px' }}>{s.status}</div>
                      <div style={{ color:'var(--muted)', fontSize:'10px', marginTop:'4px' }}>{s.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* LICENSE EXPIRED LOCKDOWN OVERLAY */}
      {licenseStatus && !licenseStatus.licensed && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.96)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div className="glass" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '48px',
            borderRadius: '28px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 0 40px rgba(239, 68, 68, 0.15)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>🔒</div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--red)',
              letterSpacing: '0.05em',
              marginBottom: '12px'
            }}>YP-ARENAOS LOCKDOWN</h2>
            <p style={{
              color: 'var(--muted)',
              fontSize: '13px',
              marginBottom: '28px',
              lineHeight: 1.6
            }}>
              Your local Edge Server license is invalid, expired, or has not been activated. All cafe operations, remote PC controls, and gamer sessions are currently locked.
            </p>
            
            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                marginBottom: '8px'
              }}>Cafe Machine Identification</label>
              <div style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: 'var(--cyan)',
                wordBreak: 'break-all'
              }}>{licenseStatus.machineId}</div>
            </div>

            <div style={{ textAlign: 'left' }}>
              <label style={{
                display: 'block',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                marginBottom: '8px'
              }}>Enter Subscription License Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  placeholder="YP-CAFE-XXXX-XXXX"
                  value={newLicenseKey}
                  onChange={(e) => setNewLicenseKey(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    color: 'white',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={activateLicense}
                  style={{
                    padding: '14px 24px',
                    borderRadius: '12px',
                    background: 'var(--red)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: 'none',
                    textTransform: 'uppercase'
                  }}
                >
                  Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD POS ITEM MODAL */}
      {showAddPosModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div className="glass" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '40px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', color: 'var(--cyan)' }}>Add Custom Item to Menu</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Item Name</label>
              <input 
                placeholder="e.g. Chicken Hakka Noodles" 
                value={newPosItem.item_name}
                onChange={e => setNewPosItem(prev => ({ ...prev, item_name: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Category</label>
              <select 
                value={newPosItem.category}
                onChange={e => setNewPosItem(prev => ({ ...prev, category: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
              >
                <option value="food">Food</option>
                <option value="beverage">Beverage</option>
                <option value="peripheral">Peripheral</option>
                <option value="voucher">Voucher</option>
                <option value="merchandise">Merchandise</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Price (₹)</label>
                <input 
                  type="number"
                  placeholder="120" 
                  value={newPosItem.price}
                  onChange={e => setNewPosItem(prev => ({ ...prev, price: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Initial Stock</label>
                <input 
                  type="number"
                  placeholder="50" 
                  value={newPosItem.stock}
                  onChange={e => setNewPosItem(prev => ({ ...prev, stock: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={addCustomPosItem}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--cyan)', color: 'black', fontWeight: 800, cursor: 'pointer', border: 'none' }}
              >
                Add Item
              </button>
              <button 
                onClick={() => setShowAddPosModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DEVICE MODAL */}
      {showAddDeviceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div className="glass" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '40px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', color: 'var(--cyan)' }}>Add Terminal Node</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Device Name</label>
              <input 
                placeholder="e.g. PC-08 or PS5-VIP2" 
                value={newDevice.name}
                onChange={e => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Device Type</label>
              <select 
                value={newDevice.device_type}
                onChange={e => setNewDevice(prev => ({ ...prev, device_type: e.target.value }))}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
              >
                <option value="PC">Gaming PC</option>
                <option value="PS5">PlayStation 5</option>
                <option value="PS4">PlayStation 4</option>
                <option value="VR">VR Headset</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Hourly Rate (₹)</label>
                <input 
                  type="number"
                  placeholder="50" 
                  value={newDevice.hourly_rate}
                  onChange={e => setNewDevice(prev => ({ ...prev, hourly_rate: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>IP Address (optional)</label>
                <input 
                  placeholder="192.168.1.x" 
                  value={newDevice.ip_address}
                  onChange={e => setNewDevice(prev => ({ ...prev, ip_address: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px', color: 'white', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={addTerminalDevice}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--cyan)', color: 'black', fontWeight: 800, cursor: 'pointer', border: 'none' }}
              >
                Add Device
              </button>
              <button 
                onClick={() => setShowAddDeviceModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
