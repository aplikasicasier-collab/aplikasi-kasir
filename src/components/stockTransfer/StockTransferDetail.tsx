/**
 * Stock Transfer Detail Component
 * 
 * Display transfer info and items
 * Add approve/complete/cancel buttons
 * 
 * Requirements: 4.3
 */

import React, { useState } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle, 
  ArrowRightLeft, 
  CheckCircle, 
  XCircle, 
  Clock,
  Store,
  Package,
  Calendar,
  User,
  FileText
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StockTransfer, TransferStatus } from '@/api/stockTransfers';

interface StockTransferDetailProps {
  isOpen: boolean;
  transfer: StockTransfer | null;
  onApprove: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onClose: () => void;
  canApprove?: boolean;
  canComplete?: boolean;
  canCancel?: boolean;
}

const STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_COLORS: Record<TransferStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};


const STATUS_ICONS: Record<TransferStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

export const StockTransferDetail: React.FC<StockTransferDetailProps> = ({
  isOpen,
  transfer,
  onApprove,
  onComplete,
  onCancel,
  onClose,
  canApprove = true,
  canComplete = true,
  canCancel = true,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'complete' | 'cancel' | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTotalQuantity = (): number => {
    return transfer?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  };

  const handleAction = async (action: 'approve' | 'complete' | 'cancel') => {
    if (!transfer) return;
    
    setIsProcessing(true);
    setActionError(null);
    
    try {
      switch (action) {
        case 'approve':
          await onApprove(transfer.id);
          break;
        case 'complete':
          await onComplete(transfer.id);
          break;
        case 'cancel':
          await onCancel(transfer.id);
          break;
      }
      setConfirmAction(null);
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      setActionError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !transfer) return null;

  const showApproveButton = canApprove && transfer.status === 'pending';
  const showCompleteButton = canComplete && transfer.status === 'approved';
  const showCancelButton = canCancel && (transfer.status === 'pending' || transfer.status === 'approved');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Detail Transfer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Action Error */}
        {actionError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{actionError}</span>
          </div>
        )}

        {/* Transfer Info */}
        <div className="space-y-4">
          {/* Transfer Number and Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">No. Transfer</span>
              <div className="font-mono text-lg font-semibold text-primary-600 dark:text-primary-400">
                {transfer.transfer_number}
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${STATUS_COLORS[transfer.status]}`}>
              {STATUS_ICONS[transfer.status]}
              <span className="font-medium">{STATUS_LABELS[transfer.status]}</span>
            </div>
          </div>

          {/* Outlet Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Outlet */}
            <div className="p-4 border dark:border-gray-600 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <Store className="w-4 h-4" />
                <span className="text-sm font-medium">Outlet Asal</span>
              </div>
              <div className="text-gray-900 dark:text-white font-medium">
                {transfer.source_outlet?.name || '-'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {transfer.source_outlet?.code || ''}
              </div>
            </div>

            {/* Destination Outlet */}
            <div className="p-4 border dark:border-gray-600 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <Store className="w-4 h-4" />
                <span className="text-sm font-medium">Outlet Tujuan</span>
              </div>
              <div className="text-gray-900 dark:text-white font-medium">
                {transfer.destination_outlet?.name || '-'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {transfer.destination_outlet?.code || ''}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Dibuat</span>
                <div className="text-gray-900 dark:text-white">{formatDate(transfer.created_at)}</div>
              </div>
            </div>
            {transfer.completed_at && (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Selesai</span>
                  <div className="text-gray-900 dark:text-white">{formatDate(transfer.completed_at)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="p-4 border dark:border-gray-600 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Catatan</span>
              </div>
              <div className="text-gray-900 dark:text-white">{transfer.notes}</div>
            </div>
          )}


          {/* Items */}
          <div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-3">
              <Package className="w-4 h-4" />
              <span className="font-medium">Item Transfer</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({transfer.items?.length || 0} produk, {getTotalQuantity()} unit)
              </span>
            </div>
            
            {transfer.items && transfer.items.length > 0 ? (
              <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Produk
                      </th>
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Barcode
                      </th>
                      <th className="text-right py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Jumlah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfer.items.map((item, index) => (
                      <tr key={item.id || index} className="border-t dark:border-gray-600">
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {item.product?.name || 'Unknown Product'}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-sm">
                          {item.product?.barcode || '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-medium">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <td colSpan={2} className="py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-gray-900 dark:text-white">
                        {getTotalQuantity()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center text-gray-500 dark:text-gray-400">
                Tidak ada item
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Dialog */}
        {confirmAction && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-3">
              {confirmAction === 'approve' && 'Apakah Anda yakin ingin menyetujui transfer ini?'}
              {confirmAction === 'complete' && 'Apakah Anda yakin ingin menyelesaikan transfer ini? Stok akan dipindahkan.'}
              {confirmAction === 'cancel' && 'Apakah Anda yakin ingin membatalkan transfer ini?'}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={isProcessing}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction(confirmAction)}
                disabled={isProcessing}
                className={confirmAction === 'cancel' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Ya, Lanjutkan'
                )}
              </Button>
            </div>
          </div>
        )}


        {/* Action Buttons */}
        {(showApproveButton || showCompleteButton || showCancelButton) && !confirmAction && (
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t dark:border-gray-600">
            {showCancelButton && (
              <Button
                variant="outline"
                onClick={() => setConfirmAction('cancel')}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Batalkan
              </Button>
            )}
            
            <div className="flex-1" />
            
            {showApproveButton && (
              <Button
                onClick={() => setConfirmAction('approve')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Setujui
              </Button>
            )}
            
            {showCompleteButton && (
              <Button
                onClick={() => setConfirmAction('complete')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Selesaikan Transfer
              </Button>
            )}
          </div>
        )}

        {/* Close Button for completed/cancelled transfers */}
        {!showApproveButton && !showCompleteButton && !showCancelButton && (
          <div className="flex justify-end mt-6 pt-4 border-t dark:border-gray-600">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockTransferDetail;
