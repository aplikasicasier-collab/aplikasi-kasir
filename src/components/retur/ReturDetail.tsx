/**
 * Retur Detail Component
 * 
 * Display return info and items
 * Show refund calculation
 * Complete/cancel buttons
 * 
 * Requirements: 2.1, 2.4
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle, 
  RotateCcw, 
  Receipt, 
  Calendar, 
  User,
  Package,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Wallet,
  Printer
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Return, ReturnItem, ReturnStatus } from '@/types';
import { getReturnById, completeReturn, cancelReturn } from '@/api/returns';
import { RefundMethod } from '@/api/refunds';

interface ReturDetailProps {
  returnId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onPrintReceipt?: (returnData: Return) => void;
}

const STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_approval: { 
    label: 'Menunggu Persetujuan', 
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock
  },
  approved: { 
    label: 'Disetujui', 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle
  },
  completed: { 
    label: 'Selesai', 
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle
  },
  rejected: { 
    label: 'Ditolak', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle
  },
  cancelled: { 
    label: 'Dibatalkan', 
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
    icon: XCircle
  },
};

const REASON_LABELS: Record<string, string> = {
  damaged: 'Rusak',
  wrong_product: 'Salah Produk',
  not_as_described: 'Tidak Sesuai Deskripsi',
  changed_mind: 'Berubah Pikiran',
  other: 'Lainnya',
};

const REFUND_METHODS: { value: RefundMethod; label: string; icon: React.ElementType }[] = [
  { value: 'cash', label: 'Tunai', icon: DollarSign },
  { value: 'card', label: 'Kartu', icon: CreditCard },
  { value: 'e-wallet', label: 'E-Wallet', icon: Wallet },
];

export const ReturDetail: React.FC<ReturDetailProps> = ({
  returnId,
  isOpen,
  onClose,
  onUpdate,
  onPrintReceipt,
}) => {
  const [returnData, setReturnData] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRefundMethod, setSelectedRefundMethod] = useState<RefundMethod>('cash');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Load return data
  useEffect(() => {
    if (isOpen && returnId) {
      loadReturnData();
    }
  }, [isOpen, returnId]);

  const loadReturnData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getReturnById(returnId);
      if (!data) {
        setError('Retur tidak ditemukan');
        return;
      }
      setReturnData(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data retur');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!returnData) return;

    setIsProcessing(true);
    setError(null);

    try {
      await completeReturn(returnData.id, selectedRefundMethod);
      setShowCompleteConfirm(false);
      onUpdate();
      await loadReturnData();
    } catch (err: any) {
      setError(err.message || 'Gagal menyelesaikan retur');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!returnData) return;

    setIsProcessing(true);
    setError(null);

    try {
      await cancelReturn(returnData.id);
      setShowCancelConfirm(false);
      onUpdate();
      await loadReturnData();
    } catch (err: any) {
      setError(err.message || 'Gagal membatalkan retur');
    } finally {
      setIsProcessing(false);
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

  const getRefundMethodLabel = (method: string | null) => {
    if (!method) return '-';
    const found = REFUND_METHODS.find(m => m.value === method);
    return found?.label || method;
  };

  const canComplete = returnData?.status === 'approved';
  const canCancel = returnData?.status === 'pending_approval' || returnData?.status === 'approved';
  const isCompleted = returnData?.status === 'completed';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Detail Retur
            </h2>
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
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Memuat data...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {/* Return Data */}
          {!loading && returnData && (
            <>
              {/* Return Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-primary-600" />
                      {returnData.return_number}
                    </CardTitle>
                    {(() => {
                      const statusConfig = STATUS_CONFIG[returnData.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusConfig.label}
                        </span>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal Dibuat</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(returnData.created_at)}
                        </p>
                      </div>
                    </div>
                    {returnData.completed_at && (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal Selesai</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(returnData.completed_at)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <Receipt className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Transaksi Asal</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {returnData.transaction?.transaction_number || returnData.transaction_id.slice(0, 8) + '...'}
                        </p>
                      </div>
                    </div>
                    {returnData.refund_method && (
                      <div className="flex items-start gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Metode Refund</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {getRefundMethodLabel(returnData.refund_method)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Approval Info */}
                  {returnData.requires_approval && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Memerlukan Persetujuan Manager</span>
                      </div>
                      {returnData.approved_by && returnData.approval_reason && (
                        <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-500">
                          Alasan: {returnData.approval_reason}
                        </p>
                      )}
                      {returnData.rejected_reason && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          Alasan Penolakan: {returnData.rejected_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {returnData.notes && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Catatan</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{returnData.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Return Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-600" />
                    Item Retur ({returnData.items?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {returnData.items?.map((item: ReturnItem & { product_name?: string }) => (
                      <div 
                        key={item.id}
                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {item.product_name || `Product ${item.product_id.slice(0, 8)}`}
                            </h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                                {REASON_LABELS[item.reason] || item.reason}
                              </span>
                              {item.is_damaged && (
                                <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                  Rusak
                                </span>
                              )}
                              {!item.is_resellable && (
                                <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                                  Tidak Dapat Dijual
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.quantity} × Rp {item.original_price.toLocaleString()}
                            </p>
                            {item.discount_amount > 0 && (
                              <p className="text-xs text-red-500">
                                - Rp {(item.discount_amount * item.quantity).toLocaleString()}
                              </p>
                            )}
                            <p className="font-medium text-gray-900 dark:text-white">
                              Rp {item.refund_amount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {item.reason_detail && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            Detail: {item.reason_detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Total Refund */}
                  <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        Total Refund
                      </span>
                      <span className="text-2xl font-bold text-primary-600">
                        Rp {returnData.total_refund.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Complete Confirmation */}
              {showCompleteConfirm && canComplete && (
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Pilih Metode Refund
                    </h4>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {REFUND_METHODS.map((method) => {
                        const Icon = method.icon;
                        return (
                          <button
                            key={method.value}
                            onClick={() => setSelectedRefundMethod(method.value)}
                            className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
                              selectedRefundMethod === method.value
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <Icon className={`w-6 h-6 ${
                              selectedRefundMethod === method.value
                                ? 'text-primary-600'
                                : 'text-gray-400'
                            }`} />
                            <span className={`text-sm font-medium ${
                              selectedRefundMethod === method.value
                                ? 'text-primary-700 dark:text-primary-400'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {method.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowCompleteConfirm(false)}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleComplete}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Selesaikan Retur
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cancel Confirmation */}
              {showCancelConfirm && canCancel && (
                <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                  <CardContent className="p-4">
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Apakah Anda yakin ingin membatalkan retur ini?
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        Tidak
                      </Button>
                      <Button
                        onClick={handleCancel}
                        disabled={isProcessing}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-2" />
                        )}
                        Ya, Batalkan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && returnData && (
          <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Tutup
            </Button>
            
            {isCompleted && onPrintReceipt && (
              <Button
                variant="outline"
                onClick={() => onPrintReceipt(returnData)}
                className="flex-1"
              >
                <Printer className="w-4 h-4 mr-2" />
                Cetak Struk
              </Button>
            )}

            {canCancel && !showCancelConfirm && !showCompleteConfirm && (
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Batalkan
              </Button>
            )}

            {canComplete && !showCompleteConfirm && !showCancelConfirm && (
              <Button
                onClick={() => setShowCompleteConfirm(true)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Selesaikan
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturDetail;
