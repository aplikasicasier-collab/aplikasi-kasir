import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  ArrowLeftRight 
} from 'lucide-react';
import { 
  DashboardSummary, 
  SalesReport, 
  StockReport, 
  StockMovementReport 
} from '../components/reports';
import { getDashboardSummary, DashboardData } from '../api/reports';

type TabType = 'dashboard' | 'sales' | 'stock' | 'movements';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sales', label: 'Penjualan', icon: TrendingUp },
  { id: 'stock', label: 'Stok', icon: Package },
  { id: 'movements', label: 'Pergerakan', icon: ArrowLeftRight },
];

export const Laporan: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTab]);

  const loadDashboardData = async () => {
    setIsDashboardLoading(true);
    try {
      const data = await getDashboardSummary();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const handleViewDetails = (section: string) => {
    if (section === 'stock') {
      setActiveTab('stock');
    } else if (section === 'sales') {
      setActiveTab('sales');
    }
  };

  const handleProductClick = (productId: string) => {
    console.log('Product clicked:', productId);
    // Could navigate to product detail or show modal
  };

  const handleReferenceClick = (type: string, id: string) => {
    console.log('Reference clicked:', type, id);
    // Could navigate to transaction or PO detail
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardSummary
            data={dashboardData}
            isLoading={isDashboardLoading}
            onViewDetails={handleViewDetails}
          />
        );
      case 'sales':
        return <SalesReport onProductClick={handleProductClick} />;
      case 'stock':
        return <StockReport onProductClick={handleProductClick} />;
      case 'movements':
        return <StockMovementReport onReferenceClick={handleReferenceClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
        <p className="text-gray-600 mt-1">
          Analisis penjualan dan stok untuk insight bisnis
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center px-4 py-3 text-sm font-medium rounded-t-lg
                  transition-colors duration-200
                  ${isActive 
                    ? 'text-primary-600 bg-primary-50' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Laporan;
