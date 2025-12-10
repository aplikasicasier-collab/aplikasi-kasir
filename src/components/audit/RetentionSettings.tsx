/**
 * Retention Settings Component
 * 
 * Retention days input
 * Archive toggle
 * Storage stats display
 * Manual cleanup button
 * 
 * Requirements: 6.1, 6.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Calendar,
  Archive,
  Trash2,
  RefreshCw,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  HardDrive,
  Clock,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  RetentionSettings as RetentionSettingsType,
  StorageStats,
  getRetentionSettings,
  updateRetentionSettings,
  getStorageStats,
  runRetentionCleanup,
  getLogsToDeleteCount,
} from '@/api/auditRetention';

interface RetentionSettingsProps {
  onSave?: (settings: RetentionSettingsType) => void;
}

export const RetentionSettings: React.FC<RetentionSettingsProps> = ({ onSave }) => {
  const [settings, setSettings] = useState<RetentionSettingsType | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [logsToDelete, setLogsToDelete] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [archiveEnabled, setArchiveEnabled] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [settingsData, statsData, deleteCount] = await Promise.all([
        getRetentionSettings(),
        getStorageStats(),
        getLogsToDeleteCount(),
      ]);

      setSettings(settingsData);
      setStats(statsData);
      setLogsToDelete(deleteCount);
      setRetentionDays(settingsData.retention_days);
      setArchiveEnabled(settingsData.archive_enabled);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat pengaturan';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedSettings = await updateRetentionSettings({
        retention_days: retentionDays,
        archive_enabled: archiveEnabled,
      });

      setSettings(updatedSettings);
      setSuccess('Pengaturan berhasil disimpan');
      onSave?.(updatedSettings);

      // Refresh logs to delete count
      const deleteCount = await getLogsToDeleteCount();
      setLogsToDelete(deleteCount);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCleanup = async () => {
    if (logsToDelete === 0) {
      setError('Tidak ada log yang perlu dihapus');
      return;
    }

    const confirmed = window.confirm(
      `Anda akan menghapus ${logsToDelete} log audit yang lebih lama dari ${retentionDays} hari. Tindakan ini tidak dapat dibatalkan. Lanjutkan?`
    );

    if (!confirmed) return;

    setCleaning(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await runRetentionCleanup();
      setSuccess(`Berhasil menghapus ${result.deleted} log audit`);
      
      // Refresh data
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menjalankan cleanup';
      setError(message);
    } finally {
      setCleaning(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (sizeMB: number) => {
    if (sizeMB < 1) {
      return `${(sizeMB * 1024).toFixed(0)} KB`;
    }
    if (sizeMB >= 1024) {
      return `${(sizeMB / 1024).toFixed(2)} GB`;
    }
    return `${sizeMB.toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Memuat pengaturan...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="w-5 h-5 mr-2 text-primary-600" />
          Pengaturan Retensi Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-400">{success}</span>
          </div>
        )}

        {/* Storage Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Total Log</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.total_logs.toLocaleString('id-ID') || 0}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <HardDrive className="w-4 h-4" />
              <span className="text-sm">Ukuran Storage</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatSize(stats?.logs_size_mb || 0)}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Log Tertua</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(stats?.oldest_log_date || null)}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Log Terbaru</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(stats?.newest_log_date || null)}
            </p>
          </div>
        </div>

        {/* Retention Settings Form */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                Periode Retensi (hari)
              </div>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Math.max(1, Math.min(3650, parseInt(e.target.value) || 1)))}
                min={1}
                max={3650}
                className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Log lebih lama dari {retentionDays} hari akan dihapus saat cleanup
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Minimum 1 hari, maksimum 3650 hari (10 tahun)
            </p>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={archiveEnabled}
                  onChange={(e) => setArchiveEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${archiveEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${archiveEnabled ? 'translate-x-4' : ''}`} />
                </div>
              </div>
              <div>
                <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Archive className="w-4 h-4 mr-1 text-gray-400" />
                  Aktifkan Arsip
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Log yang dihapus akan diarsipkan terlebih dahulu (fitur dalam pengembangan)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Last Cleanup Info */}
        {settings?.last_cleanup_at && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <span className="font-medium">Cleanup terakhir:</span> {formatDate(settings.last_cleanup_at)}
            </p>
          </div>
        )}

        {/* Cleanup Preview */}
        {logsToDelete > 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  {logsToDelete.toLocaleString('id-ID')} log akan dihapus
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Log ini lebih lama dari periode retensi saat ini ({settings?.retention_days || retentionDays} hari)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 hover:bg-primary-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Simpan Pengaturan
          </Button>

          <Button
            variant="outline"
            onClick={handleCleanup}
            disabled={cleaning || logsToDelete === 0}
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
          >
            {cleaning ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Jalankan Cleanup Manual
          </Button>

          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="sm:ml-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RetentionSettings;
