/**
 * Approval Modal Component
 * 
 * Approve/reject buttons
 * Reason input field
 * 
 * Requirements: 7.2, 7.3
 */

import React, { useState } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Clock,
  Package,
  Calendar,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Return, ReturnItem } from '@/types';
import { approveReturn, rejectReturn } from '@/api/returnApprovals';

interface ApprovalModalProps {
  returnData: Return | null;
  isOpen: boolean;
  mode: 'approve' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_LABELS: Record<string, string> = {
  damaged: 'Rusak',
  wrong_product: 'Salah Produk',
  not_as_described: 'Tidak Sesuai Deskripsi',
  changed_mind: 'Berubah Pikiran',
  other: 'Lainnya',
};

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  returnData,
  isOpen,
  mode,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const isApprove = mode === 'approve';

  const handleSubmit = async () => {
    if (!returnData) return;

    if (!reason.trim()) {
      setError('Alasan harus diisi');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (isApprove) {
        await approveReturn({
          return_id: returnData.id,
          reason: reason.trim(),
        });
      } else {
        await rejectReturn({
          return_id: returnData.id,
          reason: reason.trim(),
        });
      }
      
      setReason('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal memproses persetujuan';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setReason('');
      setError(null);
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !returnData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isApprove 
            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
            : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
        }`}>
          <div className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <h2 className={`text-xl font-semibold ${
              isApprove ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            }`}>
              {isApprove ? 'Setujui Retur' : 'Tolak Retur'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Return Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-primary-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {returnData.return_number}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                  <Clock className="w-3 h-3" />
                  Menunggu Persetujuan
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatDate(returnData.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Item</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {returnData.items?.length || 0} produk
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Preview */}
              {returnData.items && returnData.items.length > 0 && (
                <div className="mt-3 pt-3 border-t dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Item Retur:</p>
                  <div className="space-y-1">
                    {returnData.items.slice(0, 3).map((item: ReturnItem & { product_name?: string }) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.product_name || `Product ${item.product_id.slice(0, 8)}`}
                          <span className="text-gray-400 ml-1">×{item.quantity}</span>
                        </span>
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {REASON_LABELS[item.reason] || item.reason}
                        </span>
                      </div>
                    ))}
                    {returnData.items.length > 3 && (
                      <p className="text-xs text-gray-400">
                        +{returnData.items.length - 3} item lainnya
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Total Refund */}
              <div className="mt-3 pt-3 border-t dark:border-gray-700 flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Refund</span>
                <span className="text-lg font-bold text-primary-600">
                  Rp {returnData.total_refund.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Warning for Rejection */}
          {!isApprove && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Perhatian
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Retur yang ditolak tidak dapat diproses kembali. Pastikan alasan penolakan sudah benar.
                </p>
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isApprove ? 'Alasan Persetujuan' : 'Alasan Penolakan'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isApprove 
                ? 'Contoh: Retur disetujui karena barang memang rusak dari pabrik...'
                : 'Contoh: Retur ditolak karena sudah melewati batas waktu pengembalian...'
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              disabled={isProcessing}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Alasan ini akan dicatat untuk keperluan audit
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !reason.trim()}
            className={`flex-1 ${
              isApprove 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isApprove ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            {isApprove ? 'Setujui Retur' : 'Tolak Retur'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
