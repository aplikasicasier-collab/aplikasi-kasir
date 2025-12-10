/**
 * Audit Log Page
 * 
 * Main page for viewing audit logs and alerts with:
 * - Tabs for Logs and Alerts
 * - Log list with filters and search
 * - Log detail modal
 * - Alert list with resolve functionality
 * - Export modal
 * 
 * Requirements: 3.1
 */

import React, { useState, useCallback } from 'react';
import { FileText, Bell, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import {
  AuditLogList,
  AuditLogDetail,
  AuditAlertList,
  AuditExportModal,
} from '../components/audit';
import { AuditLog, AuditLogFilters } from '../api/auditLogs';

type TabType = 'logs' | 'alerts';

const AuditLogPage: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('logs');

  // Log detail state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showLogDetail, setShowLogDetail] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLogs, setExportLogs] = useState<AuditLog[]>([]);
  const [exportFilters, setExportFilters] = useState<AuditLogFilters>({});

  // Refresh triggers
  const [logsRefreshTrigger, setLogsRefreshTrigger] = useState(0);
  const [alertsRefreshTrigger, setAlertsRefreshTrigger] = useState(0);

  // Action message state
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle log selection
  const handleSelectLog = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setShowLogDetail(true);
  }, []);

  // Handle close log detail
  const handleCloseLogDetail = useCallback(() => {
    setShowLogDetail(false);
    setSelectedLog(null);
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  // Handle close export modal
  const handleCloseExportModal = useCallback(() => {
    setShowExportModal(false);
  }, []);

  // Clear action message after 3 seconds
  React.useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" />
            Audit Log
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Pantau semua perubahan data dan aktivitas sistem
          </p>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span
            className={`text-sm ${
              actionMessage.type === 'success'
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {actionMessage.text}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === 'logs'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Log Aktivitas
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === 'alerts'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <Bell className="w-4 h-4" />
          Alerts
        </button>
      </div>

      {/* Tab Content */}
      <Card className="p-6">
        {activeTab === 'logs' ? (
          <AuditLogList
            onSelectLog={handleSelectLog}
            onExport={handleExport}
            refreshTrigger={logsRefreshTrigger}
          />
        ) : (
          <AuditAlertList
            refreshTrigger={alertsRefreshTrigger}
          />
        )}
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <AuditLogDetail
          log={selectedLog}
          isOpen={showLogDetail}
          onClose={handleCloseLogDetail}
        />
      )}

      {/* Export Modal */}
      <AuditExportModal
        isOpen={showExportModal}
        logs={exportLogs}
        filters={exportFilters}
        onClose={handleCloseExportModal}
      />
    </div>
  );
};

export default AuditLogPage;
