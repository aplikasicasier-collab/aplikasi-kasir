import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getDashboardSummary, DashboardData, getStockReport, StockProductData } from '../api/reports';
import { useOutlet } from '../contexts/OutletContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentOutlet } = useOutlet();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<StockProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const outletFilter = currentOutlet ? { outletId: currentOutlet.id } : undefined;
      
      // Fetch dashboard summary and low stock products in parallel
      const [summary, stockReport] = await Promise.all([
        getDashboardSummary(outletFilter),
        getStockReport({ stockStatus: 'low' }, outletFilter)
      ]);
      
      setDashboardData(summary);
      setLowStockProducts(stockReport.products.slice(0, 5)); // Top 5 low stock
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentOutlet?.id]);

  // Calculate percentage change
  const calculateChange = (current: number, previous: number): { value: string; isPositive: boolean } => {
    if (previous === 0) {
      return { value: current > 0 ? '+100%' : '0%', isPositive: current >= 0 };
    }
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;
    return { 
      value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`, 
      isPositive 
    };
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-800 font-medium mb-2">{error}</p>
          <Button onClick={fetchDashboardData} variant="primary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  const todayChange = dashboardData 
    ? calculateChange(dashboardData.todaySales, dashboardData.yesterdaySales)
    : { value: '0%', isPositive: true };
  
  const weekChange = dashboardData
    ? calculateChange(dashboardData.weekSales, dashboardData.lastWeekSales)
    : { value: '0%', isPositive: true };

  const stats = [
    {
      title: 'Penjualan Hari Ini',
      value: formatCurrency(dashboardData?.todaySales || 0),
      change: todayChange.value,
      isPositive: todayChange.isPositive,
      subtitle: `vs kemarin: ${formatCurrency(dashboardData?.yesterdaySales || 0)}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Transaksi Hari Ini',
      value: (dashboardData?.todayTransactions || 0).toString(),
      change: '',
      isPositive: true,
      subtitle: 'transaksi selesai',
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Penjualan Minggu Ini',
      value: formatCurrency(dashboardData?.weekSales || 0),
      change: weekChange.value,
      isPositive: weekChange.isPositive,
      subtitle: `vs minggu lalu: ${formatCurrency(dashboardData?.lastWeekSales || 0)}`,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Stok Menipis',
      value: (dashboardData?.lowStockCount || 0).toString(),
      change: '',
      isPositive: (dashboardData?.lowStockCount || 0) === 0,
      subtitle: 'produk perlu restock',
      icon: Package,
      color: dashboardData?.lowStockCount ? 'text-orange-500' : 'text-green-500',
      bgColor: dashboardData?.lowStockCount ? 'bg-orange-500/10' : 'bg-green-500/10'
    }
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-8 mt-12 md:mt-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-2">
            Dashboard
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            {currentOutlet 
              ? `Ringkasan performa ${currentOutlet.name}` 
              : 'Selamat datang! Berikut ringkasan performa bisnis Anda.'}
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchDashboardData}
          className="hidden md:flex"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-premium transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    {stat.change && (
                      <div className="text-right flex items-center">
                        {stat.isPositive ? (
                          <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${stat.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                          {stat.change}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.subtitle}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="w-full justify-center"
                  onClick={() => navigate('/kasir')}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Transaksi Baru
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-center"
                  onClick={() => navigate('/inventori')}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Kelola Produk
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-center"
                  onClick={() => navigate('/laporan')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Lihat Laporan
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Low Stock Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-600">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Stok Menipis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-4">
                  <Package className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Semua stok aman!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product) => (
                    <div key={product.productId} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{product.productName}</p>
                        <p className="text-xs text-gray-600">
                          Stok: {product.currentStock} / Min: {product.minStock}
                        </p>
                      </div>
                      <div className="text-orange-600">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                  {dashboardData && dashboardData.lowStockCount > 5 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-orange-600"
                      onClick={() => navigate('/inventori')}
                    >
                      Lihat {dashboardData.lowStockCount - 5} produk lainnya
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-600">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Transaksi Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboardData?.recentTransactions?.length ? (
                <div className="text-center py-4">
                  <ShoppingCart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Belum ada transaksi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData.recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{tx.transactionNumber}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(tx.transactionDate).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600 text-sm">
                          {formatCurrency(tx.totalAmount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
