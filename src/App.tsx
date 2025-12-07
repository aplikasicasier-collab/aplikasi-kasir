import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kasir from './pages/Kasir';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Laporan from './pages/Laporan';

function App() {
  const { isAuthenticated } = useAuthStore();
  const [activeRoute, setActiveRoute] = useState('/');

  const handleNavigate = (route: string) => {
    setActiveRoute(route);
  };

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Router>
      <Layout activeRoute={activeRoute} onNavigate={handleNavigate}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kasir" element={<Kasir />} />
          <Route path="/inventori" element={<Inventory />} />
          <Route path="/pemesanan" element={<div className="p-6">Pemesanan - Coming Soon</div>} />
          <Route path="/laporan" element={<Laporan />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;