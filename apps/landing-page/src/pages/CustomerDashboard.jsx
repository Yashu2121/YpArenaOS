import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Key, Calendar, Activity, Server, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';

export default function CustomerDashboard() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        const { data } = await api.get('/api/user/licenses');
        setLicenses(data);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('saas_token');
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLicenses();
  }, [navigate]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Dashboard</h1>
            <p className="text-gray-400 mt-1">Manage your YP Arena OS licenses and downloads</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Buy New License
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Licenses */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              Active Licenses
            </h2>
            
            {licenses.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <Server className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-300">No licenses found</h3>
                <p className="text-gray-500 mt-2 mb-6">You haven't purchased any licenses yet.</p>
                <button 
                  onClick={() => navigate('/')}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Get Started
                </button>
              </div>
            ) : (
              licenses.map((license) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={license.key} 
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${license.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{license.cafeName}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${license.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {license.status.toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>{license.plan.replace('-', ' ').toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Terminals</div>
                      <div className="font-semibold">{license.maxTerminals || 'Unlimited'} PC</div>
                    </div>
                  </div>

                  <div className="bg-gray-950 p-4 rounded-lg flex items-center justify-between mb-4 border border-gray-800">
                    <code className="text-blue-400 font-mono text-lg">{license.key}</code>
                    <button 
                      onClick={() => copyToClipboard(license.key)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      {copiedKey === license.key ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Expires: {new Date(license.expiryDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Status: {license.hardwareBound ? 'Bound to Hardware' : 'Unbound'}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Sidebar - Downloads */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              Downloads
            </h2>
            
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-2">Platform Installer</h3>
              <p className="text-gray-400 text-sm mb-6">
                Download the unified installer containing both the Edge Server and the PC Client software.
              </p>
              
              <a 
                href="https://yparenaos-dist-yashu.s3.us-east-1.amazonaws.com/YP-Arena-OS-Unified-Installer-Release.exe"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download for Windows
              </a>
              
              <div className="mt-4 text-xs text-gray-500 text-center">
                Requires Windows 10/11 64-bit
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
