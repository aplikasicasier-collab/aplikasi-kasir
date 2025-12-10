import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Download, 
  RotateCcw, 
  DollarSign,
  Package,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  getReturnReportSummary, 
  getReturnTrend,
  ReturnReportSummary,
  DateRange 
} from '../../api/returnReports';
import { exportReport } from '../../api/export';
import { OutletFilter } from '../../api/reports';
import { ReturnReason } from '../../api/returns';

interface ReturnReportProps {
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
 * Get reason label in Indonesian
 */
function getReasonLabel(reason: ReturnReason): string {
  const labels: Record<ReturnReason, string> = {
    damaged: 'Rusak',
    wrong_product: 'Salah Produk',
    not_as_described: 'Tidak Sesuai',
    changed_mind: 'Berubah Pikiran',
    other: 'Lainnya',
  };
  return labels[reason] || reason;
}

/**
 * Get reason color for chart
 */
function getReasonColor(reason: ReturnReason): string {
  const colors: Record<ReturnReason, string> = {
    damaged: '#ef4444',
    wrong_product: '#f97316',
    not_as_described: '#eab308',
    changed_mind: '#3b82f6',
    other: '#6b7280',
  };
  return colors[reason] || '#6b7280';
}

/**
 * Return Report Component
 * Displays total returns, total refund amount, breakdown by reason, and top returned products
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export const ReturnReport: React.FC<ReturnReportProps> = ({ outletFilter }) => {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [reportData, setReportData] = useState<ReturnReportSummary | null>(null);
  const [trendData, setTrendData] = useState<Array<{ date: string; count: number; refundAmount: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [dateRange, outletFilter]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load return report summary - Requirements: 5.1, 5.2, 5.3, 5.4
      const summary = await getReturnReportSummary(dateRange);
      setReportData(summary);

      // Load trend data
      const trend = await getReturnTrend(dateRange);
      setTrendData(trend);
    } catch (err) {
      setError('Gagal memuat laporan retur');
      console.error('Failed to load return report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;

    // Prepare data for export
    const exportData = [
      { 'Metrik': 'Total Retur', 'Nilai': reportData.totalReturns },
      { 'Metrik': 'Total Refund', 'Nilai': reportData.totalRefundAmount },
      ...Object.entries(reportData.returnsByReason).map(([reason, count]) => ({
        'Metrik': `Alasan: ${getReasonLabel(reason as ReturnReason)}`,
        'Nilai': count,
      })),
    ];

    exportReport({
      reportType: 'return',
      data: exportData,
      columns: ['Metrik', 'Nilai'],
      dateRange,
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };


  // Summary statistics - Requirements: 5.1, 5.3
  const stats = reportData ? [
    {
      title: 'Total Retur',
      value: reportData.totalReturns.toString(),
      icon: RotateCcw,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Jumlah retur yang selesai',
    },
    {
      title: 'Total Refund',
      value: formatCurrency(reportData.totalRefundAmount),
      icon: DollarSign,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      description: 'Total pengembalian dana',
    },
    {
      title: 'Produk Diretur',
      value: reportData.topReturnedProducts.reduce((sum, p) => sum + p.total_quantity, 0).toString(),
      icon: Package,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Total unit produk diretur',
    },
    {
      title: 'Rata-rata Refund',
      value: formatCurrency(reportData.totalReturns > 0 ? reportData.totalRefundAmount / reportData.totalReturns : 0),
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      description: 'Rata-rata refund per retur',
    },
  ] : [];

  // Calculate total for percentage - Requirements: 5.2
  const totalByReason = reportData 
    ? Object.values(reportData.returnsByReason).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Date Range Filter - Requirements: 5.1 */}
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


      {/* Summary Stats - Requirements: 5.1, 5.3 */}
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

      {/* Breakdown by Reason Chart - Requirements: 5.2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Breakdown Alasan Retur
            </h3>
            
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : !reportData || totalByReason === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Tidak ada data retur pada periode ini</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(Object.entries(reportData.returnsByReason) as [ReturnReason, number][])
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([reason, count], index) => {
                    const percentage = totalByReason > 0 ? (count / totalByReason) * 100 : 0;
                    return (
                      <motion.div
                        key={reason}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {getReasonLabel(reason)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <motion.div
                            className="h-3 rounded-full"
                            style={{ backgroundColor: getReasonColor(reason) }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>


        {/* Top Returned Products - Requirements: 5.4 */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Produk Paling Sering Diretur
            </h3>
            
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : !reportData || reportData.topReturnedProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Tidak ada produk diretur pada periode ini</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reportData.topReturnedProducts.slice(0, 10).map((product, index) => (
                  <motion.div
                    key={product.product_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {product.product_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.return_count} kali retur
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {product.total_quantity}
                      </p>
                      <p className="text-xs text-gray-500">unit</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Return Trend - Requirements: 5.1 */}
      {trendData.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tren Retur Harian
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Tanggal
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                      Jumlah Retur
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                      Total Refund
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((item, index) => (
                    <motion.tr
                      key={item.date}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {new Date(item.date).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {item.count}
                      </td>
                      <td className="py-3 px-4 text-sm text-red-600 text-right font-medium">
                        {formatCurrency(item.refundAmount)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReturnReport;
