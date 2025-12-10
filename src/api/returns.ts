import { supabase } from '@/lib/supabaseClient';
import { Transaction, TransactionItem } from '@/types';
import { getReturnPolicy, checkReturnEligibility, isProductReturnable, ReturnPolicy } from './returnPolicies';

// ============================================
// Types
// Requirements: 1.1, 1.3, 1.5
// ============================================

export type ReturnReason = 'damaged' | 'wrong_product' | 'not_as_described' | 'changed_mind' | 'other';
export type ReturnStatus = 'pending_approval' | 'approved' | 'completed' | 'rejected' | 'cancelled';

export interface Return {
  id: string;
  return_number: string;
  transaction_id: string;
  transaction?: Transaction;
  outlet_id: string | null;
  status: ReturnStatus;
  total_refund: number;
  refund_method: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approval_reason: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  return_id: string;
  transaction_item_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  original_price: number;
  discount_amount: number;
  refund_amount: number;
  reason: ReturnReason;
  reason_detail: string | null;
  is_damaged: boolean;
  is_resellable: boolean;
  created_at: string;
}

export interface CreateReturnItemInput {
  transaction_item_id: string;
  quantity: number;
  reason: ReturnReason;
  reason_detail?: string;
  is_damaged: boolean;
}

export interface CreateReturnInput {
  transaction_id: string;
  items: CreateReturnItemInput[];
  notes?: string;
}

export interface ReturnFilters {
  status?: ReturnStatus;
  outlet_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
}

export interface ReturnQuantityValidation {
  valid: boolean;
  errors: Array<{
    transaction_item_id: string;
    product_name: string;
    requested_quantity: number;
    available_quantity: number;
    message: string;
  }>;
}

// ============================================
// Return Number Generator
// Requirements: 1.5
// ============================================

/**
 * Format date as YYYYMMDD for return number
 */
export function formatDateForReturnNumber(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Validate return number format
 * Format: RTN-YYYYMMDD-XXXX
 */
export function isValidReturnNumberFormat(returnNumber: string): boolean {
  const pattern = /^RTN-\d{8}-\d{4}$/;
  return pattern.test(returnNumber);
}

/**
 * Parse return number to extract date and sequence
 */
export function parseReturnNumber(returnNumber: string): { date: string; sequence: number } | null {
  if (!isValidReturnNumberFormat(returnNumber)) {
    return null;
  }
  
  const parts = returnNumber.split('-');
  return {
    date: parts[1],
    sequence: parseInt(parts[2], 10),
  };
}

/**
 * Generates a unique return number in format RTN-YYYYMMDD-XXXX
 * where XXXX is a sequential number that resets daily
 * Requirements: 1.5
 */
export async function generateReturnNumber(): Promise<string> {
  const today = new Date();
  const dateStr = formatDateForReturnNumber(today);
  const prefix = `RTN-${dateStr}-`;

  // Query latest return number for today
  const { data, error } = await supabase
    .from('returns')
    .select('return_number')
    .like('return_number', `${prefix}%`)
    .order('return_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to generate return number: ${error.message}`);
  }

  let nextSequence = 1;
  
  if (data && data.length > 0) {
    const lastNumber = data[0].return_number;
    const lastSequence = parseInt(lastNumber.slice(-4), 10);
    nextSequence = lastSequence + 1;
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
}


// ============================================
// Transaction Lookup and Validation Functions
// Requirements: 1.1, 1.2, 1.4
// ============================================

/**
 * Get transaction by ID with items for return processing
 * Requirements: 1.1, 1.2
 */
export async function getTransactionForReturn(transactionId: string): Promise<TransactionWithItems | null> {
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (txError || !transaction) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('transaction_items')
    .select(`
      *,
      products (id, name, category_id)
    `)
    .eq('transaction_id', transactionId);

  if (itemsError) {
    return null;
  }

  return {
    ...transaction,
    items: items || [],
  } as TransactionWithItems;
}

/**
 * Get transaction by transaction number
 * Requirements: 1.1
 */
export async function getTransactionByNumber(transactionNumber: string): Promise<TransactionWithItems | null> {
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('transaction_number', transactionNumber)
    .single();

  if (txError || !transaction) {
    return null;
  }

  return getTransactionForReturn(transaction.id);
}

/**
 * Get already returned quantities for a transaction
 * Requirements: 1.4
 */
export async function getReturnedQuantities(transactionId: string): Promise<Map<string, number>> {
  const { data: returns, error } = await supabase
    .from('returns')
    .select(`
      id,
      status,
      return_items (
        transaction_item_id,
        quantity
      )
    `)
    .eq('transaction_id', transactionId)
    .not('status', 'in', '("cancelled","rejected")');

  if (error) {
    throw new Error(`Failed to get returned quantities: ${error.message}`);
  }

  const returnedMap = new Map<string, number>();

  for (const ret of returns || []) {
    for (const item of ret.return_items || []) {
      const current = returnedMap.get(item.transaction_item_id) || 0;
      returnedMap.set(item.transaction_item_id, current + item.quantity);
    }
  }

  return returnedMap;
}

/**
 * Calculate available quantity for return (original - already returned)
 * Requirements: 1.4
 */
export function calculateAvailableQuantity(
  originalQuantity: number,
  returnedQuantity: number
): number {
  return Math.max(0, originalQuantity - returnedQuantity);
}

/**
 * Validate return quantities against available quantities
 * Requirements: 1.4
 */
export function validateReturnQuantities(
  items: CreateReturnItemInput[],
  transactionItems: TransactionItem[],
  returnedQuantities: Map<string, number>,
  productNames: Map<string, string>
): ReturnQuantityValidation {
  const errors: ReturnQuantityValidation['errors'] = [];

  for (const item of items) {
    const txItem = transactionItems.find(ti => ti.id === item.transaction_item_id);
    
    if (!txItem) {
      errors.push({
        transaction_item_id: item.transaction_item_id,
        product_name: 'Unknown',
        requested_quantity: item.quantity,
        available_quantity: 0,
        message: 'Item transaksi tidak ditemukan',
      });
      continue;
    }

    const alreadyReturned = returnedQuantities.get(item.transaction_item_id) || 0;
    const availableQuantity = calculateAvailableQuantity(txItem.quantity, alreadyReturned);
    const productName = productNames.get(txItem.product_id) || 'Unknown';

    if (item.quantity <= 0) {
      errors.push({
        transaction_item_id: item.transaction_item_id,
        product_name: productName,
        requested_quantity: item.quantity,
        available_quantity: availableQuantity,
        message: `Jumlah retur harus lebih dari 0`,
      });
    } else if (item.quantity > availableQuantity) {
      errors.push({
        transaction_item_id: item.transaction_item_id,
        product_name: productName,
        requested_quantity: item.quantity,
        available_quantity: availableQuantity,
        message: `Jumlah retur melebihi yang tersedia. Tersedia: ${availableQuantity}, Diminta: ${item.quantity}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate return quantities (async version with database lookup)
 * Requirements: 1.4
 */
export async function validateReturnQuantitiesAsync(
  transactionId: string,
  items: CreateReturnItemInput[]
): Promise<ReturnQuantityValidation> {
  const transaction = await getTransactionForReturn(transactionId);
  
  if (!transaction) {
    return {
      valid: false,
      errors: [{
        transaction_item_id: '',
        product_name: '',
        requested_quantity: 0,
        available_quantity: 0,
        message: 'Transaksi tidak ditemukan',
      }],
    };
  }

  const returnedQuantities = await getReturnedQuantities(transactionId);
  
  // Build product names map
  const productNames = new Map<string, string>();
  for (const item of transaction.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = (item as any).products;
    if (product) {
      productNames.set(item.product_id, product.name);
    }
  }

  return validateReturnQuantities(items, transaction.items, returnedQuantities, productNames);
}


// ============================================
// Return CRUD Functions
// Requirements: 1.1, 1.3
// ============================================

/**
 * Calculate refund amount for a return item
 * Requirements: 2.1, 2.2
 */
export function calculateItemRefund(
  originalPrice: number,
  discountAmount: number,
  quantity: number
): number {
  const priceAfterDiscount = originalPrice - discountAmount;
  return priceAfterDiscount * quantity;
}

/**
 * Create a new return
 * Requirements: 1.1, 1.3, 3.2
 */
export async function createReturn(input: CreateReturnInput): Promise<Return> {
  const { transaction_id, items, notes } = input;

  // Get transaction with items
  const transaction = await getTransactionForReturn(transaction_id);
  if (!transaction) {
    throw new Error('Transaksi tidak ditemukan');
  }

  // Validate quantities
  const validation = await validateReturnQuantitiesAsync(transaction_id, items);
  if (!validation.valid) {
    throw new Error(validation.errors.map(e => e.message).join(', '));
  }

  // Get return policy
  const policy = await getReturnPolicy();
  
  // Check if return requires approval (date check)
  let requiresApproval = false;
  if (policy) {
    const eligibility = checkReturnEligibility(transaction, policy);
    requiresApproval = eligibility.requires_approval;
  }

  // Generate return number
  const returnNumber = await generateReturnNumber();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Calculate total refund and prepare items
  let totalRefund = 0;
  const returnItems: Array<{
    transaction_item_id: string;
    product_id: string;
    quantity: number;
    original_price: number;
    discount_amount: number;
    refund_amount: number;
    reason: ReturnReason;
    reason_detail: string | null;
    is_damaged: boolean;
    is_resellable: boolean;
  }> = [];

  for (const item of items) {
    const txItem = transaction.items.find(ti => ti.id === item.transaction_item_id);
    if (!txItem) continue;

    const originalPrice = txItem.original_price || txItem.unit_price;
    const discountAmount = txItem.discount_amount || 0;
    const refundAmount = calculateItemRefund(originalPrice, discountAmount, item.quantity);
    
    totalRefund += refundAmount;

    returnItems.push({
      transaction_item_id: item.transaction_item_id,
      product_id: txItem.product_id,
      quantity: item.quantity,
      original_price: originalPrice,
      discount_amount: discountAmount,
      refund_amount: refundAmount,
      reason: item.reason,
      reason_detail: item.reason_detail || null,
      is_damaged: item.is_damaged,
      is_resellable: !item.is_damaged,
    });
  }

  // Determine initial status
  const initialStatus: ReturnStatus = requiresApproval ? 'pending_approval' : 'approved';

  // Create return record
  const { data: returnData, error: returnError } = await supabase
    .from('returns')
    .insert({
      return_number: returnNumber,
      transaction_id: transaction_id,
      outlet_id: transaction.outlet_id || null,
      status: initialStatus,
      total_refund: totalRefund,
      requires_approval: requiresApproval,
      notes: notes || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (returnError) {
    throw new Error(`Failed to create return: ${returnError.message}`);
  }

  // Create return items
  const itemsToInsert = returnItems.map(item => ({
    return_id: returnData.id,
    ...item,
  }));

  const { error: itemsError } = await supabase
    .from('return_items')
    .insert(itemsToInsert);

  if (itemsError) {
    // Rollback return if items fail
    await supabase.from('returns').delete().eq('id', returnData.id);
    throw new Error(`Failed to create return items: ${itemsError.message}`);
  }

  return {
    ...returnData,
    items: returnItems.map((item, index) => ({
      id: `temp-${index}`,
      return_id: returnData.id,
      created_at: new Date().toISOString(),
      ...item,
    })),
  } as Return;
}

/**
 * Get returns with optional filters
 * Requirements: 1.5
 */
export async function getReturns(filters?: ReturnFilters): Promise<Return[]> {
  let query = supabase
    .from('returns')
    .select(`
      *,
      return_items (
        *,
        products (id, name)
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  if (filters?.start_date) {
    query = query.gte('created_at', filters.start_date);
  }

  if (filters?.end_date) {
    query = query.lte('created_at', filters.end_date);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch returns: ${error.message}`);
  }

  return (data || []).map(ret => ({
    ...ret,
    items: (ret.return_items || []).map((item: ReturnItem & { products?: { name: string } }) => ({
      ...item,
      product_name: item.products?.name,
    })),
  })) as Return[];
}

/**
 * Get return by ID
 * Requirements: 1.1
 */
export async function getReturnById(id: string): Promise<Return | null> {
  const { data, error } = await supabase
    .from('returns')
    .select(`
      *,
      return_items (
        *,
        products (id, name)
      ),
      transactions (*)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    transaction: data.transactions,
    items: (data.return_items || []).map((item: ReturnItem & { products?: { name: string } }) => ({
      ...item,
      product_name: item.products?.name,
    })),
  } as Return;
}

/**
 * Get returns by transaction ID
 * Requirements: 1.1
 */
export async function getReturnsByTransaction(transactionId: string): Promise<Return[]> {
  const { data, error } = await supabase
    .from('returns')
    .select(`
      *,
      return_items (
        *,
        products (id, name)
      )
    `)
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch returns: ${error.message}`);
  }

  return (data || []).map(ret => ({
    ...ret,
    items: (ret.return_items || []).map((item: ReturnItem & { products?: { name: string } }) => ({
      ...item,
      product_name: item.products?.name,
    })),
  })) as Return[];
}


// ============================================
// Return Completion Functions
// Requirements: 4.1, 4.2
// ============================================

/**
 * Complete a return with stock update
 * Requirements: 4.1, 4.2, 4.4
 */
export async function completeReturn(id: string, refundMethod: string): Promise<Return> {
  // Get return with items
  const returnData = await getReturnById(id);
  if (!returnData) {
    throw new Error('Retur tidak ditemukan');
  }

  if (returnData.status === 'completed') {
    throw new Error('Retur sudah selesai');
  }

  if (returnData.status === 'cancelled' || returnData.status === 'rejected') {
    throw new Error('Retur sudah dibatalkan atau ditolak');
  }

  if (returnData.status === 'pending_approval') {
    throw new Error('Retur masih menunggu persetujuan');
  }

  // Update return status
  const { data: updatedReturn, error: updateError } = await supabase
    .from('returns')
    .update({
      status: 'completed',
      refund_method: refundMethod,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to complete return: ${updateError.message}`);
  }

  // Update stock for resellable items
  for (const item of returnData.items || []) {
    if (item.is_resellable) {
      // Update product stock
      const { error: stockError } = await supabase.rpc('update_product_stock', {
        p_product_id: item.product_id,
        p_quantity_change: item.quantity,
      });

      // If RPC doesn't exist, use direct update
      if (stockError?.code === 'PGRST202') {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (!fetchError && product) {
          await supabase
            .from('products')
            .update({ 
              stock_quantity: product.stock_quantity + item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.product_id);
        }
      }

      // Create stock movement record
      await supabase
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          movement_type: 'return',
          quantity: item.quantity,
          reference_type: 'return',
          reference_id: id,
          notes: `Retur - ${returnData.return_number}`,
          outlet_id: returnData.outlet_id,
        });
    }

    // Update returned_quantity in transaction_items
    const { data: txItem, error: txItemError } = await supabase
      .from('transaction_items')
      .select('returned_quantity')
      .eq('id', item.transaction_item_id)
      .single();

    if (!txItemError && txItem) {
      await supabase
        .from('transaction_items')
        .update({
          returned_quantity: (txItem.returned_quantity || 0) + item.quantity,
        })
        .eq('id', item.transaction_item_id);
    }
  }

  return {
    ...updatedReturn,
    items: returnData.items,
  } as Return;
}

/**
 * Cancel a return
 * Requirements: 1.1
 */
export async function cancelReturn(id: string): Promise<Return> {
  const returnData = await getReturnById(id);
  if (!returnData) {
    throw new Error('Retur tidak ditemukan');
  }

  if (returnData.status === 'completed') {
    throw new Error('Retur yang sudah selesai tidak dapat dibatalkan');
  }

  if (returnData.status === 'cancelled') {
    throw new Error('Retur sudah dibatalkan');
  }

  const { data: updatedReturn, error } = await supabase
    .from('returns')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel return: ${error.message}`);
  }

  return {
    ...updatedReturn,
    items: returnData.items,
  } as Return;
}

/**
 * Simulate stock update for return (pure function for testing)
 * Requirements: 4.1, 4.4
 */
export function simulateStockUpdateForReturn(
  currentStock: Map<string, number>,
  returnItems: Array<{ product_id: string; quantity: number; is_resellable: boolean }>
): Map<string, number> {
  const newStock = new Map(currentStock);

  for (const item of returnItems) {
    if (item.is_resellable) {
      const current = newStock.get(item.product_id) || 0;
      newStock.set(item.product_id, current + item.quantity);
    }
  }

  return newStock;
}

/**
 * Check if stock movement should be created for return item
 * Requirements: 4.2, 4.4
 */
export function shouldCreateStockMovement(item: { is_resellable: boolean }): boolean {
  return item.is_resellable;
}
