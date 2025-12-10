/**
 * Pending Approval List Component
 * 
 * Display returns awaiting approval
 * Show return details and reason for approval
 * 
 * Requirements: 7.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  Loader2, 
  AlertCircle, 
  RotateCcw,
  Calendar,
  Package,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Return } from '@/types';
import { getPendingApprovals } from '@/api/returnApprovals';

interface PendingApprovalListProps {
  onSelectReturn: (returnData: Return) => void;
  onApprove: (returnData: Return) => void;
  onReject: (returnData: Return) => void;
  refreshTrigger?: number;
}

const REASON_LABELS: Record<string, string> = {
  damaged: 'Rusak',
  wrong_product: 'Salah Produk',
  not_as_described: 'Tidak Sesuai Deskripsi',
  changed_mind: 'Berubah Pikiran',
  other: 'Lainnya',
};

export const PendingApprovalList: React.FC<PendingApprovalListProps> = ({
  onSelectReturn,
  onApprove,
  onReject,
  refreshTrigger = 0,
}) => {
  const [pendingReturns, setPendingReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Load pending approvals
  const loadPendingApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPendingApprovals();
      setPendingReturns(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal memuat data persetujuan';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals, refreshTrigger]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get the primary reason for approval (e.g., policy exceeded)
  const getApprovalReason = (returnData: Return): string => {
    if (returnData.requires_approval) {
      // Check if it's due to policy period exceeded
      if (returnData.transaction?.transaction_date) {
        const transactionDate = new Date(returnData.transaction.transaction_date);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          return `Melebihi batas waktu retur (${daysDiff} hari)`;
        }
      }
      return 'Memerlukan persetujuan manager';
    }
    return '';
  };

  // Get unique return reasons from items
  const getItemReasons = (returnData: Return): string[] => {
    if (!returnData.items || returnData.items.length === 0) return [];
    const reasons = [...new Set(returnData.items.map(item => item.reason))];
    return reasons.map(r => REASON_LABELS[r] || r);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Menunggu Persetujuan
          </h3>
          {!loading && pendingReturns.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
              {pendingReturns.length}
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadPendingApprovals} 
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Memuat data...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && pendingReturns.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada retur yang menunggu persetujuan
          </p>
        </div>
      )}

      {/* Pending Returns List */}
      {!loading && pendingReturns.length > 0 && (
        <div className="space-y-3">
          {pendingReturns.map((ret) => {
            const approvalReason = getApprovalReason(ret);
            const itemReasons = getItemReasons(ret);

            return (
              <Card 
                key={ret.id}
                className="border-yellow-200 dark:border-yellow-800/50 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Return Info */}
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onSelectReturn(ret)}
                    >
                      {/* Return Number & Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {ret.return_number}
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                          <Clock className="w-3 h-3" />
                          Menunggu
                        </span>
                      </div>

                      {/* Approval Reason */}
                      {approvalReason && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                          <span className="text-sm text-yellow-700 dark:text-yellow-400">
                            {approvalReason}
                          </span>
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(ret.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          <span>{ret.items?.length || 0} item</span>
                        </div>
                        {itemReasons.length > 0 && (
                          <div>
                            <span className="text-gray-400">Alasan:</span>{' '}
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {itemReasons.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Refund Amount */}
                      <div className="mt-2">
                        <span className="text-sm text-gray-500">Total Refund: </span>
                        <span className="font-bold text-primary-600">
                          Rp {ret.total_refund.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove(ret);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(ret);
                        }}
                        className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReturn(ret);
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                        Detail
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PendingApprovalList;
