/**
 * Retur Form Component
 * 
 * Integrate lookup and item selector
 * Calculate refund preview
 * Submit return
 * 
 * Requirements: 1.1, 2.1
 */

import React, { useState, useCallback, useMemo } from 'react';
import { X, Loader2, AlertCircle, RotateCcw, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { TransactionLookup } from './TransactionLookup';
import { ReturnItemSelector } from './ReturnItemSelector';
import { Return } from '@/types';
import { 
  TransactionWithItems, 
  createReturn, 
  CreateReturnItemInput 
} from '@/api/returns';
import { calculateRefund, RefundCalculation, TransactionItemWithProduct } from '@/api/refunds';
import { getReturnPolicy, checkReturnEligibility, ReturnPolicy } from '@/api/returnPolicies';

interface ReturFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnData: Return) => void;
}

export const ReturForm: React.FC<ReturFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [transaction, setTransaction] = useState<TransactionWithItems | null>(null);
  const [selectedItems, setSelectedItems] = useState<CreateReturnItemInput[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalReason, setApprovalReason] = useState<string | null>(null);

  // Handle transaction found
  const handleTransactionFound = useCallback(async (tx: TransactionWithItems) => {
    setTransaction(tx);
    setSelectedItems([]);
    setError(null);

    // Check policy for approval requirement
    try {
      const policyData = await getReturnPolicy();
      setPolicy(policyData);

      if (policyData) {
        const eligibility = checkReturnEligibility(tx, policyData);
        setRequiresApproval(eligibility.requires_approval);
        setApprovalReason(eligibility.reason || null);
      }
    } catch (err) {
      console.error('Failed to check policy:', err);
    }
  }, []);

  // Handle items selection
  const handleItemsSelected = useCallback((items: CreateReturnItemInput[]) => {
    setSelectedItems(items);
  }, []);

  // Calculate refund preview
  const refundPreview: RefundCalculation | null = useMemo(() => {
    if (!transaction || selectedItems.length === 0) {
      return null;
    }

    // Map selected items to refund calculation format
    const itemsForCalc = selectedItems.map(item => {
      const txItem = transaction.items.find(ti => ti.id === item.transaction_item_id);
      return {
        transaction_item_id: item.transaction_item_id,
        product_id: txItem?.product_id || '',
        quantity: item.quantity,
        product_name: (txItem as any)?.products?.name,
      };
    });

    return calculateRefund(
      itemsForCalc,
      transaction.items as TransactionItemWithProduct[]
    );
  }, [transaction, selectedItems]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!transaction || selectedItems.length === 0) {
      setError('Pilih minimal satu item untuk diretur');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const returnData = await createReturn({
        transaction_id: transaction.id,
        items: selectedItems,
        notes: notes.trim() || undefined,
      });

      onSuccess(returnData);
      handleReset();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat retur');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setTransaction(null);
    setSelectedItems([]);
    setNotes('');
    setError(null);
    setRequiresApproval(false);
    setApprovalReason(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Buat Retur Baru
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
          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {/* Step 1: Transaction Lookup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Cari Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionLookup
                onTransactionFound={handleTransactionFound}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          {/* Approval Warning */}
          {requiresApproval && approvalReason && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  Memerlukan Persetujuan Manager
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  {approvalReason}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Select Items */}
          {transaction && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Pilih Item untuk Diretur</CardTitle>
              </CardHeader>
              <CardContent>
                <ReturnItemSelector
                  transaction={transaction}
                  onItemsSelected={handleItemsSelected}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Notes */}
          {transaction && selectedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Catatan (Opsional)</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Tambahkan catatan untuk retur ini..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </CardContent>
            </Card>
          )}

          {/* Refund Preview */}
          {refundPreview && refundPreview.items.length > 0 && (
            <Card className="border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary-600" />
                  Preview Refund
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Items */}
                  <div className="space-y-2">
                    {refundPreview.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.product_name} × {item.quantity}
                        </span>
                        <div className="text-right">
                          {item.discount_amount > 0 && (
                            <span className="text-gray-400 line-through mr-2">
                              Rp {(item.original_price * item.quantity).toLocaleString()}
                            </span>
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">
                            Rp {item.refund_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-t dark:border-gray-700 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span className="text-gray-900 dark:text-white">
                        Rp {refundPreview.subtotal.toLocaleString()}
                      </span>
                    </div>
                    {refundPreview.total_discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Diskon</span>
                        <span className="text-red-600">
                          - Rp {refundPreview.total_discount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-gray-900 dark:text-white">Total Refund</span>
                      <span className="text-primary-600">
                        Rp {refundPreview.total_refund.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Status Info */}
                  {requiresApproval ? (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 pt-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Retur akan menunggu persetujuan manager</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 pt-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Retur akan langsung disetujui</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !transaction || selectedItems.length === 0}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Memproses...
              </>
            ) : (
              'Buat Retur'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReturForm;
