/**
 * Retur List Component
 * 
 * Display returns with status
 * Filter by status and date
 * 
 * Requirements: 1.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  Loader2, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Return, ReturnStatus } from '@/types';
import { getReturns, ReturnFilters } from '@/api/returns';

interface ReturListProps {
  onSelectReturn: (returnData: Return) => void;
  refreshTrigger?: number;
}

const STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_approval: { 
    label: 'Menunggu Persetujuan', 
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock
  },
  approved: { 
    label: 'Disetujui', 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle
  },
  completed: { 
    label: 'Selesai', 
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle
  },
  rejected: { 
    label: 'Ditolak', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle
  },
  cancelled: { 
    label: 'Dibatalkan', 
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
    icon: XCircle
  },
};

export const ReturList: React.FC<ReturListProps> = ({
  onSelectReturn,
  refreshTrigger = 0,
}) => {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load returns
  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: ReturnFilters = {};
      
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (startDate) {
        filters.start_date = startDate;
      }
      if (endDate) {
        filters.end_date = endDate;
      }

      const data = await getReturns(filters);
      setReturns(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data retur');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns, refreshTrigger]);

  // Filter returns by search term
  const filteredReturns = returns.filter(ret => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ret.return_number.toLowerCase().includes(term) ||
      ret.transaction_id.toLowerCase().includes(term)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const clearFilters = () => {
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const hasActiveFilters = statusFilter || startDate || endDate || searchTerm;

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor retur..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? 'border-primary-500 text-primary-600' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full">
              Aktif
            </span>
          )}
        </Button>

        {/* Refresh */}
        <Button variant="outline" onClick={loadReturns} disabled={loading}>
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Semua Status</option>
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Reset Filter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Memuat data...</span>
        </div>
      )}

      {/* Returns List */}
      {!loading && filteredReturns.length === 0 && (
        <div className="text-center py-12">
          <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? 'Tidak ada retur yang sesuai filter' : 'Belum ada data retur'}
          </p>
        </div>
      )}

      {!loading && filteredReturns.length > 0 && (
        <div className="space-y-3">
          {filteredReturns.map((ret) => {
            const statusConfig = STATUS_CONFIG[ret.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div 
                key={ret.id}
                onClick={() => onSelectReturn(ret)}
                className="cursor-pointer"
              >
                <Card className="hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                  <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Return Number & Status */}
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {ret.return_number}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        {ret.requires_approval && ret.status === 'pending_approval' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                            Perlu Approval
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(ret.created_at)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Transaksi:</span>{' '}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {ret.transaction_id.slice(0, 8)}...
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Item:</span>{' '}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {ret.items?.length || 0} produk
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Refund Amount & Arrow */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Refund</p>
                        <p className="text-lg font-bold text-primary-600">
                          Rp {ret.total_refund.toLocaleString()}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Results Count */}
      {!loading && filteredReturns.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Menampilkan {filteredReturns.length} retur
        </p>
      )}
    </div>
  );
};

export default ReturList;
