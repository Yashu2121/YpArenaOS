import { useState, useEffect } from 'react';
import { Shield, Monitor, RefreshCw, ShoppingCart, Download, Copy, Check, Info, CreditCard } from 'lucide-react';

const SAAS_API = import.meta.env.VITE_SAAS_API_URL || 'http://localhost:5000';

export default function App() {
  const [pcCount, setPcCount] = useState(25);
  const [pricePerPc, setPricePerPc] = useState(60);
  const [totalCost, setTotalCost] = useState(1500);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Info/Billing, 2: Loading, 3: Success
  const [formData, setFormData] = useState({ cafeName: '', ownerEmail: '', trialDuration: 30 });
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);

  // Pricing Logic
  useEffect(() => {
    let rate = 75;
    if (pcCount > 100) rate = 40;
    else if (pcCount > 50) rate = 50;
    else if (pcCount > 15) rate = 60;
    
    setPricePerPc(rate);
    setTotalCost(pcCount * rate);
  }, [pcCount]);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cafeName || !formData.ownerEmail) {
      alert('Please fill out all fields.');
      return;
    }
    
    setCheckoutStep(2); // Loading

    try {
      const res = await fetch(`${SAAS_API}/api/licenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeName: formData.cafeName,
          ownerEmail: formData.ownerEmail,
          expiryDays: formData.trialDuration
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setGeneratedKey(data.key);
        setCheckoutStep(3); // Success
      } else {
        alert(data.error || 'Failed to register subscription.');
        setCheckoutStep(1);
      }
    } catch (err) {
      // Fallback local key generation if server is offline
      setTimeout(() => {
        const rand = Math.floor(1000 + Math.random() * 9000);
        setGeneratedKey(`YP-CAFE-${rand}-MOCK`);
        setCheckoutStep(3);
      }, 1500);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const s3Links = {
    installer: import.meta.env.VITE_DOWNLOAD_INSTALLER || 'https://yparenaos-dist.s3.amazonaws.com/YP-Arena-OS-Unified-Installer.exe',
    server: import.meta.env.VITE_DOWNLOAD_SERVER || 'https://yparenaos-dist.s3.amazonaws.com/YP-Arena-OS-Edge-Server.exe',
    client: import.meta.env.VITE_DOWNLOAD_CLIENT || 'https://yparenaos-dist.s3.amazonaws.com/YP-Arena-OS-Kiosk-Client.exe',
    admin: import.meta.env.VITE_DOWNLOAD_ADMIN || 'https://yparenaos-dist.s3.amazonaws.com/YP-Arena-OS-Admin-Dashboard.exe'
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: '80px' }}>
      <div className="bg-glow-1" />
      <div className="bg-glow-2" />

      {/* HEADER NAVBAR */}
      <header style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(6, 8, 16, 0.6)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: 'linear-gradient(135deg, var(--indigo) 0%, var(--cyan) 100%)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black' }}>YP</span>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.05em' }}>YP Arena <span style={{ color: 'var(--cyan)' }}>OS</span></span>
          </div>
          <nav style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
            <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Features</a>
            <a href="#pricing" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Pricing</a>
            <a href="#downloads" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Downloads</a>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px 0' }}>
        
        {/* HERO SECTION */}
        <section style={{ textAlign: 'center', marginBottom: '80px' }}>
          <span style={{ display: 'inline-block', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontSize: '11px', padding: '6px 14px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800, marginBottom: '24px' }}>
            Next-Gen E-Sports Café management suite
          </span>
          <h1 style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.15, marginBottom: '24px' }} className="gradient-text">
            Transform Your Gaming Zone<br />Into A Smart Arena
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '18px', maxWidth: '640px', margin: '0 auto 36px', lineHeight: 1.6 }}>
            YP Arena OS is a hybrid-cloud cybercafé operating system. Secure your terminals, manage accounts, sell snacks, and deploy game updates with ease.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <a href="#pricing" className="btn-primary" style={{ padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '15px' }}>Get License Key</a>
            <a href="#downloads" className="btn-secondary" style={{ padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '15px' }}>Download Installers</a>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" style={{ marginBottom: '100px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '48px' }}>Designed for Gaming Lounges</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            
            <div className="glass glass-hover" style={{ padding: '32px', borderRadius: '24px' }}>
              <div style={{ background: 'rgba(0, 240, 255, 0.1)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '20px', color: 'var(--cyan)', marginBottom: '20px', justifyContent: 'center' }}>
                <Shield size={20} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Kiosk Shell Lockdown</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                Blocks standard Windows keyboard bypass shortcuts (Alt+F4, TaskManager). Prevents desktop modifications and unauthorised application usage.
              </p>
            </div>

            <div className="glass glass-hover" style={{ padding: '32px', borderRadius: '24px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '20px', color: 'var(--indigo)', marginBottom: '20px', justifyContent: 'center' }}>
                <Monitor size={20} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Real-Time Command Center</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                Monitor terminal telemetry, active sessions, and hardware states. Send remote lock/unlock commands instantly via fast WebSockets.
              </p>
            </div>

            <div className="glass glass-hover" style={{ padding: '32px', borderRadius: '24px' }}>
              <div style={{ background: 'rgba(255, 184, 0, 0.1)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '20px', color: 'var(--gold)', marginBottom: '20px', justifyContent: 'center' }}>
                <RefreshCw size={20} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Automated Game Updates</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                Integrates with SteamCMD and Legendary to trigger silent background patches across all client PCs from the single master server.
              </p>
            </div>

            <div className="glass glass-hover" style={{ padding: '32px', borderRadius: '24px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '20px', color: 'var(--green)', marginBottom: '20px', justifyContent: 'center' }}>
                <ShoppingCart size={20} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Smart POS Snacks Menu</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                Gamers can purchase beverages, food items, or station vouchers directly from the PC kiosk UI. Orders alert the front-desk console.
              </p>
            </div>

          </div>
        </section>

        {/* PRICING & SUBSCRIPTION CALCULATOR */}
        <section id="pricing" style={{ marginBottom: '100px' }}>
          <div className="glass" style={{ borderRadius: '28px', padding: '48px', border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 20px 40px -20px rgba(99, 102, 241, 0.15)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
              
              {/* Slider Panel */}
              <div style={{ flex: '1.2 1 350px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div>
                  <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>Dynamic Licensing Pricing</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>YP Arena OS offers transparent per-PC monthly pricing. Scale up or down anytime.</p>
                </div>

                <div className="slider-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Station Terminals</span>
                    <span style={{ color: 'var(--cyan)', fontWeight: 800, fontSize: '18px' }}>{pcCount} PCs</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="150" 
                    value={pcCount} 
                    onChange={e => setPcCount(parseInt(e.target.value))}
                    className="range-slider" 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>
                    <span>5 PCs</span>
                    <span>150 PCs</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Rate Per PC (Monthly)</span>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>₹{pricePerPc}/PC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Diskless Server Node</span>
                    <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>Included Free</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Admin Dashboard Client</span>
                    <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>Unlimited Licenses</span>
                  </div>
                </div>
              </div>

              {/* Checkout Panel */}
              <div style={{ flex: '1 1 300px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '20px', padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '340px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ color: 'var(--indigo)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Subscription Plan</span>
                  <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Arena Pro Suite</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '14px 0' }}>
                    <span style={{ fontSize: '38px', fontWeight: 900, color: 'var(--gold)' }}>₹{totalCost.toLocaleString()}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>/ month</span>
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', listStyle: 'none' }}>
                    <li>✓ Complete Command Center Controls</li>
                    <li>✓ SteamCMD Silent Game Updates</li>
                    <li>✓ Dynamic Happy-Hour Pricing rules</li>
                    <li>✓ Secure POS snack ordering</li>
                  </ul>
                </div>
                <button onClick={() => setCheckoutOpen(true)} className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '13px', marginTop: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Purchase License Key
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* DOWNLOAD CENTER */}
        <section id="downloads" style={{ marginBottom: '60px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '12px' }}>Download Enterprise Installers</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginBottom: '48px' }}>Host files on cloud S3 distributions for fast deployments.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            
            <div className="glass" style={{ padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--indigo)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontWeight: 800, uppercase: 'true' }}>Unified</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>35 MB</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Unified Installer</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, flexGrow: 1 }}>
                Recommended. Single installer wizard built with NSIS script containing Server, Client, and Admin packages.
              </p>
              <a href={s3Links.installer} className="btn-primary" style={{ padding: '12px', borderRadius: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}>
                <Download size={14} /> Download Installer
              </a>
            </div>

            <div className="glass" style={{ padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: 'rgba(0, 240, 255, 0.1)', color: 'var(--cyan)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontWeight: 800, uppercase: 'true' }}>Core Engine</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>41 MB</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Master Edge Server</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, flexGrow: 1 }}>
                Standalone. Copy and run directly on your Master Server computer at the front desk. Connects locally to PostgreSQL.
              </p>
              <a href={s3Links.server} className="btn-secondary" style={{ padding: '12px', borderRadius: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}>
                <Download size={14} /> Download Edge Server
              </a>
            </div>

            <div className="glass" style={{ padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: 'rgba(255, 184, 0, 0.1)', color: 'var(--gold)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', fontWeight: 800, uppercase: 'true' }}>Kiosk Shell</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>62 MB</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Client Kiosk Client</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, flexGrow: 1 }}>
                Standalone. Install on all client PCs. Locks down keyboard shortcuts and opens as full-screen kiosk.
              </p>
              <a href={s3Links.client} className="btn-secondary" style={{ padding: '12px', borderRadius: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}>
                <Download size={14} /> Download Client Shell
              </a>
            </div>

          </div>
        </section>

      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', marginTop: '80px', paddingTop: '40px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
        <p>&copy; 2026 YP Arena OS Enterprise. All rights reserved.</p>
      </footer>

      {/* STRIPE SIMULATED CHECKOUT MODAL */}
      {checkoutOpen && (
        <div className="modal-overlay">
          <div className="glass animate-fade-in" style={{ maxWidth: '440px', width: '100%', borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
            
            {/* Header */}
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="var(--indigo)" />
                <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Stripe Gateway</span>
              </div>
              <button onClick={() => { setCheckoutOpen(false); setCheckoutStep(1); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            {/* Step 1: Form Inputs */}
            {checkoutStep === 1 && (
              <form onSubmit={handleCheckoutSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Billing Information</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Enter subscription owner details to generate license.</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Café Client Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Phoenix Esports Arena"
                    value={formData.cafeName}
                    onChange={e => setFormData(prev => ({ ...prev, cafeName: e.target.value }))}
                    className="input-field" 
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Owner Email</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="e.g. owner@phoenixgaming.com"
                    value={formData.ownerEmail}
                    onChange={e => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    className="input-field" 
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Subscription Plan</label>
                  <select 
                    value={formData.trialDuration}
                    onChange={e => setFormData(prev => ({ ...prev, trialDuration: parseInt(e.target.value) }))}
                    className="input-field"
                  >
                    <option value="30">30 Days (Monthly Suite - ₹{totalCost})</option>
                    <option value="90">90 Days (Quarterly License - ₹{totalCost * 3})</option>
                    <option value="365">365 Days (Annual Premium - ₹{totalCost * 12})</option>
                  </select>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  🛡️ This is a simulated checkout. Click "Confirm Purchase" to register a live active license key on the central database.
                </div>

                <button type="submit" className="btn-primary" style={{ padding: '14px', borderRadius: '12px', fontWeight: 800, textTransform: 'uppercase', fontSize: '12px', marginTop: '10px' }}>
                  Confirm Purchase & Pay
                </button>
              </form>
            )}

            {/* Step 2: Processing Payment */}
            {checkoutStep === 2 && (
              <div style={{ padding: '60px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                <div className="spinner" />
                <div>
                  <h4 style={{ fontWeight: 800, fontSize: '15px' }}>Processing Payment...</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Authorizing with Stripe Licensing database</p>
                </div>
              </div>
            )}

            {/* Step 3: Success, Display license key */}
            {checkoutStep === 3 && (
              <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
                <div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--green)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 16px' }}>✓</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Payment Approved</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Your YP Arena OS enterprise subscription is now active.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.15em' }}>Your Subscription License Key</label>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--cyan)', fontSize: '15px' }}>{generatedKey}</span>
                    <button onClick={copyToClipboard} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                      {copied ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)', borderRadius: '14px', padding: '18px', display: 'flex', gap: '12px', textLeft: 'true', alignItems: 'flex-start' }}>
                  <Info size={16} color="var(--cyan)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'left' }}>
                    <strong>Next Steps:</strong> Paste this key into the NSIS Installer window during installation on your Master Server, or register it in the <strong>Setup</strong> panel of the Administrator dashboard.
                  </p>
                </div>

                <button onClick={() => { setCheckoutOpen(false); setCheckoutStep(1); }} className="btn-secondary" style={{ padding: '12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                  Close Gateway
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
