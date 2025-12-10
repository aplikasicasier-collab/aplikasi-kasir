import { supabase } from '@/lib/supabaseClient';
import { CartItem, Transaction, TransactionItem, Discount, Promo } from '@/types';
import { AuditLogger } from '@/lib/auditLogger';

// ============================================
// Types
// ============================================

/**
 * Cart item with discount information for transaction creation
 * Requirements: 4.5, 5.1 - Save discount details in transaction_items
 */
export interface CartItemWithDiscountInfo extends CartItem {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  appliedDiscount?: Discount;
  appliedPromo?: Promo;
}

export interface CreateTransactionInput {
  items: CartItem[] | CartItemWithDiscountInfo[];
  paymentMethod: 'cash' | 'card' | 'e-wallet';
  cashReceived?: number;
  discountAmount: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
  outletId?: string; // Optional outlet ID for outlet-scoped transactions
}

/**
 * Type guard to check if cart item has discount info
 */
function hasDiscountInfo(item: CartItem | CartItemWithDiscountInfo): item is CartItemWithDiscountInfo {
  return 'originalPrice' in item && 'finalPrice' in item;
}

export interface TransactionResult {
  transaction: Transaction;
  transactionItems: TransactionItem[];
}

// ============================================
// Transaction Number Generator
// ============================================

/**
 * Generates a unique transaction number in format TRX-YYYYMMDD-XXXX
 * where XXXX is a sequential number that resets daily
 */
export async function generateTransactionNumber(): Promise<string> {
  const today = new Date();
  const dateStr = formatDateForTrxNumber(today);
  const prefix = `TRX-${dateStr}-`;

  // Query latest transaction number for today
  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_number')
    .like('transaction_number', `${prefix}%`)
    .order('transaction_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to generate transaction number: ${error.message}`);
  }

  let nextSequence = 1;
  
  if (data && data.length > 0) {
    const lastNumber = data[0].transaction_number;
    const lastSequence = parseInt(lastNumber.slice(-4), 10);
    nextSequence = lastSequence + 1;
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
}

/**
 * Format date as YYYYMMDD for transaction number
 */
export function formatDateForTrxNumber(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Validate transaction number format
 */
export function isValidTransactionNumberFormat(trxNumber: string): boolean {
  const pattern = /^TRX-\d{8}-\d{4}$/;
  return pattern.test(trxNumber);
}

/**
 * Parse transaction number to extract date and sequence
 */
export function parseTransactionNumber(trxNumber: string): { date: string; sequence: number } | null {
  if (!isValidTransactionNumberFormat(trxNumber)) {
    return null;
  }
  
  const parts = trxNumber.split('-');
  return {
    date: parts[1],
    sequence: parseInt(parts[2], 10),
  };
}


// ============================================
// Transaction CRUD Operations
// ============================================

/**
 * Create a new transaction with items
 * If outletId is provided, the transaction is associated with that outlet
 */
export async function createTransaction(input: CreateTransactionInput): Promise<TransactionResult> {
  const { items, paymentMethod, cashReceived, discountAmount, taxAmount, totalAmount, outletId } = input;

  // Generate transaction number
  const transactionNumber = await generateTransactionNumber();

  // Calculate change for cash payments
  const changeAmount = paymentMethod === 'cash' && cashReceived 
    ? cashReceived - totalAmount 
    : 0;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Create transaction record with outlet_id
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      transaction_number: transactionNumber,
      user_id: user?.id,
      outlet_id: outletId || null,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      payment_method: paymentMethod,
      cash_received: cashReceived || null,
      change_amount: changeAmount,
      status: 'completed',
    })
    .select()
    .single();

  if (txError) {
    throw new Error(`Failed to create transaction: ${txError.message}`);
  }

  // Create transaction items with discount information
  // Requirements: 4.5, 5.1 - Save discount_id, promo_id, original_price, discount_amount
  const itemsToInsert = items.map(item => {
    const hasDiscount = hasDiscountInfo(item);
    
    // Extract discount/promo IDs - handle promo virtual discount IDs
    let discountId: string | null = null;
    let promoId: string | null = null;
    
    if (hasDiscount) {
      if (item.appliedPromo) {
        promoId = item.appliedPromo.id;
      } else if (item.appliedDiscount && !item.appliedDiscount.id.startsWith('promo-')) {
        discountId = item.appliedDiscount.id;
      }
    }
    
    const originalPrice = hasDiscount ? item.originalPrice : item.product.price;
    const discountAmount = hasDiscount ? item.discountAmount : 0;
    const finalPrice = hasDiscount ? item.finalPrice : item.product.price;
    
    return {
      transaction_id: transaction.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: finalPrice,
      total_price: finalPrice * item.quantity,
      discount: item.discount,
      original_price: originalPrice,
      discount_amount: discountAmount,
      discount_id: discountId,
      promo_id: promoId,
    };
  });

  const { data: transactionItems, error: itemsError } = await supabase
    .from('transaction_items')
    .insert(itemsToInsert)
    .select();

  if (itemsError) {
    // Rollback transaction if items fail
    await supabase.from('transactions').delete().eq('id', transaction.id);
    throw new Error(`Failed to create transaction items: ${itemsError.message}`);
  }

  // Log transaction completion
  // Requirements: 2.1 - Log transaction details when completed
  await AuditLogger.logEvent('transaction', 'transaction', transaction.id, {
    transaction_number: transaction.transaction_number,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    items_count: items.length,
    outlet_id: outletId || null,
  });

  return {
    transaction: transaction as Transaction,
    transactionItems: transactionItems as TransactionItem[],
  };
}

/**
 * Get transaction by ID with items
 */
export async function getTransactionById(id: string): Promise<TransactionResult | null> {
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (txError || !transaction) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', id);

  if (itemsError) {
    return null;
  }

  return {
    transaction: transaction as Transaction,
    transactionItems: items as TransactionItem[],
  };
}

/**
 * Get recent transactions
 * If outletId is provided, returns only transactions from that outlet
 */
export async function getRecentTransactions(
  limit: number = 10,
  outletId?: string
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(limit);

  if (outletId) {
    query = query.eq('outlet_id', outletId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return data as Transaction[];
}

/**
 * Get transactions with optional outlet filter
 * **Feature: multi-outlet, Property 11: Outlet-Scoped Transaction History**
 * **Validates: Requirements 5.3**
 */
export interface GetTransactionsFilters {
  outletId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'completed' | 'pending' | 'cancelled';
  limit?: number;
}

export async function getTransactions(filters?: GetTransactionsFilters): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (filters?.outletId) {
    query = query.eq('outlet_id', filters.outletId);
  }

  if (filters?.startDate) {
    query = query.gte('transaction_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('transaction_date', filters.endDate);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return data as Transaction[];
}

/**
 * Filter transactions by outlet (pure function for testing)
 * **Feature: multi-outlet, Property 11: Outlet-Scoped Transaction History**
 * **Validates: Requirements 5.3**
 */
export function filterTransactionsByOutlet(
  transactions: Transaction[],
  outletId: string
): Transaction[] {
  return transactions.filter(tx => tx.outlet_id === outletId);
}

/**
 * Validate that a transaction is associated with the correct outlet (pure function for testing)
 * **Feature: multi-outlet, Property 10: Outlet-Scoped Transactions**
 * **Validates: Requirements 5.1, 5.2**
 */
export function validateTransactionOutlet(
  transaction: Transaction,
  expectedOutletId: string
): boolean {
  return transaction.outlet_id === expectedOutletId;
}
