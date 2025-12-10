import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw,
  Download, 
  Calendar,
  Filter,
  ExternalLink,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  getStockMovements, 
  StockMovementData, 
  MovementFilters,
  MovementType,
  StockMovementItem
} from '../../api/reports';
import { exportReport } from '../../api/export';

import { OutletFilter } from '../../api/reports';

interface StockMovementReportProps {
  onReferenceClick?: (type: string, id: string) => void;
  outletFilter?: OutletFilter;
}

/**
 * Get default date range (last 30 days)
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Format date to Indonesian locale
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get movement type icon and styling
 */
function getMovementTypeInfo(type: MovementType) {
  switch (type) {
    case 'in':
      return { 
        icon: ArrowUpCircle, 
        bg: 'bg-green-100', 
        text: 'text-green-700', 
        label: 'Masuk' 
      };
    case 'out':
      return { 
        icon: ArrowDownCircle, 
        bg: 'bg-red-100', 
        text: 'text-red-700', 
        label: 'Keluar' 
      };
    default:
      return { 
        icon: RefreshCw, 
        bg: 'bg-blue-100', 
        text: 'text-blue-700', 
        label: 'Penyesuaian' 
      };
  }
}

/**
 * Get reference type label
 */
function getReferenceLabel(type?: string): string {
  switch (type) {
    case 'transaction':
      return 'Transaksi';
    case 'purchase_order':
      return 'PO';
    case 'adjustment':
      return 'Penyesuaian';
    default:
      return type || '-';
  }
}

export const StockMovementReport: React.FC<StockMovementReportProps> = ({ 
  onReferenceClick,
  outletFilter
}) => {
  const [reportData, setReportData] = useState<StockMovementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MovementFilters>(getDefaultDateRange());

  useEffect(() => {
    loadReport();
  }, [filters, outletFilter]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Apply outlet filter for multi-outlet support (Requirements: 6.2, 6.3)
      const filtersWithOutlet: MovementFilters = {
        ...filters,
        outletId: outletFilter?.outletId,
      };
      const data = await getStockMovements(filtersWithOutlet);
      setReportData(data);
    } catch (err) {
      setError('Gagal memuat laporan pergerakan stok');
      console.error('Failed to load stock movements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!reportData) return;

    const exportData = reportData.movements.map(movement => ({
      'Tanggal': formatDate(movement.date),
      'Produk': movement.productName,
      'Tipe': getMovementTypeInfo(movement.movementType).label,
      'Qty': movement.quantity,
      'Saldo': movement.runningBalance,
      'Referensi': movement.referenceType ? `${getReferenceLabel(movement.referenceType)} - ${movement.referenceId}` : '-',
    }));

    exportReport({
      reportType: 'movements',
      data: exportData,
      columns: ['Tanggal', 'Produk', 'Tipe', 'Qty', 'Saldo', 'Referensi'],
      dateRange: {
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
      },
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleTypeFilter = (type: MovementType | '') => {
    setFilters(prev => ({
      ...prev,
      movementType: type || undefined,
    }));
  };

  // Calculate summary stats
  const stats = reportData ? {
    totalIn: reportData.movements.filter(m => m.movementType === 'in').reduce((sum, m) => sum + m.quantity, 0),
    totalOut: reportData.movements.filter(m => m.movementType === 'out').reduce((sum, m) => sum + m.quantity, 0),
    totalAdjustment: reportData.movements.filter(m => m.movementType === 'adjustment').length,
  } : { totalIn: 0, totalOut: 0, totalAdjustment: 0 };

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
                    value={filters.startDate || ''}
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
                    value={filters.endDate || ''}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipe Pergerakan
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    value={filters.movementType || ''}
                    onChange={(e) => handleTypeFilter(e.target.value as MovementType | '')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Semua Tipe</option>
                    <option value="in">Masuk</option>
                    <option value="out">Keluar</option>
                    <option value="adjustment">Penyesuaian</option>
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
                <div className="p-3 rounded-lg bg-green-500/10">
                  <ArrowUpCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Masuk
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : stats.totalIn}
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
                <div className="p-3 rounded-lg bg-red-500/10">
                  <ArrowDownCircle className="w-6 h-6 text-red-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Keluar
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : stats.totalOut}
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
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <RefreshCw className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Penyesuaian
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : stats.totalAdjustment}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2 text-primary-600" />
            Riwayat Pergerakan Stok
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-gray-500">
              Memuat data...
            </div>
          ) : !reportData || reportData.movements.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Tidak ada pergerakan stok ditemukan
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Tanggal</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Produk</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Tipe</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Qty</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Saldo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Referensi</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.movements.map((movement, index) => {
                    const typeInfo = getMovementTypeInfo(movement.movementType);
                    const TypeIcon = typeInfo.icon;
                    
                    return (
                      <motion.tr
                        key={movement.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-gray-700">
                          {formatDate(movement.date)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <Package className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {movement.productName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeInfo.bg} ${typeInfo.text}`}>
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={movement.movementType === 'in' ? 'text-green-600' : movement.movementType === 'out' ? 'text-red-600' : 'text-blue-600'}>
                            {movement.movementType === 'in' ? '+' : movement.movementType === 'out' ? '-' : ''}
                            {movement.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {movement.runningBalance}
                        </td>
                        <td className="py-3 px-4">
                          {movement.referenceType && movement.referenceId ? (
                            <button
                              onClick={() => onReferenceClick?.(movement.referenceType!, movement.referenceId!)}
                              className="inline-flex items-center text-primary-600 hover:text-primary-700 hover:underline"
                            >
                              {getReferenceLabel(movement.referenceType)}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockMovementReport;
