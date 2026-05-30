import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import SaaSAdmin from './pages/SaaSAdmin';

export default function App() {
  return (
    <div className="bg-gray-950 min-h-screen text-gray-100 font-sans selection:bg-blue-500/30">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/admin" element={<SaaSAdmin />} />
      </Routes>
    </div>
  );
}
