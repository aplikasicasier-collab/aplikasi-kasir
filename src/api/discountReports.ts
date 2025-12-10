import { supabase } from '@/lib/supabaseClient';
import type { Transaction } from '@/types';

// ============================================
// Types for Discount Report API
// Requirements: 5.1, 5.2, 5.4
// ============================================

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface DiscountReportSummary {
  totalSalesWithDiscount: number;
  totalDiscountAmount: number;
  transactionCount: number;
  averageDiscountPerTransaction: number;
}

export interface PromoPerformance {
  promoId: string;
  promoName: string;
  salesDuringPromo: number;
  discountGiven: number;
  transactionCount: number;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  promoId?: string;
  discountId?: string;
}

// ============================================
// Raw data types for internal use
// ============================================

interface TransactionItemWithDiscount {
  id: string;
  transaction_id: string;
  total_price: number;
  discount_amount: number | null;
  discount_id: string | null;
  promo_id: string | null;
  transactions: {
    id: string;
    transaction_number: string;
    total_amount: number;
    transaction_date: string;
    status: string;
  };
}

// ============================================
// Pure Functions for Testing
// **Feature: diskon-promo, Property 11: Discount Report Accuracy**
// **Validates: Requirements 5.1, 5.2**
// ============================================

/**
 * Calculate discount report summary from transaction items
 * Pure function for property-based testing
 * **Feature: diskon-promo, Property 11: Discount Report Accuracy**
 * **Validates: Requirements 5.1, 5.2**
 */
export function calculateDiscountReportSummary(
  transactionItems: Array<{
    transaction_id: string;
    total_price: number;
    discount_amount: number | null;
    discount_id: string | null;
    promo_id: string | null;
  }>
): DiscountReportSummary {
  // Filter items that have discounts applied
  const discountedItems = transactionItems.filter(
    item => (item.discount_id !== null || item.promo_id !== null) && 
            item.discount_amount !== null && 
            item.discount_amount > 0
  );

  // Get unique transaction IDs with discounts
  const uniqueTransactionIds = new Set(discountedItems.map(item => item.transaction_id));
  const transactionCount = uniqueTransactionIds.size;

  // Calculate total sales with discount (sum of total_price for discounted items)
  const totalSalesWithDiscount = discountedItems.reduce(
    (sum, item) => sum + Number(item.total_price),
    0
  );

  // Calculate total discount amount given
  const totalDiscountAmount = discountedItems.reduce(
    (sum, item) => sum + Number(item.discount_amount || 0),
    0
  );

  // Calculate average discount per transaction
  const averageDiscountPerTransaction = transactionCount > 0 
    ? totalDiscountAmount / transactionCount 
    : 0;

  return {
    totalSalesWithDiscount,
    totalDiscountAmount,
    transactionCount,
    averageDiscountPerTransaction,
  };
}

/**
 * Calculate promo performance from transaction items
 * Pure function for testing
 * **Feature: diskon-promo, Property 11: Discount Report Accuracy**
 * **Validates: Requirements 5.1, 5.2**
 */
export function calculatePromoPerformance(
  promoId: string,
  promoName: string,
  transactionItems: Array<{
    transaction_id: string;
    total_price: number;
    discount_amount: number | null;
    promo_id: string | null;
  }>
): PromoPerformance {
  // Filter items for this specific promo
  const promoItems = transactionItems.filter(item => item.promo_id === promoId);

  // Get unique transaction IDs
  const uniqueTransactionIds = new Set(promoItems.map(item => item.transaction_id));
  const transactionCount = uniqueTransactionIds.size;

  // Calculate sales during promo
  const salesDuringPromo = promoItems.reduce(
    (sum, item) => sum + Number(item.total_price),
    0
  );

  // Calculate discount given
  const discountGiven = promoItems.reduce(
    (sum, item) => sum + Number(item.discount_amount || 0),
    0
  );

  return {
    promoId,
    promoName,
    salesDuringPromo,
    discountGiven,
    transactionCount,
  };
}

/**
 * Filter transaction items by date range
 * Pure function for testing
 */
export function filterTransactionItemsByDateRange(
  items: Array<{
    transaction_id: string;
    total_price: number;
    discount_amount: number | null;
    discount_id: string | null;
    promo_id: string | null;
    transaction_date: string;
  }>,
  dateRange: DateRange
): Array<{
  transaction_id: string;
  total_price: number;
  discount_amount: number | null;
  discount_id: string | null;
  promo_id: string | null;
  transaction_date: string;
}> {
  const startTime = new Date(dateRange.startDate).getTime();
  const endTime = new Date(dateRange.endDate).getTime();

  return items.filter(item => {
    const itemTime = new Date(item.transaction_date).getTime();
    return itemTime >= startTime && itemTime <= endTime;
  });
}

// ============================================
// API Functions
// Requirements: 5.1, 5.2, 5.4
// ============================================

/**
 * Get discount report summary for a date range
 * Requirements: 5.1, 5.2
 * **Feature: diskon-promo, Property 11: Discount Report Accuracy**
 * **Validates: Requirements 5.1, 5.2**
 */
export async function getDiscountReportSummary(
  dateRange: DateRange
): Promise<DiscountReportSummary> {
  const { startDate, endDate } = dateRange;

  // Query transaction items with discounts within date range
  const { data, error } = await supabase
    .from('transaction_items')
    .select(`
      id,
      transaction_id,
      total_price,
      discount_amount,
      discount_id,
      promo_id,
      transactions!inner(
        id,
        transaction_date,
        status
      )
    `)
    .gte('transactions.transaction_date', startDate)
    .lte('transactions.transaction_date', endDate)
    .eq('transactions.status', 'completed');

  if (error) {
    throw new Error(`Failed to fetch discount report: ${error.message}`);
  }

  // Transform data for calculation
  const items = (data || []).map(item => ({
    transaction_id: item.transaction_id,
    total_price: Number(item.total_price),
    discount_amount: item.discount_amount ? Number(item.discount_amount) : null,
    discount_id: item.discount_id,
    promo_id: item.promo_id,
  }));

  return calculateDiscountReportSummary(items);
}

/**
 * Get performance metrics for a specific promo
 * Requirements: 5.1, 5.2
 */
export async function getPromoPerformance(promoId: string): Promise<PromoPerformance> {
  // Get promo details
  const { data: promo, error: promoError } = await supabase
    .from('promos')
    .select('id, name')
    .eq('id', promoId)
    .single();

  if (promoError) {
    throw new Error(`Failed to fetch promo: ${promoError.message}`);
  }

  // Get transaction items for this promo
  const { data: items, error: itemsError } = await supabase
    .from('transaction_items')
    .select(`
      id,
      transaction_id,
      total_price,
      discount_amount,
      promo_id,
      transactions!inner(
        id,
        status
      )
    `)
    .eq('promo_id', promoId)
    .eq('transactions.status', 'completed');

  if (itemsError) {
    throw new Error(`Failed to fetch promo transactions: ${itemsError.message}`);
  }

  // Transform data for calculation
  const transactionItems = (items || []).map(item => ({
    transaction_id: item.transaction_id,
    total_price: Number(item.total_price),
    discount_amount: item.discount_amount ? Number(item.discount_amount) : null,
    promo_id: item.promo_id,
  }));

  return calculatePromoPerformance(promoId, promo.name, transactionItems);
}

/**
 * Get transactions with discounts applied
 * Requirements: 5.4
 */
export async function getDiscountedTransactions(
  filters?: ReportFilters
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      transaction_items!inner(
        discount_id,
        promo_id,
        discount_amount
      )
    `)
    .eq('status', 'completed')
    .order('transaction_date', { ascending: false });

  // Apply date filters
  if (filters?.startDate) {
    query = query.gte('transaction_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('transaction_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch discounted transactions: ${error.message}`);
  }

  // Filter to only include transactions that have items with discounts
  const transactionsWithDiscounts = (data || []).filter(tx => {
    const items = tx.transaction_items as Array<{
      discount_id: string | null;
      promo_id: string | null;
      discount_amount: number | null;
    }>;
    return items.some(
      item => (item.discount_id !== null || item.promo_id !== null) && 
              item.discount_amount !== null && 
              Number(item.discount_amount) > 0
    );
  });

  // Apply promo filter if specified
  let filteredTransactions = transactionsWithDiscounts;
  if (filters?.promoId) {
    filteredTransactions = filteredTransactions.filter(tx => {
      const items = tx.transaction_items as Array<{ promo_id: string | null }>;
      return items.some(item => item.promo_id === filters.promoId);
    });
  }

  // Apply discount filter if specified
  if (filters?.discountId) {
    filteredTransactions = filteredTransactions.filter(tx => {
      const items = tx.transaction_items as Array<{ discount_id: string | null }>;
      return items.some(item => item.discount_id === filters.discountId);
    });
  }

  // Remove transaction_items from result (not part of Transaction type)
  return filteredTransactions.map(tx => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transaction_items, ...transaction } = tx;
    return transaction as Transaction;
  });
}
