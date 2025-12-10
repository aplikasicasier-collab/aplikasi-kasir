import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Download, 
  Percent, 
  ShoppingCart, 
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  getDiscountReportSummary, 
  getDiscountedTransactions,
  DiscountReportSummary,
  DateRange 
} from '../../api/discountReports';
import { exportReport } from '../../api/export';
import { OutletFilter } from '../../api/reports';
import type { Transaction } from '../../types';

interface DiscountReportProps {
  outletFilter?: OutletFilter;
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

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


/**
 * Discount Report Component
 * Displays total sales with discounts, total discount amount given, and date range filter
 * Requirements: 5.1, 5.2, 5.4
 */
export const DiscountReport: React.FC<DiscountReportProps> = ({ outletFilter }) => {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [reportData, setReportData] = useState<DiscountReportSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [dateRange, outletFilter]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load discount report summary - Requirements: 5.1, 5.2
      const summary = await getDiscountReportSummary(dateRange);
      setReportData(summary);

      // Load discounted transactions - Requirements: 5.4
      const txns = await getDiscountedTransactions({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setTransactions(txns);
    } catch (err) {
      setError('Gagal memuat laporan diskon');
      console.error('Failed to load discount report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData || transactions.length === 0) return;

    // Prepare data for export
    const exportData = transactions.map(tx => ({
      'No. Transaksi': tx.transaction_number,
      'Tanggal': formatDate(tx.transaction_date),
      'Total': tx.total_amount,
      'Diskon': tx.discount_amount,
      'Metode Pembayaran': tx.payment_method,
      'Status': tx.status,
    }));

    exportReport({
      reportType: 'discount',
      data: exportData,
      columns: ['No. Transaksi', 'Tanggal', 'Total', 'Diskon', 'Metode Pembayaran', 'Status'],
      dateRange,
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  // Summary statistics - Requirements: 5.1, 5.2
  const stats = reportData ? [
    {
      title: 'Total Penjualan dengan Diskon',
      value: formatCurrency(reportData.totalSalesWithDiscount),
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: 'Total nilai penjualan yang menggunakan diskon',
    },
    {
      title: 'Total Diskon Diberikan',
      value: formatCurrency(reportData.totalDiscountAmount),
      icon: Percent,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Jumlah potongan harga yang diberikan',
    },
    {
      title: 'Jumlah Transaksi',
      value: reportData.transactionCount.toString(),
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Transaksi yang menggunakan diskon',
    },
    {
      title: 'Rata-rata Diskon/Transaksi',
      value: formatCurrency(reportData.averageDiscountPerTransaction),
      icon: TrendingDown,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      description: 'Rata-rata diskon per transaksi',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Date Range Filter - Requirements: 5.4 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={!reportData || transactions.length === 0 || isLoading}
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

      {/* Summary Stats - Requirements: 5.1, 5.2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
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
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>


      {/* Discounted Transactions Table - Requirements: 5.4 */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Transaksi dengan Diskon
          </h3>
          
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Percent className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Tidak ada transaksi dengan diskon pada periode ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      No. Transaksi
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Tanggal
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                      Total
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                      Diskon
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                      Pembayaran
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 20).map((tx, index) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {tx.transaction_number}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {formatCurrency(tx.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-orange-600 text-right font-medium">
                        -{formatCurrency(tx.discount_amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tx.status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : tx.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.status === 'completed' ? 'Selesai' : tx.status === 'pending' ? 'Pending' : 'Dibatalkan'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              
              {transactions.length > 20 && (
                <div className="text-center py-4 text-sm text-gray-500">
                  Menampilkan 20 dari {transactions.length} transaksi
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DiscountReport;
