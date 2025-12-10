/**
 * Audit Export Modal Component
 * 
 * Format selection (CSV/JSON)
 * Column selection
 * Export button
 * 
 * Requirements: 5.1
 */

import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileJson,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { AuditLog, AuditLogFilters } from '@/api/auditLogs';
import {
  ExportFormat,
  AuditExportOptions,
  ALL_AUDIT_COLUMNS,
  DEFAULT_AUDIT_COLUMNS,
  exportAuditLogsToFormat,
  downloadExport,
} from '@/api/auditExport';

interface AuditExportModalProps {
  isOpen: boolean;
  logs: AuditLog[];
  filters: AuditLogFilters;
  onClose: () => void;
}

const COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  event_type: 'Tipe Event',
  entity_type: 'Tipe Entity',
  entity_id: 'Entity ID',
  user_id: 'User ID',
  user_name: 'Nama User',
  user_role: 'Role User',
  outlet_id: 'Outlet ID',
  old_values: 'Data Sebelum',
  new_values: 'Data Sesudah',
  changed_fields: 'Field Berubah',
  ip_address: 'IP Address',
  user_agent: 'User Agent',
  summary: 'Summary',
  created_at: 'Waktu',
};

export const AuditExportModal: React.FC<AuditExportModalProps> = ({
  isOpen,
  logs,
  filters,
  onClose,
}) => {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_AUDIT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns([...ALL_AUDIT_COLUMNS]);
  };

  const selectDefaultColumns = () => {
    setSelectedColumns([...DEFAULT_AUDIT_COLUMNS]);
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const options: AuditExportOptions = {
        format,
        filters,
        columns: selectedColumns,
      };

      const result = exportAuditLogsToFormat(logs, options);
      downloadExport(result);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Export Audit Log
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format Export
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('csv')}
                className={`p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
                  format === 'csv'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <FileText className={`w-8 h-8 ${
                  format === 'csv' ? 'text-primary-600' : 'text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  format === 'csv'
                    ? 'text-primary-700 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  CSV
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Untuk Excel/Spreadsheet
                </span>
              </button>

              <button
                onClick={() => setFormat('json')}
                className={`p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
                  format === 'json'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <FileJson className={`w-8 h-8 ${
                  format === 'json' ? 'text-primary-600' : 'text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  format === 'json'
                    ? 'text-primary-700 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  JSON
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Untuk Developer/API
                </span>
              </button>
            </div>
          </div>

          {/* Column Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Kolom yang Diekspor
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectDefaultColumns}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Default
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={selectAllColumns}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Semua
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
              {ALL_AUDIT_COLUMNS.map((column) => {
                const isSelected = selectedColumns.includes(column);
                return (
                  <button
                    key={column}
                    onClick={() => toggleColumn(column)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm ${
                      isSelected
                        ? 'text-primary-700 dark:text-primary-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {COLUMN_LABELS[column] || column}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {selectedColumns.length} kolom dipilih
            </p>
          </div>

          {/* Export Info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{logs.length}</span> log akan diekspor
              {Object.keys(filters).length > 0 && (
                <span className="text-primary-600"> (dengan filter aktif)</span>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedColumns.length === 0}
            className="flex-1"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export {format.toUpperCase()}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditExportModal;
