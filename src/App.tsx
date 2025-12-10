import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { OutletProvider, useOutlet } from './contexts/OutletContext';
import { OutletSelectionModal } from './components/outlet';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kasir from './pages/Kasir';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Laporan from './pages/Laporan';
import Kategori from './pages/Kategori';
import Supplier from './pages/Supplier';
import Pemesanan from './pages/Pemesanan';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import Outlet from './pages/Outlet';
import StockTransfer from './pages/StockTransfer';
import Diskon from './pages/Diskon';
import StockOpname from './pages/StockOpname';
import LabelPrint from './pages/LabelPrint';
import Retur from './pages/Retur';
import AuditLog from './pages/AuditLog';

/**
 * Access Denied Toast Component
 * Shows when user tries to access unauthorized route (Requirement 5.4)
 */
const AccessDeniedToast: React.FC<{ show: boolean; onClose: () => void }> = ({ show, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>Akses ditolak. Anda tidak memiliki izin untuk halaman tersebut.</span>
    </div>
  );
};

/**
 * App Routes Component - handles routing with access control
 */
const AppRoutes: React.FC<{ activeRoute: string; onNavigate: (route: string) => void }> = ({ 
  activeRoute, 
  onNavigate 
}) => {
  const location = useLocation();
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Check for access denied state from navigation
  useEffect(() => {
    if (location.state?.accessDenied) {
      setShowAccessDenied(true);
      // Clear the state to prevent showing again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <>
      <AccessDeniedToast 
        show={showAccessDenied} 
        onClose={() => setShowAccessDenied(false)} 
      />
      <Layout activeRoute={activeRoute} onNavigate={onNavigate}>
        <Routes>
          {/* Dashboard - accessible by all authenticated users */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          {/* Kasir - accessible by kasir and admin (Requirement 5.3) */}
          <Route path="/kasir" element={
            <ProtectedRoute>
              <Kasir />
            </ProtectedRoute>
          } />
          
          {/* Inventory - accessible by manager and admin (Requirement 5.2) */}
          <Route path="/inventori" element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          } />
          
          {/* Kategori - accessible by manager and admin (Requirement 5.2) */}
          <Route path="/kategori" element={
            <ProtectedRoute>
              <Kategori />
            </ProtectedRoute>
          } />
          
          {/* Supplier - accessible by manager and admin (Requirement 5.2) */}
          <Route path="/supplier" element={
            <ProtectedRoute>
              <Supplier />
            </ProtectedRoute>
          } />
          
          {/* Diskon & Promo - accessible by manager and admin (Diskon-Promo Requirement 3.1) */}
          <Route path="/diskon" element={
            <ProtectedRoute>
              <Diskon />
            </ProtectedRoute>
          } />
          
          {/* Retur & Refund - accessible by kasir, manager and admin (Retur-Refund Requirement 1.1) */}
          <Route path="/retur" element={
            <ProtectedRoute>
              <Retur />
            </ProtectedRoute>
          } />
          
          {/* Pemesanan - accessible by manager and admin (Requirement 5.2) */}
          <Route path="/pemesanan" element={
            <ProtectedRoute>
              <Pemesanan />
            </ProtectedRoute>
          } />
          
          {/* Laporan - accessible by all authenticated users */}
          <Route path="/laporan" element={
            <ProtectedRoute>
              <Laporan />
            </ProtectedRoute>
          } />
          
          {/* User Management - accessible by admin only (Requirement 5.1) */}
          <Route path="/user-management" element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          } />
          
          {/* Audit Log - accessible by admin only (Audit-log Requirement 3.1) */}
          <Route path="/audit-log" element={
            <ProtectedRoute>
              <AuditLog />
            </ProtectedRoute>
          } />
          
          {/* Outlet Management - accessible by admin only (Multi-outlet Requirement 1.1) */}
          <Route path="/outlet" element={
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          } />
          
          {/* Stock Transfer - accessible by manager and admin (Multi-outlet Requirement 4.1) */}
          <Route path="/stock-transfer" element={
            <ProtectedRoute>
              <StockTransfer />
            </ProtectedRoute>
          } />
          
          {/* Stock Opname - accessible by staff, manager and admin (Barcode-scanner Requirement 5.1) */}
          <Route path="/stock-opname" element={
            <ProtectedRoute>
              <StockOpname />
            </ProtectedRoute>
          } />
          
          {/* Label Print - accessible by manager and admin (Barcode-scanner Requirement 6.1) */}
          <Route path="/label-print" element={
            <ProtectedRoute>
              <LabelPrint />
            </ProtectedRoute>
          } />
          
          {/* Profile - accessible by all authenticated users */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          
          {/* Settings - accessible by admin only */}
          <Route path="/pengaturan" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
};

/**
 * Authenticated App Content
 * Handles outlet selection requirement after login
 * Requirements: 2.3, 2.4, 7.2, 7.3
 */
const AuthenticatedApp: React.FC = () => {
  const [activeRoute, setActiveRoute] = useState('/');
  const { needsOutletSelection, isLoading: outletLoading } = useOutlet();

  const handleNavigate = (route: string) => {
    setActiveRoute(route);
  };

  // Show outlet selection modal if user has multiple outlets and no selection
  // Requirements: 2.4, 7.3
  if (needsOutletSelection && !outletLoading) {
    return (
      <Router>
        <OutletSelectionModal 
          isOpen={true}
          onSelect={() => {
            // Outlet selected, modal will close automatically via needsOutletSelection becoming false
          }}
        />
      </Router>
    );
  }

  return (
    <Router>
      <AppRoutes activeRoute={activeRoute} onNavigate={handleNavigate} />
    </Router>
  );
};

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Login />;
  }

  // Wrap authenticated content with OutletProvider
  // Requirements: 2.3, 2.4, 7.2
  return (
    <OutletProvider>
      <AuthenticatedApp />
    </OutletProvider>
  );
}

export default App;