import { supabase } from '@/lib/supabaseClient';
import { ReturnReason, ReturnStatus } from './returns';

// ============================================
// Types for Return Report API
// Requirements: 5.1, 5.2, 5.3, 5.4
// ============================================

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface TopReturnedProduct {
  product_id: string;
  product_name: string;
  return_count: number;
  total_quantity: number;
}

export interface ReturnReportSummary {
  totalReturns: number;
  totalRefundAmount: number;
  returnsByReason: Record<ReturnReason, number>;
  topReturnedProducts: TopReturnedProduct[];
}

// ============================================
// Pure Functions for Testing
// Requirements: 5.1, 5.2, 5.3, 5.4
// ============================================

/**
 * Raw return data from database
 */
export interface RawReturnData {
  id: string;
  status: ReturnStatus;
  total_refund: number;
  created_at: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    reason: ReturnReason;
  }>;
}

/**
 * Calculate total returns count from raw data (pure function for testing)
 * Only counts completed returns
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.1**
 */
export function calculateTotalReturns(returns: RawReturnData[]): number {
  return returns.filter(r => r.status === 'completed').length;
}

/**
 * Calculate total refund amount from raw data (pure function for testing)
 * Only sums completed returns
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.3**
 */
export function calculateTotalRefundAmount(returns: RawReturnData[]): number {
  return returns
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + Number(r.total_refund), 0);
}

/**
 * Calculate returns breakdown by reason (pure function for testing)
 * Only counts items from completed returns
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.2**
 */
export function calculateReturnsByReason(returns: RawReturnData[]): Record<ReturnReason, number> {
  const result: Record<ReturnReason, number> = {
    damaged: 0,
    wrong_product: 0,
    not_as_described: 0,
    changed_mind: 0,
    other: 0,
  };

  for (const ret of returns) {
    if (ret.status !== 'completed') continue;
    
    for (const item of ret.items) {
      result[item.reason] = (result[item.reason] || 0) + 1;
    }
  }

  return result;
}

/**
 * Calculate top returned products (pure function for testing)
 * Only counts items from completed returns
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.4**
 */
export function calculateTopReturnedProducts(
  returns: RawReturnData[],
  limit: number = 10
): TopReturnedProduct[] {
  const productMap = new Map<string, { name: string; count: number; quantity: number }>();

  for (const ret of returns) {
    if (ret.status !== 'completed') continue;
    
    for (const item of ret.items) {
      const existing = productMap.get(item.product_id) || {
        name: item.product_name,
        count: 0,
        quantity: 0,
      };
      
      productMap.set(item.product_id, {
        name: item.product_name,
        count: existing.count + 1,
        quantity: existing.quantity + item.quantity,
      });
    }
  }

  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      product_id: productId,
      product_name: data.name,
      return_count: data.count,
      total_quantity: data.quantity,
    }))
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit);
}

/**
 * Process raw return data into report summary (pure function for testing)
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
export function processReturnReportData(returns: RawReturnData[]): ReturnReportSummary {
  return {
    totalReturns: calculateTotalReturns(returns),
    totalRefundAmount: calculateTotalRefundAmount(returns),
    returnsByReason: calculateReturnsByReason(returns),
    topReturnedProducts: calculateTopReturnedProducts(returns),
  };
}

/**
 * Validate that breakdown by reason sums to total return items (pure function for testing)
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.2**
 */
export function validateReasonBreakdownSum(
  returns: RawReturnData[],
  returnsByReason: Record<ReturnReason, number>
): boolean {
  // Count total items from completed returns
  const totalItems = returns
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + r.items.length, 0);

  // Sum of breakdown by reason
  const breakdownSum = Object.values(returnsByReason).reduce((sum, count) => sum + count, 0);

  return totalItems === breakdownSum;
}

// ============================================
// Database Functions
// Requirements: 5.1, 5.2, 5.3, 5.4
// ============================================

/**
 * Get return report summary for a date range
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
export async function getReturnReportSummary(dateRange: DateRange): Promise<ReturnReportSummary> {
  const { startDate, endDate } = dateRange;

  // Fetch returns with items within date range
  const { data: returns, error } = await supabase
    .from('returns')
    .select(`
      id,
      status,
      total_refund,
      created_at,
      return_items (
        product_id,
        quantity,
        reason,
        products (name)
      )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    throw new Error(`Failed to fetch return report: ${error.message}`);
  }

  // Transform to raw data format
  const rawData: RawReturnData[] = (returns || []).map(ret => ({
    id: ret.id,
    status: ret.status as ReturnStatus,
    total_refund: ret.total_refund,
    created_at: ret.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (ret.return_items || []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products?.name || 'Unknown',
      quantity: item.quantity,
      reason: item.reason as ReturnReason,
    })),
  }));

  return processReturnReportData(rawData);
}

/**
 * Get return trend data for a date range
 * **Validates: Requirements 5.1**
 */
export async function getReturnTrend(dateRange: DateRange): Promise<Array<{
  date: string;
  count: number;
  refundAmount: number;
}>> {
  const { startDate, endDate } = dateRange;

  const { data: returns, error } = await supabase
    .from('returns')
    .select('id, status, total_refund, created_at')
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch return trend: ${error.message}`);
  }

  // Group by date
  const dailyMap = new Map<string, { count: number; refundAmount: number }>();

  for (const ret of returns || []) {
    const dateKey = ret.created_at.split('T')[0];
    const existing = dailyMap.get(dateKey) || { count: 0, refundAmount: 0 };
    
    dailyMap.set(dateKey, {
      count: existing.count + 1,
      refundAmount: existing.refundAmount + Number(ret.total_refund),
    });
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      refundAmount: data.refundAmount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
