import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Download, 
  AlertTriangle, 
  Filter,
  DollarSign,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  getStockReport, 
  StockReportData, 
  StockFilters,
  StockStatus 
} from '../../api/reports';
import { exportReport } from '../../api/export';

import { OutletFilter } from '../../api/reports';

interface StockReportProps {
  onProductClick?: (productId: string) => void;
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
 * Get status badge styling
 */
function getStatusBadge(status: StockStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'low':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Stok Rendah' };
    case 'overstocked':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Overstock' };
    default:
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Normal' };
  }
}

export const StockReport: React.FC<StockReportProps> = ({ onProductClick, outletFilter }) => {
  const [reportData, setReportData] = useState<StockReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StockFilters>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadReport();
  }, [filters, outletFilter]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Apply outlet filter for multi-outlet support (Requirements: 6.2, 6.3)
      const data = await getStockReport(filters, outletFilter);
      setReportData(data);
    } catch (err) {
      setError('Gagal memuat laporan stok');
      console.error('Failed to load stock report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;

    const exportData = reportData.products.map(product => ({
      'Nama Produk': product.productName,
      'Stok Saat Ini': product.currentStock,
      'Stok Minimum': product.minStock,
      'Status': product.stockStatus,
      'Harga': product.price,
      'Nilai Stok': product.stockValue,
    }));

    exportReport({
      reportType: 'stock',
      data: exportData,
      columns: ['Nama Produk', 'Stok Saat Ini', 'Stok Minimum', 'Status', 'Harga', 'Nilai Stok'],
    });
  };

  const handleStatusFilter = (status: StockStatus | '') => {
    setFilters(prev => ({
      ...prev,
      stockStatus: status || undefined,
    }));
  };

  // Filter products by search term
  const filteredProducts = reportData?.products.filter(product =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cari Produk
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nama produk..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status Stok
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    value={filters.stockStatus || ''}
                    onChange={(e) => handleStatusFilter(e.target.value as StockStatus | '')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Semua Status</option>
                    <option value="low">Stok Rendah</option>
                    <option value="normal">Normal</option>
                    <option value="overstocked">Overstock</option>
                  </select>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Package className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Produk
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : reportData?.products.length || 0}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Stok Rendah
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : reportData?.lowStockCount || 0}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Nilai Inventori
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : formatCurrency(reportData?.totalInventoryValue || 0)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2 text-primary-600" />
            Daftar Stok Produk
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-gray-500">
              Memuat data...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Tidak ada produk ditemukan
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Produk</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Stok</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Min. Stok</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Harga</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Nilai Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => {
                    const statusBadge = getStatusBadge(product.stockStatus);
                    return (
                      <motion.tr
                        key={product.productId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          onProductClick ? 'cursor-pointer' : ''
                        } ${product.stockStatus === 'low' ? 'bg-red-50/50' : ''}`}
                        onClick={() => onProductClick?.(product.productId)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <Package className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {product.productName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={product.stockStatus === 'low' ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                            {product.currentStock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500">
                          {product.minStock}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {formatCurrency(product.stockValue)}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={5} className="py-3 px-4 text-right text-gray-700">
                      Total Nilai Inventori:
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">
                      {formatCurrency(reportData?.totalInventoryValue || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReport;
