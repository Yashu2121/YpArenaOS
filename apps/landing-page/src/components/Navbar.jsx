import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Menu, X, LogOut, User } from 'lucide-react';
import api from '../lib/api';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      if (!localStorage.getItem('saas_token')) return;
      try {
        const { data } = await api.get('/api/user/me');
        setUser(data.user);
      } catch (err) {
        localStorage.removeItem('saas_token');
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('saas_token');
    setUser(null);
    navigate('/');
  };

  return (
    <nav className="fixed w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <Monitor className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                YP Arena OS
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
            <Link to="/#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
            
            {user ? (
              <div className="flex items-center gap-4">
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="text-gray-300 hover:text-white transition-colors flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
                </Link>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
                <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 hover:text-white">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-gray-900 border-b border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link to="/#features" className="block px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-md">Features</Link>
            <Link to="/#pricing" className="block px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-md">Pricing</Link>
            {user ? (
              <>
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="block px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-md">
                  {user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
                </Link>
                <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-red-400 hover:bg-gray-800 rounded-md">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-md">Login</Link>
                <Link to="/register" className="block px-3 py-2 text-blue-400 font-medium hover:bg-gray-800 rounded-md">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
