/**
 * Audit Alert List Component
 * 
 * Display alerts with severity badges
 * Filter by resolved/unresolved
 * Resolve button with notes
 * 
 * Requirements: 7.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  User,
  Loader2,
  RefreshCw,
  Filter,
  X,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  AuditAlert,
  AlertSeverity,
  AlertType,
  AlertFilters,
  getAlerts,
  resolveAlert,
} from '@/api/auditAlerts';

interface AuditAlertListProps {
  refreshTrigger?: number;
}

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; icon: React.ElementType }> = {
  low: {
    label: 'Rendah',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Shield,
  },
  medium: {
    label: 'Sedang',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: AlertTriangle,
  },
  high: {
    label: 'Tinggi',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    icon: ShieldAlert,
  },
  critical: {
    label: 'Kritis',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  failed_login: 'Login Gagal',
  bulk_delete: 'Hapus Massal',
  unusual_transaction: 'Transaksi Tidak Biasa',
  unauthorized_access: 'Akses Tidak Sah',
};

type ResolvedFilter = 'all' | 'unresolved' | 'resolved';

export const AuditAlertList: React.FC<AuditAlertListProps> = ({
  refreshTrigger = 0,
}) => {
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('unresolved');
  const [showFilters, setShowFilters] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | ''>('');
  const [alertTypeFilter, setAlertTypeFilter] = useState<AlertType | ''>('');

  // Resolve modal state
  const [resolvingAlert, setResolvingAlert] = useState<AuditAlert | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: AlertFilters = {};
      
      if (resolvedFilter === 'unresolved') {
        filters.is_resolved = false;
      } else if (resolvedFilter === 'resolved') {
        filters.is_resolved = true;
      }
      
      if (severityFilter) {
        filters.severity = severityFilter;
      }
      
      if (alertTypeFilter) {
        filters.alert_type = alertTypeFilter;
      }

      const data = await getAlerts(filters);
      setAlerts(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat alerts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter, severityFilter, alertTypeFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts, refreshTrigger]);

  const handleResolve = async () => {
    if (!resolvingAlert) return;

    setIsResolving(true);
    setError(null);

    try {
      await resolveAlert(resolvingAlert.id, resolveNotes || undefined);
      setResolvingAlert(null);
      setResolveNotes('');
      await loadAlerts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyelesaikan alert';
      setError(message);
    } finally {
      setIsResolving(false);
    }
  };

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
    setResolvedFilter('unresolved');
    setSeverityFilter('');
    setAlertTypeFilter('');
  };

  const hasActiveFilters = resolvedFilter !== 'unresolved' || severityFilter || alertTypeFilter;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Quick Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={resolvedFilter === 'unresolved' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setResolvedFilter('unresolved')}
          >
            <Clock className="w-4 h-4 mr-1" />
            Belum Selesai
          </Button>
          <Button
            variant={resolvedFilter === 'resolved' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setResolvedFilter('resolved')}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Selesai
          </Button>
          <Button
            variant={resolvedFilter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setResolvedFilter('all')}
          >
            Semua
          </Button>
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? 'border-primary-500 text-primary-600' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>

        <Button variant="outline" onClick={loadAlerts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity
                </label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Semua Severity</option>
                  {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipe Alert
                </label>
                <select
                  value={alertTypeFilter}
                  onChange={(e) => setAlertTypeFilter(e.target.value as AlertType | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Semua Tipe</option>
                  {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => (
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
      {!loading && alerts.length === 0 && (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {resolvedFilter === 'unresolved'
              ? 'Tidak ada alert yang perlu ditangani'
              : 'Tidak ada alert yang ditemukan'}
          </p>
        </div>
      )}

      {/* Alerts List */}
      {!loading && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const severityConfig = SEVERITY_CONFIG[alert.severity];
            const SeverityIcon = severityConfig.icon;

            return (
              <Card
                key={alert.id}
                className={alert.is_resolved ? 'opacity-75' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${severityConfig.color}`}>
                        <SeverityIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityConfig.color}`}>
                            {severityConfig.label}
                          </span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {ALERT_TYPE_LABELS[alert.alert_type]}
                          </span>
                          {alert.is_resolved && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Selesai
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-900 dark:text-white mb-2">
                          {alert.description}
                        </p>

                        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(alert.created_at)}
                          </div>
                          {alert.user_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {alert.user_name}
                            </div>
                          )}
                        </div>

                        {alert.is_resolved && alert.resolution_notes && (
                          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-700 dark:text-green-400">
                            <span className="font-medium">Catatan:</span> {alert.resolution_notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {!alert.is_resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResolvingAlert(alert)}
                        className="flex-shrink-0"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Selesaikan
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Results Count */}
      {!loading && alerts.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Menampilkan {alerts.length} alert
        </p>
      )}

      {/* Resolve Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResolvingAlert(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Selesaikan Alert
              </h3>
              <button
                onClick={() => setResolvingAlert(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {resolvingAlert.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Catatan Penyelesaian (opsional)
                </label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Tambahkan catatan tentang bagaimana alert ini ditangani..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  setResolvingAlert(null);
                  setResolveNotes('');
                }}
                disabled={isResolving}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={handleResolve}
                disabled={isResolving}
                className="flex-1"
              >
                {isResolving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Selesaikan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditAlertList;
