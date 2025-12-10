/**
 * Audit Log List Component
 * 
 * Display logs with event type, entity, user, timestamp
 * Add filter controls (date, user, entity, event type)
 * Add search input
 * Pagination
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  User,
  Database,
  Activity,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { AuditLog, AuditLogFilters, getAuditLogs, PaginatedResult } from '@/api/auditLogs';
import { AuditEventType, AuditEntityType } from '@/lib/auditLogger';

interface AuditLogListProps {
  onSelectLog: (log: AuditLog) => void;
  onExport?: () => void;
  refreshTrigger?: number;
}

const EVENT_TYPE_CONFIG: Record<AuditEventType, { label: string; color: string }> = {
  create: { label: 'Buat', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  update: { label: 'Ubah', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  delete: { label: 'Hapus', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  login: { label: 'Login', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  logout: { label: 'Logout', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' },
  transaction: { label: 'Transaksi', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  refund: { label: 'Refund', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  stock_adjustment: { label: 'Stok', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  price_change: { label: 'Harga', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  role_change: { label: 'Role', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
};

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  product: 'Produk',
  transaction: 'Transaksi',
  user: 'Pengguna',
  supplier: 'Supplier',
  category: 'Kategori',
  purchase_order: 'PO',
  return: 'Retur',
  discount: 'Diskon',
  promo: 'Promo',
  outlet: 'Outlet',
};

export const AuditLogList: React.FC<AuditLogListProps> = ({
  onSelectLog,
  onExport,
  refreshTrigger = 0,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventType, setEventType] = useState<AuditEventType | ''>('');
  const [entityType, setEntityType] = useState<AuditEntityType | ''>('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: AuditLogFilters = {};
      if (searchTerm) filters.search = searchTerm;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;
      if (eventType) filters.event_type = eventType;
      if (entityType) filters.entity_type = entityType;

      const result: PaginatedResult<AuditLog> = await getAuditLogs(filters, {
        page: pagination.page,
        pageSize: pagination.pageSize,
      });

      setLogs(result.data);
      setPagination(prev => ({
        ...prev,
        total: result.total,
        totalPages: result.totalPages,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat audit log';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, dateFrom, dateTo, eventType, entityType, pagination.page, pagination.pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, refreshTrigger]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setEventType('');
    setEntityType('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchTerm || dateFrom || dateTo || eventType || entityType;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            placeholder="Cari di summary..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

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

        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <FileText className="w-4 h-4 mr-2" />
            Export
          </Button>
        )}

        <Button variant="outline" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Activity className="w-4 h-4 inline mr-1" />
                  Tipe Event
                </label>
                <select
                  value={eventType}
                  onChange={(e) => {
                    setEventType(e.target.value as AuditEventType | '');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Semua Event</option>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Database className="w-4 h-4 inline mr-1" />
                  Tipe Entity
                </label>
                <select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value as AuditEntityType | '');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Semua Entity</option>
                  {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
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

      {/* Empty State */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? 'Tidak ada log yang sesuai filter' : 'Belum ada audit log'}
          </p>
        </div>
      )}

      {/* Logs Table */}
      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Waktu</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Event</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Entity</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">User</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const eventConfig = EVENT_TYPE_CONFIG[log.event_type];
                return (
                  <tr
                    key={log.id}
                    onClick={() => onSelectLog(log)}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${eventConfig.color}`}>
                        {eventConfig.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {ENTITY_TYPE_LABELS[log.entity_type]}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {log.user_name || 'System'}
                        </span>
                        {log.user_role && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({log.user_role})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {log.summary || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} log
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogList;
