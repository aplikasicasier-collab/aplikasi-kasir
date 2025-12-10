/**
 * Stock Opname Summary Component
 * Display all scanned items with discrepancies
 * Complete/cancel buttons
 * Requirements: 5.4
 */

import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Package, 
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StockOpnameItem } from '@/api/stockOpname';

interface StockOpnameSummaryProps {
  items: StockOpnameItem[];
  status: 'in_progress' | 'completed' | 'cancelled';
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
  isProcessing?: boolean;
}

export const StockOpnameSummary: React.FC<StockOpnameSummaryProps> = ({
  items,
  status,
  onComplete,
  onCancel,
  isProcessing = false,
}) => {
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalItems = items.length;
    const itemsWithDiscrepancy = items.filter(item => item.discrepancy !== 0);
    const positiveDiscrepancies = items.filter(item => item.discrepancy > 0);
    const negativeDiscrepancies = items.filter(item => item.discrepancy < 0);
    const totalPositive = positiveDiscrepancies.reduce((sum, item) => sum + item.discrepancy, 0);
    const totalNegative = negativeDiscrepancies.reduce((sum, item) => sum + item.discrepancy, 0);

    return {
      totalItems,
      itemsWithDiscrepancy: itemsWithDiscrepancy.length,
      itemsMatching: totalItems - itemsWithDiscrepancy.length,
      positiveCount: positiveDiscrepancies.length,
      negativeCount: negativeDiscrepancies.length,
      totalPositive,
      totalNegative,
    };
  }, [items]);


  const handleComplete = async () => {
    setShowConfirmComplete(false);
    await onComplete();
  };

  const handleCancel = async () => {
    setShowConfirmCancel(false);
    await onCancel();
  };

  const getDiscrepancyIcon = (discrepancy: number) => {
    if (discrepancy > 0) {
      return <ArrowUpCircle className="w-4 h-4 text-green-500" />;
    } else if (discrepancy < 0) {
      return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
    }
    return <MinusCircle className="w-4 h-4 text-gray-400" />;
  };

  const getDiscrepancyColor = (discrepancy: number) => {
    if (discrepancy > 0) return 'text-green-600 dark:text-green-400';
    if (discrepancy < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const isEditable = status === 'in_progress';

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Item</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalItems}</div>
        </div>
        
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-600 dark:text-green-400">Stok Sesuai</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">{summary.itemsMatching}</div>
        </div>
        
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Ada Selisih</div>
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{summary.itemsWithDiscrepancy}</div>
        </div>
        
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-blue-600 dark:text-blue-400">Total Selisih</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {summary.totalPositive + summary.totalNegative}
          </div>
        </div>
      </div>

      {/* Discrepancy Breakdown */}
      {summary.itemsWithDiscrepancy > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="font-medium text-yellow-800 dark:text-yellow-200">Ringkasan Selisih</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-700 dark:text-gray-300">
                Lebih: {summary.positiveCount} item (+{summary.totalPositive})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-red-500" />
              <span className="text-gray-700 dark:text-gray-300">
                Kurang: {summary.negativeCount} item ({summary.totalNegative})
              </span>
            </div>
          </div>
        </div>
      )}


      {/* Items Table */}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Produk</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Stok Sistem</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Stok Aktual</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b dark:border-gray-700 ${
                    item.discrepancy !== 0 
                      ? 'bg-yellow-50/50 dark:bg-yellow-900/10' 
                      : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.product?.name || 'Unknown Product'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.product?.barcode || '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                    {item.system_stock}
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">
                    {item.actual_stock}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className={`flex items-center justify-center gap-1 ${getDiscrepancyColor(item.discrepancy)}`}>
                      {getDiscrepancyIcon(item.discrepancy)}
                      <span className="font-medium">
                        {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Belum ada item yang di-scan</p>
        </div>
      )}

      {/* Action Buttons */}
      {isEditable && items.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {!showConfirmComplete && !showConfirmCancel ? (
            <>
              <Button
                onClick={() => setShowConfirmComplete(true)}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Selesaikan Opname
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowConfirmCancel(true)}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
              >
                <XCircle className="w-4 h-4" />
                Batalkan
              </Button>
            </>
          ) : showConfirmComplete ? (
            <div className="flex-1 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200 mb-3">
                Yakin ingin menyelesaikan stock opname? Stok produk akan diperbarui sesuai hasil penghitungan.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleComplete}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Ya, Selesaikan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmComplete(false)}
                  disabled={isProcessing}
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-red-800 dark:text-red-200 mb-3">
                Yakin ingin membatalkan stock opname? Semua data penghitungan akan dihapus.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Ya, Batalkan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmCancel(false)}
                  disabled={isProcessing}
                >
                  Kembali
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Badge for completed/cancelled */}
      {status !== 'in_progress' && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          status === 'completed' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          {status === 'completed' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-200 font-medium">
                Stock opname telah selesai. Stok produk telah diperbarui.
              </span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-red-800 dark:text-red-200 font-medium">
                Stock opname dibatalkan.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StockOpnameSummary;
