/**
 * Return Item Selector Component
 * 
 * Display transaction items
 * Allow selecting items with quantity and reason
 * Show already returned quantities
 * Validate against available quantity
 * 
 * Requirements: 1.3, 1.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Package, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { TransactionItem } from '@/types';
import { 
  TransactionWithItems, 
  getReturnedQuantities, 
  calculateAvailableQuantity,
  ReturnReason,
  CreateReturnItemInput
} from '@/api/returns';
import { getReturnPolicy, isProductReturnable, ReturnPolicy } from '@/api/returnPolicies';

interface ReturnItemSelectorProps {
  transaction: TransactionWithItems;
  onItemsSelected: (items: CreateReturnItemInput[]) => void;
  disabled?: boolean;
}

interface SelectableItem {
  transactionItem: TransactionItem & { products?: { id: string; name: string; category_id?: string } };
  productName: string;
  originalQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  isReturnable: boolean;
  nonReturnableReason?: string;
  // Selection state
  selected: boolean;
  returnQuantity: number;
  reason: ReturnReason;
  reasonDetail: string;
  isDamaged: boolean;
}

const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'damaged', label: 'Rusak' },
  { value: 'wrong_product', label: 'Salah Produk' },
  { value: 'not_as_described', label: 'Tidak Sesuai Deskripsi' },
  { value: 'changed_mind', label: 'Berubah Pikiran' },
  { value: 'other', label: 'Lainnya' },
];

export const ReturnItemSelector: React.FC<ReturnItemSelectorProps> = ({
  transaction,
  onItemsSelected,
  disabled = false,
}) => {
  const [items, setItems] = useState<SelectableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);

  // Load returned quantities and policy
  useEffect(() => {
    loadData();
  }, [transaction.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [returnedMap, policyData] = await Promise.all([
        getReturnedQuantities(transaction.id),
        getReturnPolicy(),
      ]);

      setPolicy(policyData);

      // Build selectable items
      const selectableItems: SelectableItem[] = transaction.items.map((item) => {
        const txItem = item as TransactionItem & { products?: { id: string; name: string; category_id?: string } };
        const productName = txItem.products?.name || `Product ${item.product_id.slice(0, 8)}`;
        const returnedQty = returnedMap.get(item.id) || 0;
        const availableQty = calculateAvailableQuantity(item.quantity, returnedQty);

        // Check if product is returnable based on policy
        let isReturnable = true;
        let nonReturnableReason: string | undefined;

        if (policyData && txItem.products?.category_id) {
          const policyCheck = isProductReturnable(txItem.products.category_id, policyData);
          if (!policyCheck.allowed) {
            isReturnable = false;
            nonReturnableReason = policyCheck.reason;
          }
        }

        // Also not returnable if no available quantity
        if (availableQty <= 0) {
          isReturnable = false;
          nonReturnableReason = 'Item sudah diretur sepenuhnya';
        }

        return {
          transactionItem: txItem,
          productName,
          originalQuantity: item.quantity,
          returnedQuantity: returnedQty,
          availableQuantity: availableQty,
          isReturnable,
          nonReturnableReason,
          selected: false,
          returnQuantity: 1,
          reason: 'changed_mind' as ReturnReason,
          reasonDetail: '',
          isDamaged: false,
        };
      });

      setItems(selectableItems);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data item');
    } finally {
      setLoading(false);
    }
  };

  // Notify parent when selection changes
  useEffect(() => {
    const selectedItems: CreateReturnItemInput[] = items
      .filter(item => item.selected && item.isReturnable)
      .map(item => ({
        transaction_item_id: item.transactionItem.id,
        quantity: item.returnQuantity,
        reason: item.reason,
        reason_detail: item.reasonDetail || undefined,
        is_damaged: item.isDamaged || item.reason === 'damaged',
      }));

    onItemsSelected(selectedItems);
  }, [items, onItemsSelected]);

  const handleToggleSelect = useCallback((index: number) => {
    if (disabled) return;
    
    setItems(prev => prev.map((item, i) => {
      if (i !== index || !item.isReturnable) return item;
      return { ...item, selected: !item.selected };
    }));
  }, [disabled]);

  const handleQuantityChange = useCallback((index: number, quantity: number) => {
    if (disabled) return;
    
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const validQty = Math.max(1, Math.min(quantity, item.availableQuantity));
      return { ...item, returnQuantity: validQty };
    }));
  }, [disabled]);

  const handleReasonChange = useCallback((index: number, reason: ReturnReason) => {
    if (disabled) return;
    
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { 
        ...item, 
        reason,
        isDamaged: reason === 'damaged' ? true : item.isDamaged,
      };
    }));
  }, [disabled]);

  const handleReasonDetailChange = useCallback((index: number, detail: string) => {
    if (disabled) return;
    
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, reasonDetail: detail };
    }));
  }, [disabled]);

  const handleDamagedChange = useCallback((index: number, isDamaged: boolean) => {
    if (disabled) return;
    
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, isDamaged };
    }));
  }, [disabled]);

  const selectedCount = items.filter(i => i.selected).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-500 dark:text-gray-400">Memuat item...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <span className="text-red-700 dark:text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Pilih Item untuk Diretur</h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {selectedCount} item dipilih
        </span>
      </div>

      {/* Policy Info */}
      {policy && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-400">
            <p>Kebijakan retur: Maksimal {policy.max_return_days} hari setelah transaksi</p>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <Card 
            key={item.transactionItem.id}
            className={`transition-all ${
              item.selected 
                ? 'border-primary-500 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' 
                : item.isReturnable 
                  ? 'hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer' 
                  : 'opacity-60 cursor-not-allowed'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => handleToggleSelect(index)}
                    disabled={disabled || !item.isReturnable}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {item.productName}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Harga: Rp {item.transactionItem.unit_price.toLocaleString()} × {item.originalQuantity}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Rp {item.transactionItem.total_price.toLocaleString()}
                    </span>
                  </div>

                  {/* Quantity Info */}
                  <div className="flex flex-wrap gap-3 text-sm mb-3">
                    <span className="text-gray-600 dark:text-gray-400">
                      Dibeli: <span className="font-medium">{item.originalQuantity}</span>
                    </span>
                    {item.returnedQuantity > 0 && (
                      <span className="text-orange-600 dark:text-orange-400">
                        Sudah diretur: <span className="font-medium">{item.returnedQuantity}</span>
                      </span>
                    )}
                    <span className={`${item.availableQuantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      Tersedia: <span className="font-medium">{item.availableQuantity}</span>
                    </span>
                  </div>

                  {/* Non-returnable Warning */}
                  {!item.isReturnable && item.nonReturnableReason && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{item.nonReturnableReason}</span>
                    </div>
                  )}

                  {/* Selection Options (only show when selected) */}
                  {item.selected && item.isReturnable && (
                    <div className="mt-3 pt-3 border-t dark:border-gray-700 space-y-3">
                      {/* Quantity */}
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                          Jumlah Retur
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(index, item.returnQuantity - 1)}
                            disabled={disabled || item.returnQuantity <= 1}
                            className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.availableQuantity}
                            value={item.returnQuantity}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                            disabled={disabled}
                            className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(index, item.returnQuantity + 1)}
                            disabled={disabled || item.returnQuantity >= item.availableQuantity}
                            className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                          >
                            +
                          </button>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            / {item.availableQuantity}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                          Alasan
                        </label>
                        <select
                          value={item.reason}
                          onChange={(e) => handleReasonChange(index, e.target.value as ReturnReason)}
                          disabled={disabled}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {RETURN_REASONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Reason Detail (for 'other') */}
                      {item.reason === 'other' && (
                        <div className="flex items-start gap-4">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 pt-2">
                            Detail
                          </label>
                          <textarea
                            value={item.reasonDetail}
                            onChange={(e) => handleReasonDetailChange(index, e.target.value)}
                            disabled={disabled}
                            placeholder="Jelaskan alasan retur..."
                            rows={2}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          />
                        </div>
                      )}

                      {/* Damaged Checkbox */}
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                          Kondisi
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isDamaged}
                            onChange={(e) => handleDamagedChange(index, e.target.checked)}
                            disabled={disabled || item.reason === 'damaged'}
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Barang rusak (tidak dapat dijual kembali)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Tidak ada item dalam transaksi ini</p>
        </div>
      )}
    </div>
  );
};

export default ReturnItemSelector;
