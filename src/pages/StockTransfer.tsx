/**
 * Stock Transfer Page
 * 
 * Main page for managing stock transfers between outlets with:
 * - Transfer list with search and filters
 * - Transfer create form modal
 * - Transfer detail view with approve/complete/cancel actions
 * 
 * Requirements: 4.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StockTransferList } from '../components/stockTransfer/StockTransferList';
import { StockTransferForm } from '../components/stockTransfer/StockTransferForm';
import { StockTransferDetail } from '../components/stockTransfer/StockTransferDetail';
import {
  StockTransfer,
  CreateTransferInput,
  getStockTransfers,
  getStockTransferById,
  createStockTransfer,
  approveStockTransfer,
  completeStockTransfer,
  cancelStockTransfer,
} from '../api/stockTransfers';
import { useOutlet } from '../contexts/OutletContext';
import { useAuthStore } from '../stores/authStore';

const StockTransferPage: React.FC = () => {
  // State for transfers data
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showTransferDetail, setShowTransferDetail] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // State for action feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get current outlet and user
  const { currentOutlet } = useOutlet();
  const { user } = useAuthStore();


  // Load transfers on mount
  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStockTransfers();
      setTransfers(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal memuat data transfer';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Handle create new transfer
  const handleCreateNew = useCallback(() => {
    setSelectedTransfer(null);
    setShowTransferForm(true);
  }, []);

  // Handle select transfer for detail view
  const handleSelectTransfer = useCallback(async (transfer: StockTransfer) => {
    // Fetch fresh data for the selected transfer
    try {
      const freshTransfer = await getStockTransferById(transfer.id);
      if (freshTransfer) {
        setSelectedTransfer(freshTransfer);
        setShowTransferDetail(true);
      }
    } catch (e) {
      console.error('Failed to fetch transfer details:', e);
      setSelectedTransfer(transfer);
      setShowTransferDetail(true);
    }
  }, []);

  // Handle submit new transfer
  const handleSubmitTransfer = useCallback(async (input: CreateTransferInput) => {
    if (!user?.id) {
      throw new Error('User tidak terautentikasi');
    }
    
    await createStockTransfer(input, user.id);
    setActionMessage({ type: 'success', text: 'Transfer stok berhasil dibuat' });
    setShowTransferForm(false);
    await loadTransfers();
  }, [user?.id, loadTransfers]);

  // Handle approve transfer
  const handleApproveTransfer = useCallback(async (id: string) => {
    if (!user?.id) {
      throw new Error('User tidak terautentikasi');
    }
    
    await approveStockTransfer(id, user.id);
    setActionMessage({ type: 'success', text: 'Transfer berhasil disetujui' });
    await loadTransfers();
  }, [user?.id, loadTransfers]);

  // Handle complete transfer
  const handleCompleteTransfer = useCallback(async (id: string) => {
    await completeStockTransfer(id);
    setActionMessage({ type: 'success', text: 'Transfer berhasil diselesaikan. Stok telah dipindahkan.' });
    await loadTransfers();
  }, [loadTransfers]);

  // Handle cancel transfer
  const handleCancelTransfer = useCallback(async (id: string) => {
    await cancelStockTransfer(id);
    setActionMessage({ type: 'success', text: 'Transfer berhasil dibatalkan' });
    await loadTransfers();
  }, [loadTransfers]);


  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-primary-600" />
            Transfer Stok
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola transfer stok antar outlet
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

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <Button size="sm" variant="outline" onClick={loadTransfers} className="ml-auto">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Main Content */}
      <Card className="p-6">
        <StockTransferList
          transfers={transfers}
          loading={loading}
          onSelect={handleSelectTransfer}
          onCreateNew={handleCreateNew}
        />
      </Card>

      {/* Transfer Form Modal */}
      <StockTransferForm
        isOpen={showTransferForm}
        onSubmit={handleSubmitTransfer}
        onClose={() => setShowTransferForm(false)}
        currentOutletId={currentOutlet?.id}
      />

      {/* Transfer Detail Modal */}
      <StockTransferDetail
        isOpen={showTransferDetail}
        transfer={selectedTransfer}
        onApprove={handleApproveTransfer}
        onComplete={handleCompleteTransfer}
        onCancel={handleCancelTransfer}
        onClose={() => {
          setShowTransferDetail(false);
          setSelectedTransfer(null);
        }}
      />
    </div>
  );
};

export default StockTransferPage;
