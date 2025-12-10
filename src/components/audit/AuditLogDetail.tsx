/**
 * Audit Log Detail Component
 * 
 * Display full log information
 * Show before/after snapshots
 * Highlight changed fields
 * Show user info with role
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import React from 'react';
import {
  X,
  FileText,
  Calendar,
  User,
  Monitor,
  Globe,
  Database,
  Activity,
  ArrowRight,
  Store,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { AuditLog } from '@/api/auditLogs';
import { AuditEventType, AuditEntityType } from '@/lib/auditLogger';

interface AuditLogDetailProps {
  log: AuditLog;
  isOpen: boolean;
  onClose: () => void;
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
  purchase_order: 'Purchase Order',
  return: 'Retur',
  discount: 'Diskon',
  promo: 'Promo',
  outlet: 'Outlet',
};

export const AuditLogDetail: React.FC<AuditLogDetailProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const eventConfig = EVENT_TYPE_CONFIG[log.event_type];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const isChangedField = (field: string): boolean => {
    return log.changed_fields?.includes(field) || false;
  };

  const renderSnapshot = (
    title: string,
    data: Record<string, unknown> | null,
    highlightChanges: boolean = false
  ) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
          Tidak ada data
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {Object.entries(data).map(([key, value]) => {
          const isChanged = highlightChanges && isChangedField(key);
          return (
            <div
              key={key}
              className={`p-2 rounded ${
                isChanged
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                  : 'bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs font-medium ${
                  isChanged
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {key}
                  {isChanged && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                      Berubah
                    </span>
                  )}
                </span>
              </div>
              <pre className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words font-mono">
                {formatValue(value)}
              </pre>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Detail Audit Log
            </h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${eventConfig.color}`}>
              {eventConfig.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4 text-primary-600" />
                Informasi Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Waktu</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Database className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Entity</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {ENTITY_TYPE_LABELS[log.entity_type]}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Entity ID</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                      {log.entity_id || '-'}
                    </p>
                  </div>
                </div>

                {log.outlet_id && (
                  <div className="flex items-start gap-2">
                    <Store className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Outlet ID</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                        {log.outlet_id}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {log.summary && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Summary</p>
                  <p className="text-sm text-gray-900 dark:text-white">{log.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Info - Requirements 4.3 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-primary-600" />
                Informasi User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nama</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.user_name || 'System'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {log.user_role || '-'}
                  </p>
                </div>

                {/* Requirements 4.4: Display IP address and device information */}
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">IP Address</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                      {log.ip_address || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Monitor className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">User Agent</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={log.user_agent || '-'}>
                      {log.user_agent || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Changed Fields - Requirements 4.2 */}
          {log.changed_fields && log.changed_fields.length > 0 && (
            <Card className="border-yellow-200 dark:border-yellow-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-yellow-700 dark:text-yellow-400">
                  <Activity className="w-4 h-4" />
                  Field yang Berubah ({log.changed_fields.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {log.changed_fields.map((field) => (
                    <span
                      key={field}
                      className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Before/After Snapshots - Requirements 4.1 */}
          {(log.old_values || log.new_values) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Old Values */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    Data Sebelum
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto">
                  {renderSnapshot('Data Sebelum', log.old_values, true)}
                </CardContent>
              </Card>

              {/* New Values */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-green-600 dark:text-green-400">
                    <ArrowRight className="w-4 h-4" />
                    Data Sesudah
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto">
                  {renderSnapshot('Data Sesudah', log.new_values, true)}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogDetail;
