import React from 'react';
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
  Store
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabaseClient';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', route: '/' },
  { icon: ShoppingCart, label: 'Kasir', route: '/kasir' },
  { icon: Package, label: 'Inventori', route: '/inventori' },
  { icon: FileText, label: 'Pemesanan', route: '/pemesanan' },
  { icon: FileText, label: 'Laporan', route: '/laporan' },
  { icon: Users, label: 'Pengaturan', route: '/pengaturan' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeRoute, onNavigate }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 bg-gradient-dark shadow-2xl h-screen fixed left-0 top-0 z-50"
    >
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-purple rounded-lg flex items-center justify-center">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-display font-bold text-lg">POS Premium</h1>
            <p className="text-gray-300 text-sm">Sistem Kasir Modern</p>
          </div>
        </div>
      </div>

      <nav className="p-4 flex-1">
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
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
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">{user?.full_name}</p>
            <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        
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
