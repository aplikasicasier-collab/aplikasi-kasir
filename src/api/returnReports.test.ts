import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateTotalReturns,
  calculateTotalRefundAmount,
  calculateReturnsByReason,
  calculateTopReturnedProducts,
  processReturnReportData,
  validateReasonBreakdownSum,
  RawReturnData,
} from './returnReports';
import { ReturnReason, ReturnStatus } from './returns';

// ============================================
// Arbitraries for generating test data
// ============================================

const returnReasonArb = fc.constantFrom<ReturnReason>(
  'damaged',
  'wrong_product',
  'not_as_described',
  'changed_mind',
  'other'
);

const returnStatusArb = fc.constantFrom<ReturnStatus>(
  'pending_approval',
  'approved',
  'completed',
  'rejected',
  'cancelled'
);

const returnItemArb = fc.record({
  product_id: fc.uuid(),
  product_name: fc.string({ minLength: 1, maxLength: 50 }),
  quantity: fc.integer({ min: 1, max: 100 }),
  reason: returnReasonArb,
});

const rawReturnDataArb = fc.record({
  id: fc.uuid(),
  status: returnStatusArb,
  total_refund: fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
  created_at: fc.integer({ min: 1704067200000, max: 1735689600000 })
    .map(ts => new Date(ts).toISOString()),
  items: fc.array(returnItemArb, { minLength: 0, maxLength: 10 }),
});

// Generate returns with at least some completed status
const rawReturnDataWithCompletedArb = fc.record({
  id: fc.uuid(),
  status: fc.constant<ReturnStatus>('completed'),
  total_refund: fc.integer({ min: 0, max: 10000000 }).map(n => n / 100),
  created_at: fc.integer({ min: 1704067200000, max: 1735689600000 })
    .map(ts => new Date(ts).toISOString()),
  items: fc.array(returnItemArb, { minLength: 1, maxLength: 10 }),
});

/**
 * **Feature: retur-refund, Property 7: Return Report Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 * 
 * For any date range, the return report should show:
 * - total_returns equal to count of completed returns
 * - total_refund_amount equal to sum of total_refund
 * - breakdown by reason should sum to total return items
 */
describe('Return Report Accuracy', () => {
  it('Property 7.1: Total returns equals count of completed returns', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const totalReturns = calculateTotalReturns(returns);
          const expectedCount = returns.filter(r => r.status === 'completed').length;
          
          return totalReturns === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Total refund amount equals sum of total_refund for completed returns', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const totalRefund = calculateTotalRefundAmount(returns);
          const expectedTotal = returns
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => sum + r.total_refund, 0);
          
          // Allow small floating point tolerance
          return Math.abs(totalRefund - expectedTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Breakdown by reason sums to total return items from completed returns', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const returnsByReason = calculateReturnsByReason(returns);
          
          return validateReasonBreakdownSum(returns, returnsByReason);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: Each reason category count is non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const returnsByReason = calculateReturnsByReason(returns);
          
          return Object.values(returnsByReason).every(count => count >= 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: All reason categories are present in breakdown', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const returnsByReason = calculateReturnsByReason(returns);
          const expectedReasons: ReturnReason[] = [
            'damaged',
            'wrong_product',
            'not_as_described',
            'changed_mind',
            'other',
          ];
          
          return expectedReasons.every(reason => reason in returnsByReason);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: Non-completed returns are excluded from totals', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 1, maxLength: 50 }),
        (returns) => {
          // Filter to only non-completed returns
          const nonCompletedReturns = returns.map(r => ({
            ...r,
            status: r.status === 'completed' ? 'pending_approval' as ReturnStatus : r.status,
          }));
          
          const totalReturns = calculateTotalReturns(nonCompletedReturns);
          const totalRefund = calculateTotalRefundAmount(nonCompletedReturns);
          const returnsByReason = calculateReturnsByReason(nonCompletedReturns);
          const reasonSum = Object.values(returnsByReason).reduce((sum, c) => sum + c, 0);
          
          return totalReturns === 0 && totalRefund === 0 && reasonSum === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.7: processReturnReportData produces consistent summary', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const summary = processReturnReportData(returns);
          
          // Verify consistency
          const expectedTotalReturns = calculateTotalReturns(returns);
          const expectedTotalRefund = calculateTotalRefundAmount(returns);
          const expectedReturnsByReason = calculateReturnsByReason(returns);
          
          const totalReturnsMatch = summary.totalReturns === expectedTotalReturns;
          const totalRefundMatch = Math.abs(summary.totalRefundAmount - expectedTotalRefund) < 0.01;
          const reasonsMatch = Object.entries(expectedReturnsByReason).every(
            ([reason, count]) => summary.returnsByReason[reason as ReturnReason] === count
          );
          
          return totalReturnsMatch && totalRefundMatch && reasonsMatch;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.8: Empty returns produce zero totals', () => {
    const summary = processReturnReportData([]);
    
    expect(summary.totalReturns).toBe(0);
    expect(summary.totalRefundAmount).toBe(0);
    expect(summary.topReturnedProducts).toEqual([]);
    
    const reasonSum = Object.values(summary.returnsByReason).reduce((sum, c) => sum + c, 0);
    expect(reasonSum).toBe(0);
  });
});

/**
 * Top Returned Products Tests
 * **Validates: Requirements 5.4**
 */
describe('Top Returned Products', () => {
  it('Property 7.9: Top products are sorted by total quantity descending', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataWithCompletedArb, { minLength: 1, maxLength: 30 }),
        (returns) => {
          const topProducts = calculateTopReturnedProducts(returns);
          
          // Check descending order by total_quantity
          for (let i = 1; i < topProducts.length; i++) {
            if (topProducts[i].total_quantity > topProducts[i - 1].total_quantity) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.10: Maximum 10 products returned by default', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataWithCompletedArb, { minLength: 0, maxLength: 50 }),
        (returns) => {
          const topProducts = calculateTopReturnedProducts(returns);
          
          return topProducts.length <= 10;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.11: Each product entry includes required fields', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataWithCompletedArb, { minLength: 1, maxLength: 30 }),
        (returns) => {
          const topProducts = calculateTopReturnedProducts(returns);
          
          return topProducts.every(product =>
            typeof product.product_id === 'string' &&
            typeof product.product_name === 'string' &&
            typeof product.return_count === 'number' &&
            typeof product.total_quantity === 'number' &&
            product.return_count >= 0 &&
            product.total_quantity >= 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.12: Product quantities are correctly aggregated', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataWithCompletedArb, { minLength: 1, maxLength: 30 }),
        (returns) => {
          const topProducts = calculateTopReturnedProducts(returns);
          
          // Calculate expected totals per product
          const expectedTotals = new Map<string, number>();
          for (const ret of returns) {
            if (ret.status !== 'completed') continue;
            for (const item of ret.items) {
              const current = expectedTotals.get(item.product_id) || 0;
              expectedTotals.set(item.product_id, current + item.quantity);
            }
          }
          
          // Verify each result matches expected
          for (const product of topProducts) {
            const expected = expectedTotals.get(product.product_id);
            if (expected !== product.total_quantity) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.13: Return count is correctly aggregated per product', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataWithCompletedArb, { minLength: 1, maxLength: 30 }),
        (returns) => {
          const topProducts = calculateTopReturnedProducts(returns);
          
          // Calculate expected return counts per product
          const expectedCounts = new Map<string, number>();
          for (const ret of returns) {
            if (ret.status !== 'completed') continue;
            for (const item of ret.items) {
              const current = expectedCounts.get(item.product_id) || 0;
              expectedCounts.set(item.product_id, current + 1);
            }
          }
          
          // Verify each result matches expected
          for (const product of topProducts) {
            const expected = expectedCounts.get(product.product_id);
            if (expected !== product.return_count) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.14: Custom limit is respected', () => {
    fc.assert(
      fc.property(
        fc.array(rawReturnDataWithCompletedArb, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 20 }),
        (returns, limit) => {
          const topProducts = calculateTopReturnedProducts(returns, limit);
          
          return topProducts.length <= limit;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for edge cases
describe('Return Report Edge Cases', () => {
  it('handles returns with empty items array', () => {
    const returns: RawReturnData[] = [
      {
        id: '1',
        status: 'completed',
        total_refund: 100,
        created_at: '2024-01-15T10:00:00Z',
        items: [],
      },
    ];
    
    const summary = processReturnReportData(returns);
    
    expect(summary.totalReturns).toBe(1);
    expect(summary.totalRefundAmount).toBe(100);
    expect(summary.topReturnedProducts).toEqual([]);
  });

  it('handles mixed status returns correctly', () => {
    const returns: RawReturnData[] = [
      {
        id: '1',
        status: 'completed',
        total_refund: 100,
        created_at: '2024-01-15T10:00:00Z',
        items: [{ product_id: 'p1', product_name: 'Product 1', quantity: 2, reason: 'damaged' }],
      },
      {
        id: '2',
        status: 'pending_approval',
        total_refund: 200,
        created_at: '2024-01-15T11:00:00Z',
        items: [{ product_id: 'p2', product_name: 'Product 2', quantity: 3, reason: 'wrong_product' }],
      },
      {
        id: '3',
        status: 'rejected',
        total_refund: 150,
        created_at: '2024-01-15T12:00:00Z',
        items: [{ product_id: 'p3', product_name: 'Product 3', quantity: 1, reason: 'other' }],
      },
    ];
    
    const summary = processReturnReportData(returns);
    
    // Only completed return should be counted
    expect(summary.totalReturns).toBe(1);
    expect(summary.totalRefundAmount).toBe(100);
    expect(summary.returnsByReason.damaged).toBe(1);
    expect(summary.returnsByReason.wrong_product).toBe(0);
    expect(summary.returnsByReason.other).toBe(0);
    expect(summary.topReturnedProducts.length).toBe(1);
    expect(summary.topReturnedProducts[0].product_id).toBe('p1');
  });

  it('aggregates same product from multiple returns', () => {
    const returns: RawReturnData[] = [
      {
        id: '1',
        status: 'completed',
        total_refund: 100,
        created_at: '2024-01-15T10:00:00Z',
        items: [{ product_id: 'p1', product_name: 'Product 1', quantity: 2, reason: 'damaged' }],
      },
      {
        id: '2',
        status: 'completed',
        total_refund: 150,
        created_at: '2024-01-16T10:00:00Z',
        items: [{ product_id: 'p1', product_name: 'Product 1', quantity: 3, reason: 'wrong_product' }],
      },
    ];
    
    const summary = processReturnReportData(returns);
    
    expect(summary.totalReturns).toBe(2);
    expect(summary.totalRefundAmount).toBe(250);
    expect(summary.topReturnedProducts.length).toBe(1);
    expect(summary.topReturnedProducts[0].product_id).toBe('p1');
    expect(summary.topReturnedProducts[0].total_quantity).toBe(5);
    expect(summary.topReturnedProducts[0].return_count).toBe(2);
  });
});
