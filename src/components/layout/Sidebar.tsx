import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  Settings,
  Users,
  LogOut,
  Store,
  Tag,
  Truck,
  Shield,
  User,
  ArrowRightLeft,
  Percent,
  ClipboardList,
  RotateCcw,
  ScrollText
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { AppLogo } from '../ui/AppLogo';

import { supabase } from '../../lib/supabaseClient';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  route: string;
  permissionRoute: string; // Route used for permission checking
}

// All menu items with their permission routes
const allMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', route: '/', permissionRoute: '/' },
  { icon: ShoppingCart, label: 'Kasir', route: '/kasir', permissionRoute: '/kasir' },
  { icon: Package, label: 'Inventori', route: '/inventori', permissionRoute: '/inventory' },
  { icon: Tag, label: 'Kategori', route: '/kategori', permissionRoute: '/kategori' },
  { icon: Truck, label: 'Supplier', route: '/supplier', permissionRoute: '/supplier' },
  { icon: Percent, label: 'Diskon & Promo', route: '/diskon', permissionRoute: '/diskon' },
  { icon: RotateCcw, label: 'Retur & Refund', route: '/retur', permissionRoute: '/retur' },
  { icon: FileText, label: 'Pemesanan', route: '/pemesanan', permissionRoute: '/pemesanan' },
  { icon: FileText, label: 'Laporan', route: '/laporan', permissionRoute: '/laporan' },
  { icon: Store, label: 'Outlet', route: '/outlet', permissionRoute: '/outlet' },
  { icon: ArrowRightLeft, label: 'Transfer Stok', route: '/stock-transfer', permissionRoute: '/stock-transfer' },
  { icon: ClipboardList, label: 'Stock Opname', route: '/stock-opname', permissionRoute: '/stock-opname' },
  { icon: Shield, label: 'User Management', route: '/user-management', permissionRoute: '/users' },
  { icon: ScrollText, label: 'Audit Log', route: '/audit-log', permissionRoute: '/audit-log' },
  { icon: Settings, label: 'Pengaturan', route: '/pengaturan', permissionRoute: '/settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeRoute, onNavigate }) => {
  const { user, logout, canAccessRoute } = useAuthStore();
  const navigate = useNavigate();

  // Filter menu items based on user's role permissions (Requirement 5.5)
  const accessibleMenuItems = useMemo(() => {
    return allMenuItems.filter(item => canAccessRoute(item.permissionRoute));
  }, [canAccessRoute]);

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 bg-gradient-dark shadow-2xl h-screen flex flex-col"
    >
      <div className="p-6 border-b border-white/10 flex flex-col items-center text-center">
        <AppLogo size="md" className="mb-2" />
        <p className="text-gray-300 text-sm mt-1">Sistem Kasir Modern</p>
      </div>

      <nav className="p-4 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {accessibleMenuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.route;
            
            return (
              <motion.li
                key={item.route}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <button
                  onClick={() => {
                    onNavigate(item.route);
                    navigate(item.route);
                  }}
                  className={cn(
                    "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                    "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500",
                    isActive 
                      ? "bg-primary-600 text-white shadow-premium" 
                      : "text-gray-300 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10">
        {/* User Profile Section */}
        <button
          onClick={() => {
            onNavigate('/profile');
            navigate('/profile');
          }}
          className="w-full flex items-center space-x-3 mb-4 p-2 rounded-lg hover:bg-white/10 transition-all duration-200"
        >
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-medium">{user?.full_name}</p>
            <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
          </div>
        </button>
        
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            logout();
          }}
          className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </motion.div>
  );
};
