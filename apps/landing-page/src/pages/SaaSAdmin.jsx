import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, Activity, Server, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api';

export default function SaaSAdmin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, usersRes, licensesRes] = await Promise.all([
          api.get('/api/saas/stats'),
          api.get('/api/saas/users'),
          api.get('/api/saas/licenses')
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
        setLicenses(licensesRes.data);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          navigate('/dashboard'); // Not admin, redirect to normal dashboard
        } else {
          setError('Failed to load SaaS data');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) return <div className="pt-24 text-center text-red-500">{error}</div>;

  // Mock revenue history for the chart based on licenses
  const chartData = [
    { name: 'Jan', revenue: 0 },
    { name: 'Feb', revenue: 0 },
    { name: 'Mar', revenue: 0 },
    { name: 'Apr', revenue: 0 },
    { name: 'May', revenue: stats.totalRevenue > 0 ? stats.totalRevenue * 0.2 : 0 },
    { name: 'Jun', revenue: stats.totalRevenue > 0 ? stats.totalRevenue * 0.8 : 0 },
    { name: 'Jul', revenue: stats.totalRevenue }
  ];

  return (
    <div className="min-h-screen pt-20 bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">SaaS Administrator</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Revenue</p>
                <p className="text-3xl font-bold mt-2">₹{stats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CreditCard className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Customers</p>
                <p className="text-3xl font-bold mt-2">{stats.totalUsers}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Licenses</p>
                <p className="text-3xl font-bold mt-2">{stats.activeLicenses}</p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Deployments</p>
                <p className="text-3xl font-bold mt-2">{stats.totalLicenses}</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Server className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-6">Revenue Overview</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `₹${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Users Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Accounts</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-800/50 last:border-0">
                      <td className="py-4 text-gray-300">{u.email}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-gray-800 text-gray-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Licenses Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Licenses</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="pb-3 font-medium">Cafe Name</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">PCs</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {licenses.map(l => (
                    <tr key={l.key} className="border-b border-gray-800/50 last:border-0">
                      <td className="py-4 text-gray-300">
                        <div className="font-medium">{l.cafeName}</div>
                        <div className="text-xs text-gray-500">{l.key.substring(0, 16)}...</div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${l.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="py-4 text-right text-gray-400">
                        {l.maxTerminals || '∞'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
