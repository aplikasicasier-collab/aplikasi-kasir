/**
 * Retur Page
 * 
 * Main page for managing product returns (retur/refund)
 * Integrates all retur components with state management
 * 
 * Requirements: 1.1, 6.1
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  RotateCcw, 
  Plus, 
  Clock,
  List,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  ReturForm, 
  ReturList, 
  ReturDetail, 
  PendingApprovalList, 
  ApprovalModal,
  ReturnPolicyForm,
  ReturnReceiptModal
} from '@/components/retur';
import { Return, Transaction } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { getTransactionById } from '@/api/transactions';
import { useSettingsStore } from '@/stores/settingsStore';

type TabType = 'list' | 'pending' | 'policy';

export const Retur: React.FC = () => {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [showReturForm, setShowReturForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [showReturDetail, setShowReturDetail] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Approval modal state
  const [approvalReturn, setApprovalReturn] = useState<Return | null>(null);
  const [approvalMode, setApprovalMode] = useState<'approve' | 'reject'>('approve');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  // Receipt modal state - Requirements: 6.1
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptReturn, setReceiptReturn] = useState<Return | null>(null);
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);

  // Check if user is manager or admin for approval access
  const canApprove = user?.role === 'admin' || user?.role === 'manager';
  const canManagePolicy = user?.role === 'admin' || user?.role === 'manager';

  // Refresh list
  const refreshList = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle new return success
  const handleReturSuccess = useCallback((returnData: Return) => {
    setShowReturForm(false);
    refreshList();
    // Show detail of newly created return
    setSelectedReturn(returnData);
    setShowReturDetail(true);
  }, [refreshList]);

  // Handle select return from list
  const handleSelectReturn = useCallback((returnData: Return) => {
    setSelectedReturn(returnData);
    setShowReturDetail(true);
  }, []);

  // Handle approval actions
  const handleApprove = useCallback((returnData: Return) => {
    setApprovalReturn(returnData);
    setApprovalMode('approve');
    setShowApprovalModal(true);
  }, []);

  const handleReject = useCallback((returnData: Return) => {
    setApprovalReturn(returnData);
    setApprovalMode('reject');
    setShowApprovalModal(true);
  }, []);

  const handleApprovalSuccess = useCallback(() => {
    setShowApprovalModal(false);
    setApprovalReturn(null);
    refreshList();
  }, [refreshList]);

  // Handle detail update
  const handleDetailUpdate = useCallback(() => {
    refreshList();
  }, [refreshList]);

  // Handle print receipt - Requirements: 6.1
  const handlePrintReceipt = useCallback(async (returnData: Return) => {
    try {
      // Fetch original transaction data
      const result = await getTransactionById(returnData.transaction_id);
      if (result) {
        setReceiptReturn(returnData);
        setReceiptTransaction(result.transaction);
        setShowReceiptModal(true);
      }
    } catch (error) {
      console.error('Failed to load transaction for receipt:', error);
    }
  }, []);
  
  // Close receipt modal
  const handleCloseReceipt = useCallback(() => {
    setShowReceiptModal(false);
    setReceiptReturn(null);
    setReceiptTransaction(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary-600" />
            Retur & Refund
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola pengembalian barang dan refund customer
          </p>
        </div>
        <Button onClick={() => setShowReturForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Buat Retur Baru
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'list'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <List className="w-4 h-4" />
          Daftar Retur
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Persetujuan
          </button>
        )}
        {canManagePolicy && (
          <button
            onClick={() => setActiveTab('policy')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'policy'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            Kebijakan Retur
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && (
        <ReturList
          onSelectReturn={handleSelectReturn}
          refreshTrigger={refreshTrigger}
        />
      )}

      {activeTab === 'pending' && canApprove && (
        <PendingApprovalList
          onSelectReturn={handleSelectReturn}
          onApprove={handleApprove}
          onReject={handleReject}
          refreshTrigger={refreshTrigger}
        />
      )}

      {activeTab === 'policy' && canManagePolicy && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              Pengaturan Kebijakan Retur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReturnPolicyForm />
          </CardContent>
        </Card>
      )}

      {/* Retur Form Modal */}
      <ReturForm
        isOpen={showReturForm}
        onClose={() => setShowReturForm(false)}
        onSuccess={handleReturSuccess}
      />

      {/* Retur Detail Modal */}
      {selectedReturn && (
        <ReturDetail
          returnId={selectedReturn.id}
          isOpen={showReturDetail}
          onClose={() => {
            setShowReturDetail(false);
            setSelectedReturn(null);
          }}
          onUpdate={handleDetailUpdate}
          onPrintReceipt={handlePrintReceipt}
        />
      )}

      {/* Approval Modal */}
      <ApprovalModal
        returnData={approvalReturn}
        isOpen={showApprovalModal}
        mode={approvalMode}
        onClose={() => {
          setShowApprovalModal(false);
          setApprovalReturn(null);
        }}
        onSuccess={handleApprovalSuccess}
      />

      {/* Return Receipt Modal - Requirements: 6.1 */}
      {receiptReturn && receiptTransaction && (
        <ReturnReceiptModal
          isOpen={showReceiptModal}
          onClose={handleCloseReceipt}
          returnData={receiptReturn}
          originalTransaction={receiptTransaction}
          kasirName={user?.full_name || 'Kasir'}
          storeName={settings?.shop_name}
          storeAddress={settings?.address}
          storePhone={settings?.phone}
        />
      )}
    </motion.div>
  );
};

export default Retur;
