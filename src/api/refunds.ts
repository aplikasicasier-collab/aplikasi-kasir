import { supabase } from '@/lib/supabaseClient';
import { TransactionItem } from '@/types';
import { Return, ReturnItem, getReturnById } from './returns';
import { AuditLogger } from '@/lib/auditLogger';

// ============================================
// Types
// Requirements: 2.1, 2.2
// ============================================

export interface RefundItemCalculation {
  product_id: string;
  product_name: string;
  quantity: number;
  original_price: number;
  discount_amount: number;
  refund_amount: number;
}

export interface RefundCalculation {
  items: RefundItemCalculation[];
  subtotal: number;
  total_discount: number;
  total_refund: number;
}

export interface TransactionItemWithProduct extends TransactionItem {
  products?: {
    id: string;
    name: string;
  };
}

// ============================================
// Refund Calculation Functions
// Requirements: 2.1, 2.2
// ============================================

/**
 * Calculate refund amount for a single item
 * Formula: refund = (original_price - discount_amount) × quantity
 * Requirements: 2.1, 2.2
 */
export function calculateItemRefundAmount(
  originalPrice: number,
  discountAmount: number,
  quantity: number
): number {
  const priceAfterDiscount = originalPrice - discountAmount;
  return priceAfterDiscount * quantity;
}

/**
 * Calculate refund for return items based on original transaction
 * Preserves the same discounts that were applied in the original transaction
 * Requirements: 2.1, 2.2
 * 
 * **Feature: retur-refund, Property 4: Refund Calculation with Discounts**
 * **Validates: Requirements 2.1, 2.2**
 */
export function calculateRefund(
  returnItems: Array<{
    transaction_item_id: string;
    product_id: string;
    quantity: number;
    product_name?: string;
  }>,
  transactionItems: TransactionItemWithProduct[]
): RefundCalculation {
  const items: RefundItemCalculation[] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalRefund = 0;

  for (const returnItem of returnItems) {
    // Find the original transaction item
    const txItem = transactionItems.find(
      ti => ti.id === returnItem.transaction_item_id
    );

    if (!txItem) {
      continue;
    }

    // Get original price and discount from transaction item
    // Use original_price if available, otherwise fall back to unit_price
    const originalPrice = txItem.original_price ?? txItem.unit_price;
    // Use discount_amount if available, otherwise calculate from discount field
    const discountAmount = txItem.discount_amount ?? 0;

    // Calculate refund amount preserving original discount
    const refundAmount = calculateItemRefundAmount(
      originalPrice,
      discountAmount,
      returnItem.quantity
    );

    // Get product name from transaction item or return item
    const productName = 
      txItem.products?.name ?? 
      returnItem.product_name ?? 
      'Unknown Product';

    items.push({
      product_id: returnItem.product_id,
      product_name: productName,
      quantity: returnItem.quantity,
      original_price: originalPrice,
      discount_amount: discountAmount,
      refund_amount: refundAmount,
    });

    // Accumulate totals
    subtotal += originalPrice * returnItem.quantity;
    totalDiscount += discountAmount * returnItem.quantity;
    totalRefund += refundAmount;
  }

  return {
    items,
    subtotal,
    total_discount: totalDiscount,
    total_refund: totalRefund,
  };
}


/**
 * Calculate refund from Return object with items
 * Convenience function that extracts items from a Return
 * Requirements: 2.1, 2.2
 */
export function calculateRefundFromReturn(
  returnData: Return,
  transactionItems: TransactionItemWithProduct[]
): RefundCalculation {
  if (!returnData.items || returnData.items.length === 0) {
    return {
      items: [],
      subtotal: 0,
      total_discount: 0,
      total_refund: 0,
    };
  }

  return calculateRefund(
    returnData.items.map(item => ({
      transaction_item_id: item.transaction_item_id,
      product_id: item.product_id,
      quantity: item.quantity,
      product_name: item.product_name,
    })),
    transactionItems
  );
}

/**
 * Validate refund calculation matches stored values
 * Used to verify that refund amounts are consistent
 * Requirements: 2.1, 2.2
 */
export function validateRefundCalculation(
  returnItems: ReturnItem[],
  expectedTotal: number
): { valid: boolean; calculatedTotal: number; difference: number } {
  const calculatedTotal = returnItems.reduce(
    (sum, item) => sum + item.refund_amount,
    0
  );

  const difference = Math.abs(calculatedTotal - expectedTotal);
  // Allow for small floating point differences (less than 1 cent)
  const valid = difference < 0.01;

  return {
    valid,
    calculatedTotal,
    difference,
  };
}

// ============================================
// Refund Processing Functions
// Requirements: 2.3, 2.5
// ============================================

export type RefundMethod = 'cash' | 'card' | 'e-wallet';

export interface ProcessRefundInput {
  return_id: string;
  method: RefundMethod;
}

export interface ProcessRefundResult {
  success: boolean;
  return_id: string;
  refund_method: RefundMethod;
  total_refund: number;
  completed_at: string;
}

/**
 * Process refund for a completed return
 * Records the refund method and updates transaction records
 * Requirements: 2.3, 2.5
 */
export async function processRefund(
  returnId: string,
  method: RefundMethod
): Promise<ProcessRefundResult> {
  // Get return data
  const returnData = await getReturnById(returnId);
  
  if (!returnData) {
    throw new Error('Retur tidak ditemukan');
  }

  if (returnData.status !== 'approved' && returnData.status !== 'completed') {
    throw new Error('Retur belum disetujui atau sudah selesai');
  }

  if (returnData.refund_method) {
    throw new Error('Refund sudah diproses');
  }

  const completedAt = new Date().toISOString();

  // Update return with refund method
  const { error: updateError } = await supabase
    .from('returns')
    .update({
      refund_method: method,
      status: 'completed',
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', returnId);

  if (updateError) {
    throw new Error(`Gagal memproses refund: ${updateError.message}`);
  }

  // Log refund processing
  // Requirements: 2.2 - Log refund with original transaction reference
  await AuditLogger.logEvent('refund', 'return', returnId, {
    return_number: returnData.return_number,
    transaction_id: returnData.transaction_id,
    refund_method: method,
    total_refund: returnData.total_refund,
    items_count: returnData.items?.length || 0,
  });
  
  return {
    success: true,
    return_id: returnId,
    refund_method: method,
    total_refund: returnData.total_refund,
    completed_at: completedAt,
  };
}

/**
 * Get refund details for a return
 * Requirements: 2.1, 2.4
 */
export async function getRefundDetails(
  returnId: string
): Promise<RefundCalculation | null> {
  const returnData = await getReturnById(returnId);
  
  if (!returnData || !returnData.items) {
    return null;
  }

  // Get transaction items for the original transaction
  const { data: transactionItems, error } = await supabase
    .from('transaction_items')
    .select(`
      *,
      products (id, name)
    `)
    .eq('transaction_id', returnData.transaction_id);

  if (error || !transactionItems) {
    return null;
  }

  return calculateRefund(
    returnData.items.map(item => ({
      transaction_item_id: item.transaction_item_id,
      product_id: item.product_id,
      quantity: item.quantity,
      product_name: item.product_name,
    })),
    transactionItems as TransactionItemWithProduct[]
  );
}
