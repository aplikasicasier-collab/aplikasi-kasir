import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Download, 
  DollarSign, 
  ShoppingCart, 
  TrendingUp 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { SalesChart } from './SalesChart';
import { TopProductsChart } from './TopProductsChart';
import { 
  getSalesReport, 
  SalesReportData, 
  DateRange 
} from '../../api/reports';
import { exportReport } from '../../api/export';

interface SalesReportProps {
  onProductClick?: (productId: string) => void;
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
 * Get default date range (last 30 days)
 */
function getDefaultDateRange(): DateRange {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export const SalesReport: React.FC<SalesReportProps> = ({ onProductClick }) => {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  useEffect(() => {
    loadReport();
  }, [dateRange, viewMode]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const groupBy = viewMode === 'daily' ? 'hour' : 'day';
      const data = await getSalesReport(dateRange, groupBy);
      setReportData(data);
    } catch (err) {
      setError('Gagal memuat laporan penjualan');
      console.error('Failed to load sales report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;

    // Prepare data for export
    const exportData = reportData.salesByPeriod.map(item => ({
      Periode: item.period,
      'Total Penjualan': item.amount,
      'Jumlah Transaksi': item.count,
    }));

    exportReport({
      reportType: 'sales',
      data: exportData,
      columns: ['Periode', 'Total Penjualan', 'Jumlah Transaksi'],
      dateRange,
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const stats = reportData ? [
    {
      title: 'Total Penjualan',
      value: formatCurrency(reportData.totalSales),
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Transaksi',
      value: reportData.totalTransactions.toString(),
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Rata-rata Transaksi',
      value: formatCurrency(reportData.averageTransaction),
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Mulai
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Akhir
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tampilan
                </label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as 'daily' | 'monthly')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="daily">Harian (per jam)</option>
                  <option value="monthly">Bulanan (per hari)</option>
                </select>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={!reportData || isLoading}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Sales Trend Chart */}
      <SalesChart
        data={reportData?.salesByPeriod || []}
        type="line"
        title={viewMode === 'daily' ? 'Trend Penjualan per Jam' : 'Trend Penjualan per Hari'}
        isLoading={isLoading}
      />

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProductsChart
          data={reportData?.topProductsByQuantity || []}
          metric="quantity"
          title="Top 10 Produk (Qty Terjual)"
          isLoading={isLoading}
          onProductClick={onProductClick}
        />
        <TopProductsChart
          data={reportData?.topProductsByRevenue || []}
          metric="revenue"
          title="Top 10 Produk (Revenue)"
          isLoading={isLoading}
          onProductClick={onProductClick}
        />
      </div>
    </div>
  );
};

export default SalesReport;
