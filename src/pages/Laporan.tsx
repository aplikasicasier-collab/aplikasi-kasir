import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  ArrowLeftRight,
  Store,
  Percent,
  RotateCcw
} from 'lucide-react';
import { 
  DashboardSummary, 
  SalesReport, 
  StockReport, 
  StockMovementReport,
  DiscountReport,
  ReturnReport
} from '../components/reports';
import { getDashboardSummary, DashboardData, OutletFilter } from '../api/reports';
import { useOutlet } from '../contexts/OutletContext';
import { Outlet } from '../types';

type TabType = 'dashboard' | 'sales' | 'stock' | 'movements' | 'discount' | 'return';

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
  { id: 'discount', label: 'Diskon', icon: Percent },
  { id: 'return', label: 'Retur', icon: RotateCcw },
];

export const Laporan: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  
  // Outlet context for multi-outlet support (Requirements: 6.1, 6.2, 6.3, 6.4)
  const { currentOutlet, availableOutlets } = useOutlet();
  
  // Outlet filter state - defaults to current outlet
  const [selectedOutletId, setSelectedOutletId] = useState<string | undefined>(undefined);
  
  // Initialize selected outlet when current outlet changes
  useEffect(() => {
    if (currentOutlet && !selectedOutletId) {
      setSelectedOutletId(currentOutlet.id);
    }
  }, [currentOutlet]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTab, selectedOutletId]);

  const loadDashboardData = async () => {
    setIsDashboardLoading(true);
    try {
      // Apply outlet filter (Requirements: 6.4)
      const outletFilter: OutletFilter | undefined = selectedOutletId 
        ? { outletId: selectedOutletId } 
        : undefined;
      const data = await getDashboardSummary(outletFilter);
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsDashboardLoading(false);
    }
  };
  
  // Get outlet filter for child components
  const getOutletFilter = (): OutletFilter | undefined => {
    return selectedOutletId ? { outletId: selectedOutletId } : undefined;
  };
  
  // Handle outlet filter change
  const handleOutletChange = (outletId: string) => {
    setSelectedOutletId(outletId === 'all' ? undefined : outletId);
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
    const outletFilter = getOutletFilter();
    
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
        return <SalesReport onProductClick={handleProductClick} outletFilter={outletFilter} />;
      case 'stock':
        return <StockReport onProductClick={handleProductClick} outletFilter={outletFilter} />;
      case 'movements':
        return <StockMovementReport onReferenceClick={handleReferenceClick} outletFilter={outletFilter} />;
      case 'discount':
        return <DiscountReport outletFilter={outletFilter} />;
      case 'return':
        return <ReturnReport outletFilter={outletFilter} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header with Outlet Filter - Requirements: 6.1, 6.2, 6.3, 6.4 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
          <p className="text-gray-600 mt-1">
            Analisis penjualan dan stok untuk insight bisnis
          </p>
        </div>
        
        {/* Outlet Filter */}
        {availableOutlets.length > 0 && (
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-gray-500" />
            <select
              value={selectedOutletId || 'all'}
              onChange={(e) => handleOutletChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-sm"
            >
              <option value="all">Semua Outlet</option>
              {availableOutlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
