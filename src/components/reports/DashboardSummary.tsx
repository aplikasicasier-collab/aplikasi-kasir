import React from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { DashboardData } from '../../api/reports';

interface DashboardSummaryProps {
  data: DashboardData | null;
  isLoading: boolean;
  onViewDetails?: (section: string) => void;
}

/**
 * Format currency to Indonesian Rupiah
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format date to Indonesian locale
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  data,
  isLoading,
  onViewDetails,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Tidak ada data dashboard tersedia
        </CardContent>
      </Card>
    );
  }

  const todayChange = calculatePercentageChange(data.todaySales, data.yesterdaySales);
  const weekChange = calculatePercentageChange(data.weekSales, data.lastWeekSales);

  const stats = [
    {
      title: 'Penjualan Hari Ini',
      value: formatCurrency(data.todaySales),
      subValue: `${data.todayTransactions} transaksi`,
      change: todayChange,
      compareText: 'vs kemarin',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Penjualan Minggu Ini',
      value: formatCurrency(data.weekSales),
      change: weekChange,
      compareText: 'vs minggu lalu',
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Stok Menipis',
      value: data.lowStockCount.toString(),
      subValue: 'produk perlu restock',
      icon: AlertTriangle,
      color: data.lowStockCount > 0 ? 'text-orange-500' : 'text-green-500',
      bgColor: data.lowStockCount > 0 ? 'bg-orange-500/10' : 'bg-green-500/10',
      onClick: () => onViewDetails?.('stock'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const isPositive = stat.change !== undefined && stat.change >= 0;
          const TrendIcon = isPositive ? TrendingUp : TrendingDown;
          
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div onClick={stat.onClick}>
              <Card 
                className={`hover:shadow-premium transition-shadow duration-300 ${stat.onClick ? 'cursor-pointer' : ''}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    {stat.change !== undefined && (
                      <div className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        <TrendIcon className="w-4 h-4 mr-1" />
                        {Math.abs(stat.change).toFixed(1)}%
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
                    {stat.subValue && (
                      <p className="text-sm text-gray-500 mt-1">{stat.subValue}</p>
                    )}
                    {stat.compareText && (
                      <p className="text-xs text-gray-400 mt-1">{stat.compareText}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-primary-600" />
              Transaksi Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                Belum ada transaksi hari ini
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {tx.transactionNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(tx.transactionDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(tx.totalAmount)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tx.status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tx.status === 'completed' ? 'Selesai' : tx.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DashboardSummary;
