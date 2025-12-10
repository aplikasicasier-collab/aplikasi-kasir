import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateDiscountReportSummary,
  calculatePromoPerformance,
  filterTransactionItemsByDateRange,
  DiscountReportSummary,
} from './discountReports';

// ============================================
// Helpers
// ============================================

interface MockTransactionItem {
  transaction_id: string;
  total_price: number;
  discount_amount: number | null;
  discount_id: string | null;
  promo_id: string | null;
}

interface MockTransactionItemWithDate extends MockTransactionItem {
  transaction_date: string;
}

/**
 * Generate a random transaction item with discount
 */
const transactionItemWithDiscountArb = fc.record({
  transaction_id: fc.uuid(),
  total_price: fc.integer({ min: 1000, max: 10000000 }),
  discount_amount: fc.integer({ min: 1, max: 100000 }),
  discount_id: fc.option(fc.uuid(), { nil: null }),
  promo_id: fc.option(fc.uuid(), { nil: null }),
}).map(item => ({
  ...item,
  // Ensure at least one of discount_id or promo_id is set
  discount_id: item.discount_id || (item.promo_id ? null : fc.sample(fc.uuid(), 1)[0]),
}));

/**
 * Generate a random transaction item without discount
 */
const transactionItemWithoutDiscountArb = fc.record({
  transaction_id: fc.uuid(),
  total_price: fc.integer({ min: 1000, max: 10000000 }),
  discount_amount: fc.constant(null as number | null),
  discount_id: fc.constant(null as string | null),
  promo_id: fc.constant(null as string | null),
});

/**
 * Generate a mixed array of transaction items (some with discounts, some without)
 */
const mixedTransactionItemsArb = fc.array(
  fc.oneof(
    transactionItemWithDiscountArb,
    transactionItemWithoutDiscountArb
  ),
  { minLength: 0, maxLength: 20 }
);

// ============================================
// Property 11: Discount Report Accuracy
// **Feature: diskon-promo, Property 11: Discount Report Accuracy**
// **Validates: Requirements 5.1, 5.2**
// ============================================

describe('Property 11: Discount Report Accuracy', () => {
  /**
   * Property 11.1: Total sales with discount equals sum of total_price for discounted items
   * For any set of transaction items, totalSalesWithDiscount = Σ(total_price) for items with discounts
   */
  it('Property 11.1: Total sales with discount equals sum of total_price for discounted items', () => {
    fc.assert(
      fc.property(
        mixedTransactionItemsArb,
        (items) => {
          const result = calculateDiscountReportSummary(items);

          // Calculate expected total sales with discount manually
          const discountedItems = items.filter(
            item => (item.discount_id !== null || item.promo_id !== null) &&
                    item.discount_amount !== null &&
                    item.discount_amount > 0
          );

          const expectedTotalSales = discountedItems.reduce(
            (sum, item) => sum + Number(item.total_price),
            0
          );

          return result.totalSalesWithDiscount === expectedTotalSales;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.2: Total discount amount equals sum of discount_amounts
   * For any set of transaction items, totalDiscountAmount = Σ(discount_amount) for items with discounts
   */
  it('Property 11.2: Total discount amount equals sum of discount_amounts for discounted items', () => {
    fc.assert(
      fc.property(
        mixedTransactionItemsArb,
        (items) => {
          const result = calculateDiscountReportSummary(items);

          // Calculate expected total discount amount manually
          const discountedItems = items.filter(
            item => (item.discount_id !== null || item.promo_id !== null) &&
                    item.discount_amount !== null &&
                    item.discount_amount > 0
          );

          const expectedTotalDiscount = discountedItems.reduce(
            (sum, item) => sum + Number(item.discount_amount || 0),
            0
          );

          return result.totalDiscountAmount === expectedTotalDiscount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.3: Transaction count equals unique transaction IDs with discounts
   * For any set of transaction items, transactionCount = count of unique transaction_ids with discounts
   */
  it('Property 11.3: Transaction count equals unique transaction IDs with discounts', () => {
    fc.assert(
      fc.property(
        mixedTransactionItemsArb,
        (items) => {
          const result = calculateDiscountReportSummary(items);

          // Calculate expected transaction count manually
          const discountedItems = items.filter(
            item => (item.discount_id !== null || item.promo_id !== null) &&
                    item.discount_amount !== null &&
                    item.discount_amount > 0
          );

          const uniqueTransactionIds = new Set(discountedItems.map(item => item.transaction_id));
          const expectedCount = uniqueTransactionIds.size;

          return result.transactionCount === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.4: Average discount per transaction is correctly calculated
   * For any set of transaction items, averageDiscountPerTransaction = totalDiscountAmount / transactionCount
   */
  it('Property 11.4: Average discount per transaction equals totalDiscountAmount / transactionCount', () => {
    fc.assert(
      fc.property(
        mixedTransactionItemsArb,
        (items) => {
          const result = calculateDiscountReportSummary(items);

          // Calculate expected average
          const expectedAverage = result.transactionCount > 0
            ? result.totalDiscountAmount / result.transactionCount
            : 0;

          return result.averageDiscountPerTransaction === expectedAverage;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.5: Empty input returns zero values
   * For an empty array of transaction items, all values should be zero
   */
  it('Property 11.5: Empty input returns zero values', () => {
    const result = calculateDiscountReportSummary([]);

    expect(result.totalSalesWithDiscount).toBe(0);
    expect(result.totalDiscountAmount).toBe(0);
    expect(result.transactionCount).toBe(0);
    expect(result.averageDiscountPerTransaction).toBe(0);
  });

  /**
   * Property 11.6: Items without discounts are excluded from calculations
   * For any set of items where none have discounts, all values should be zero
   */
  it('Property 11.6: Items without discounts are excluded from calculations', () => {
    fc.assert(
      fc.property(
        fc.array(transactionItemWithoutDiscountArb, { minLength: 1, maxLength: 10 }),
        (items) => {
          const result = calculateDiscountReportSummary(items);

          return (
            result.totalSalesWithDiscount === 0 &&
            result.totalDiscountAmount === 0 &&
            result.transactionCount === 0 &&
            result.averageDiscountPerTransaction === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.7: All values are non-negative
   * For any input, all report values should be >= 0
   */
  it('Property 11.7: All report values are non-negative', () => {
    fc.assert(
      fc.property(
        mixedTransactionItemsArb,
        (items) => {
          const result = calculateDiscountReportSummary(items);

          return (
            result.totalSalesWithDiscount >= 0 &&
            result.totalDiscountAmount >= 0 &&
            result.transactionCount >= 0 &&
            result.averageDiscountPerTransaction >= 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Promo Performance Tests
// ============================================

describe('Promo Performance Calculation', () => {
  /**
   * Test: Promo performance correctly filters by promo_id
   */
  it('calculates promo performance only for items with matching promo_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // promoId
        fc.array(
          fc.record({
            transaction_id: fc.uuid(),
            total_price: fc.integer({ min: 1000, max: 1000000 }),
            discount_amount: fc.integer({ min: 100, max: 10000 }),
            promo_id: fc.option(fc.uuid(), { nil: null }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (promoId, items) => {
          // Add some items with the target promo_id
          const itemsWithTargetPromo = items.map((item, idx) => ({
            ...item,
            promo_id: idx % 2 === 0 ? promoId : item.promo_id,
          }));

          const result = calculatePromoPerformance(promoId, 'Test Promo', itemsWithTargetPromo);

          // Calculate expected values manually
          const promoItems = itemsWithTargetPromo.filter(item => item.promo_id === promoId);
          const expectedSales = promoItems.reduce((sum, item) => sum + Number(item.total_price), 0);
          const expectedDiscount = promoItems.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
          const expectedTxCount = new Set(promoItems.map(item => item.transaction_id)).size;

          return (
            result.promoId === promoId &&
            result.promoName === 'Test Promo' &&
            result.salesDuringPromo === expectedSales &&
            result.discountGiven === expectedDiscount &&
            result.transactionCount === expectedTxCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test: Promo with no matching items returns zero values
   */
  it('returns zero values when no items match the promo_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // promoId
        fc.array(
          fc.record({
            transaction_id: fc.uuid(),
            total_price: fc.integer({ min: 1000, max: 1000000 }),
            discount_amount: fc.integer({ min: 100, max: 10000 }),
            promo_id: fc.uuid(), // Different promo_id
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (promoId, items) => {
          // Ensure no items have the target promo_id
          const itemsWithDifferentPromo = items.map(item => ({
            ...item,
            promo_id: item.promo_id === promoId ? null : item.promo_id,
          }));

          const result = calculatePromoPerformance(promoId, 'Test Promo', itemsWithDifferentPromo);

          return (
            result.salesDuringPromo === 0 &&
            result.discountGiven === 0 &&
            result.transactionCount === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Date Range Filtering Tests
// ============================================

describe('Date Range Filtering', () => {
  /**
   * Test: Items within date range are included
   */
  it('includes items within the date range', () => {
    const startDate = '2024-01-01T00:00:00Z';
    const endDate = '2024-01-31T23:59:59Z';

    const items: MockTransactionItemWithDate[] = [
      {
        transaction_id: 'tx-1',
        total_price: 10000,
        discount_amount: 1000,
        discount_id: 'disc-1',
        promo_id: null,
        transaction_date: '2024-01-15T12:00:00Z', // Within range
      },
      {
        transaction_id: 'tx-2',
        total_price: 20000,
        discount_amount: 2000,
        discount_id: 'disc-2',
        promo_id: null,
        transaction_date: '2024-02-15T12:00:00Z', // Outside range
      },
    ];

    const result = filterTransactionItemsByDateRange(items, { startDate, endDate });

    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toBe('tx-1');
  });

  /**
   * Test: Items at boundary dates are included
   */
  it('includes items at boundary dates', () => {
    const startDate = '2024-01-01T00:00:00Z';
    const endDate = '2024-01-31T23:59:59Z';

    const items: MockTransactionItemWithDate[] = [
      {
        transaction_id: 'tx-1',
        total_price: 10000,
        discount_amount: 1000,
        discount_id: 'disc-1',
        promo_id: null,
        transaction_date: '2024-01-01T00:00:00Z', // At start
      },
      {
        transaction_id: 'tx-2',
        total_price: 20000,
        discount_amount: 2000,
        discount_id: 'disc-2',
        promo_id: null,
        transaction_date: '2024-01-31T23:59:59Z', // At end
      },
    ];

    const result = filterTransactionItemsByDateRange(items, { startDate, endDate });

    expect(result).toHaveLength(2);
  });

  /**
   * Property test: Filtered items are always within date range
   */
  it('Property: All filtered items are within the date range', () => {
    // Use integer timestamps to avoid invalid date issues
    const minTimestamp = new Date('2020-01-01').getTime();
    const maxTimestamp = new Date('2025-12-31').getTime();

    fc.assert(
      fc.property(
        fc.integer({ min: minTimestamp, max: maxTimestamp }),
        fc.integer({ min: minTimestamp, max: maxTimestamp }),
        fc.array(
          fc.record({
            transaction_id: fc.uuid(),
            total_price: fc.integer({ min: 1000, max: 1000000 }),
            discount_amount: fc.integer({ min: 100, max: 10000 }),
            discount_id: fc.uuid(),
            promo_id: fc.constant(null as string | null),
            transaction_date: fc.integer({ min: minTimestamp, max: maxTimestamp })
              .map(ts => new Date(ts).toISOString()),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (ts1, ts2, items) => {
          // Ensure startDate <= endDate
          const [startDate, endDate] = ts1 <= ts2 
            ? [new Date(ts1).toISOString(), new Date(ts2).toISOString()]
            : [new Date(ts2).toISOString(), new Date(ts1).toISOString()];

          const result = filterTransactionItemsByDateRange(items, { startDate, endDate });

          const startTime = new Date(startDate).getTime();
          const endTime = new Date(endDate).getTime();

          // All filtered items should be within range
          return result.every(item => {
            const itemTime = new Date(item.transaction_date).getTime();
            return itemTime >= startTime && itemTime <= endTime;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
