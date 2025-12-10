import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  groupSalesByPeriod, 
  aggregateTopProductsByQuantity, 
  aggregateTopProductsByRevenue,
  calculateStockStatus,
  processStockReportData,
  filterStockReportData,
  StockStatus,
} from './reports';

/**
 * **Feature: laporan, Property 1: Sales Aggregation Accuracy**
 * **Validates: Requirements 1.1, 1.3, 1.4**
 * 
 * For any date range, the total sales amount should equal the sum of all 
 * completed transaction amounts in that range, the total transactions should 
 * equal the count of completed transactions, AND the average should equal 
 * total divided by count. For daily reports, data should be grouped by hour (0-23); 
 * for monthly reports, by day (1-31).
 */
describe('Sales Aggregation Accuracy', () => {
  // Arbitrary for generating mock transactions
  const transactionArb = fc.record({
    id: fc.uuid(),
    total_amount: fc.float({ min: 0, max: 10000, noNaN: true }),
    transaction_date: fc.integer({ min: 1704067200000, max: 1735689600000 })
      .map(ts => new Date(ts).toISOString()),
  });

  it('Property 1.1: Total sales equals sum of all transaction amounts', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const result = groupSalesByPeriod(transactions, 'day');
          
          const expectedTotal = transactions.reduce(
            (sum, tx) => sum + tx.total_amount, 
            0
          );
          const actualTotal = result.reduce(
            (sum, period) => sum + period.amount, 
            0
          );
          
          // Allow small floating point tolerance
          return Math.abs(expectedTotal - actualTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: Total transaction count equals number of transactions', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const result = groupSalesByPeriod(transactions, 'day');
          
          const expectedCount = transactions.length;
          const actualCount = result.reduce(
            (sum, period) => sum + period.count, 
            0
          );
          
          return expectedCount === actualCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: Daily reports group by hour (0-23)', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 50 }),
        (transactions) => {
          const result = groupSalesByPeriod(transactions, 'hour');
          
          // All periods should be valid hours (00-23)
          return result.every(period => {
            const hour = parseInt(period.period);
            return hour >= 0 && hour <= 23;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.4: Monthly reports group by day (1-31)', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 50 }),
        (transactions) => {
          const result = groupSalesByPeriod(transactions, 'day');
          
          // All periods should be valid days (1-31)
          return result.every(period => {
            const day = parseInt(period.period);
            return day >= 1 && day <= 31;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.5: Results are sorted by period ascending', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 2, maxLength: 50 }),
        (transactions) => {
          const result = groupSalesByPeriod(transactions, 'day');
          
          // Check that periods are sorted
          for (let i = 1; i < result.length; i++) {
            if (parseInt(result[i].period) < parseInt(result[i - 1].period)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.6: Empty transactions return empty result', () => {
    const result = groupSalesByPeriod([], 'day');
    expect(result).toEqual([]);
  });
});


/**
 * **Feature: laporan, Property 2: Top Products Ranking**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * For any sales report, the top products by quantity should be sorted in 
 * descending order by quantity sold with maximum 10 items, the top products 
 * by revenue should be sorted in descending order by revenue with maximum 10 items, 
 * AND each product entry should include product name, quantity sold, and total revenue.
 */
describe('Top Products Ranking', () => {
  // Arbitrary for generating transaction items
  const transactionItemArb = fc.record({
    product_id: fc.stringMatching(/^[a-f0-9-]{36}$/),
    product_name: fc.string({ minLength: 1, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 100 }),
    total_price: fc.integer({ min: 1, max: 1000000 }).map(n => n / 100),
  });

  it('Property 2.1: Top products by quantity are sorted in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(transactionItemArb, { minLength: 1, maxLength: 100 }),
        (items) => {
          const result = aggregateTopProductsByQuantity(items);
          
          // Check descending order by quantity
          for (let i = 1; i < result.length; i++) {
            if (result[i].quantity > result[i - 1].quantity) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.2: Top products by revenue are sorted in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(transactionItemArb, { minLength: 1, maxLength: 100 }),
        (items) => {
          const result = aggregateTopProductsByRevenue(items);
          
          // Check descending order by revenue
          for (let i = 1; i < result.length; i++) {
            if (result[i].revenue > result[i - 1].revenue) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.3: Maximum 10 products returned', () => {
    fc.assert(
      fc.property(
        fc.array(transactionItemArb, { minLength: 0, maxLength: 100 }),
        (items) => {
          const byQuantity = aggregateTopProductsByQuantity(items);
          const byRevenue = aggregateTopProductsByRevenue(items);
          
          return byQuantity.length <= 10 && byRevenue.length <= 10;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.4: Each product entry includes name, quantity, and revenue', () => {
    fc.assert(
      fc.property(
        fc.array(transactionItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const result = aggregateTopProductsByQuantity(items);
          
          return result.every(product => 
            typeof product.productId === 'string' &&
            typeof product.productName === 'string' &&
            typeof product.quantity === 'number' &&
            typeof product.revenue === 'number'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.5: Aggregation correctly sums quantities for same product', () => {
    fc.assert(
      fc.property(
        fc.array(transactionItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const result = aggregateTopProductsByQuantity(items);
          
          // Calculate expected totals per product
          const expectedTotals = new Map<string, number>();
          for (const item of items) {
            const current = expectedTotals.get(item.product_id) || 0;
            expectedTotals.set(item.product_id, current + item.quantity);
          }
          
          // Verify each result matches expected
          for (const product of result) {
            const expected = expectedTotals.get(product.productId);
            if (expected !== product.quantity) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.6: Empty items return empty result', () => {
    const byQuantity = aggregateTopProductsByQuantity([]);
    const byRevenue = aggregateTopProductsByRevenue([]);
    
    expect(byQuantity).toEqual([]);
    expect(byRevenue).toEqual([]);
  });
});


/**
 * **Feature: laporan, Property 3: Stock Report Data Integrity**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 * 
 * For any stock report, all active products should be included with current stock 
 * and minimum stock level, products where stock_quantity <= min_stock should have 
 * status 'low', AND total inventory value should equal the sum of 
 * (stock_quantity × price) for all products.
 */
describe('Stock Report Data Integrity', () => {
  // Arbitrary for generating mock products
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    stock_quantity: fc.integer({ min: 0, max: 1000 }),
    min_stock: fc.integer({ min: 1, max: 100 }),
    price: fc.integer({ min: 100, max: 1000000 }).map(n => n / 100),
    category_id: fc.option(fc.uuid(), { nil: undefined }),
  });

  it('Property 3.1: All products are included with current stock and min stock level', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          // All products should be included
          if (result.products.length !== products.length) {
            return false;
          }
          
          // Each product should have current stock and min stock
          return result.products.every(p => 
            typeof p.currentStock === 'number' &&
            typeof p.minStock === 'number' &&
            typeof p.productId === 'string' &&
            typeof p.productName === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.2: Products with stock <= min_stock have status "low"', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          // Check each product's status
          for (const product of result.products) {
            if (product.currentStock <= product.minStock) {
              if (product.stockStatus !== 'low') {
                return false;
              }
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.3: Products with stock > min_stock * 3 have status "overstocked"', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          for (const product of result.products) {
            if (product.currentStock > product.minStock * 3) {
              if (product.stockStatus !== 'overstocked') {
                return false;
              }
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.4: Products with min_stock < stock <= min_stock * 3 have status "normal"', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          for (const product of result.products) {
            if (product.currentStock > product.minStock && 
                product.currentStock <= product.minStock * 3) {
              if (product.stockStatus !== 'normal') {
                return false;
              }
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.5: Total inventory value equals sum of (stock_quantity × price)', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          const expectedTotal = products.reduce(
            (sum, p) => sum + (p.stock_quantity * p.price),
            0
          );
          
          // Allow small floating point tolerance
          return Math.abs(result.totalInventoryValue - expectedTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.6: Low stock count equals count of products with status "low"', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          const expectedLowCount = result.products.filter(
            p => p.stockStatus === 'low'
          ).length;
          
          return result.lowStockCount === expectedLowCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.7: Stock value for each product equals stock_quantity × price', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        (products) => {
          const result = processStockReportData(products);
          
          for (let i = 0; i < products.length; i++) {
            const original = products[i];
            const processed = result.products.find(p => p.productId === original.id);
            
            if (!processed) return false;
            
            const expectedValue = original.stock_quantity * original.price;
            if (Math.abs(processed.stockValue - expectedValue) > 0.01) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.8: Empty products return empty result with zero totals', () => {
    const result = processStockReportData([]);
    
    expect(result.products).toEqual([]);
    expect(result.totalInventoryValue).toBe(0);
    expect(result.lowStockCount).toBe(0);
  });
});

// Unit tests for calculateStockStatus
describe('calculateStockStatus', () => {
  it('returns "low" when stock equals min_stock', () => {
    expect(calculateStockStatus(10, 10)).toBe('low');
  });

  it('returns "low" when stock is below min_stock', () => {
    expect(calculateStockStatus(5, 10)).toBe('low');
  });

  it('returns "normal" when stock is above min_stock but not overstocked', () => {
    expect(calculateStockStatus(20, 10)).toBe('normal');
    expect(calculateStockStatus(30, 10)).toBe('normal');
  });

  it('returns "overstocked" when stock is more than 3x min_stock', () => {
    expect(calculateStockStatus(31, 10)).toBe('overstocked');
    expect(calculateStockStatus(100, 10)).toBe('overstocked');
  });

  it('returns "normal" when stock equals exactly 3x min_stock', () => {
    expect(calculateStockStatus(30, 10)).toBe('normal');
  });
});


/**
 * **Feature: laporan, Property 4: Stock Report Filtering**
 * **Validates: Requirements 3.3**
 * 
 * For any stock report filter by status, all returned products should have 
 * the matching stock status (low, normal, or overstocked).
 */
describe('Stock Report Filtering', () => {
  // Arbitrary for generating mock products
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    stock_quantity: fc.integer({ min: 0, max: 1000 }),
    min_stock: fc.integer({ min: 1, max: 100 }),
    price: fc.integer({ min: 100, max: 1000000 }).map(n => n / 100),
    category_id: fc.option(fc.uuid(), { nil: undefined }),
  });

  // Arbitrary for stock status
  const stockStatusArb = fc.constantFrom<StockStatus>('low', 'normal', 'overstocked');

  it('Property 4.1: Filter by status returns only products with matching status', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        stockStatusArb,
        (products, filterStatus) => {
          const reportData = processStockReportData(products);
          const filtered = filterStockReportData(reportData, { stockStatus: filterStatus });
          
          // All returned products should have the matching status
          return filtered.products.every(p => p.stockStatus === filterStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: Filter by category returns only products with matching category', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (products, categoryId) => {
          // Ensure at least some products have the category
          const productsWithCategory = products.map((p, i) => 
            i % 3 === 0 ? { ...p, category_id: categoryId } : p
          );
          
          const reportData = processStockReportData(productsWithCategory);
          const filtered = filterStockReportData(reportData, { category: categoryId });
          
          // All returned products should have the matching category
          return filtered.products.every(p => p.categoryId === categoryId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: Combined filters return products matching both criteria', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        stockStatusArb,
        (products, categoryId, filterStatus) => {
          // Ensure some products have the category
          const productsWithCategory = products.map((p, i) => 
            i % 2 === 0 ? { ...p, category_id: categoryId } : p
          );
          
          const reportData = processStockReportData(productsWithCategory);
          const filtered = filterStockReportData(reportData, { 
            category: categoryId, 
            stockStatus: filterStatus 
          });
          
          // All returned products should match both criteria
          return filtered.products.every(p => 
            p.categoryId === categoryId && p.stockStatus === filterStatus
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.4: Filtered total inventory value equals sum of filtered products', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        stockStatusArb,
        (products, filterStatus) => {
          const reportData = processStockReportData(products);
          const filtered = filterStockReportData(reportData, { stockStatus: filterStatus });
          
          const expectedTotal = filtered.products.reduce(
            (sum, p) => sum + p.stockValue,
            0
          );
          
          return Math.abs(filtered.totalInventoryValue - expectedTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.5: Filtered low stock count equals count of low status in filtered results', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (products, categoryId) => {
          const productsWithCategory = products.map((p, i) => 
            i % 2 === 0 ? { ...p, category_id: categoryId } : p
          );
          
          const reportData = processStockReportData(productsWithCategory);
          const filtered = filterStockReportData(reportData, { category: categoryId });
          
          const expectedLowCount = filtered.products.filter(
            p => p.stockStatus === 'low'
          ).length;
          
          return filtered.lowStockCount === expectedLowCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.6: No filters returns all products unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 50 }),
        (products) => {
          const reportData = processStockReportData(products);
          const filtered = filterStockReportData(reportData, {});
          
          return filtered.products.length === reportData.products.length &&
                 filtered.totalInventoryValue === reportData.totalInventoryValue &&
                 filtered.lowStockCount === reportData.lowStockCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.7: Filter with non-existent category returns empty result', () => {
    const products = [
      { id: '1', name: 'Product 1', stock_quantity: 10, min_stock: 5, price: 100, category_id: 'cat-1' },
      { id: '2', name: 'Product 2', stock_quantity: 20, min_stock: 10, price: 200, category_id: 'cat-2' },
    ];
    
    const reportData = processStockReportData(products);
    const filtered = filterStockReportData(reportData, { category: 'non-existent-category' });
    
    expect(filtered.products).toEqual([]);
    expect(filtered.totalInventoryValue).toBe(0);
    expect(filtered.lowStockCount).toBe(0);
  });
});


/**
 * **Feature: laporan, Property 5: Stock Movements with Running Balance**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 * 
 * For any stock movement query, each movement should include date, product, 
 * movement_type, quantity, and reference. The running balance for each product 
 * should be the cumulative sum of movements (positive for 'in', negative for 'out').
 * Filtered results should match the specified date range, product, and movement type.
 */
import {
  calculateRunningBalance,
  filterMovements,
  processStockMovements,
  MovementType,
} from './reports';

describe('Stock Movements with Running Balance', () => {
  // Arbitrary for movement type
  const movementTypeArb = fc.constantFrom<MovementType>('in', 'out', 'adjustment');

  // Arbitrary for generating raw movements
  const rawMovementArb = fc.record({
    id: fc.uuid(),
    created_at: fc.integer({ min: 1704067200000, max: 1735689600000 })
      .map(ts => new Date(ts).toISOString()),
    product_id: fc.uuid(),
    product_name: fc.string({ minLength: 1, maxLength: 50 }),
    movement_type: movementTypeArb,
    quantity: fc.integer({ min: 1, max: 1000 }),
    reference_type: fc.option(fc.constantFrom('transaction', 'purchase_order', 'manual'), { nil: undefined }),
    reference_id: fc.option(fc.uuid(), { nil: undefined }),
  });

  it('Property 5.1: Each movement includes date, product, movement_type, quantity, and reference fields', () => {
    fc.assert(
      fc.property(
        fc.array(rawMovementArb, { minLength: 1, maxLength: 50 }),
        (movements) => {
          const result = calculateRunningBalance(movements);
          
          return result.every(m => 
            typeof m.id === 'string' &&
            typeof m.date === 'string' &&
            typeof m.productId === 'string' &&
            typeof m.productName === 'string' &&
            typeof m.movementType === 'string' &&
            ['in', 'out', 'adjustment'].includes(m.movementType) &&
            typeof m.quantity === 'number' &&
            typeof m.runningBalance === 'number' &&
            (m.referenceType === undefined || typeof m.referenceType === 'string') &&
            (m.referenceId === undefined || typeof m.referenceId === 'string')
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: Running balance for "in" movements adds to balance', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
        (productId, productName, quantities) => {
          // Create only 'in' movements for a single product
          const movements = quantities.map((qty, i) => ({
            id: `id-${i}`,
            created_at: new Date(1704067200000 + i * 86400000).toISOString(),
            product_id: productId,
            product_name: productName,
            movement_type: 'in' as MovementType,
            quantity: qty,
            reference_type: undefined,
            reference_id: undefined,
          }));

          const result = calculateRunningBalance(movements);
          
          // Running balance should be cumulative sum
          let expectedBalance = 0;
          // Results are in reverse order (most recent first), so check from end
          const sortedResult = [...result].reverse();
          
          for (let i = 0; i < sortedResult.length; i++) {
            expectedBalance += quantities[i];
            if (sortedResult[i].runningBalance !== expectedBalance) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: Running balance for "out" movements subtracts from balance', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 100, max: 1000 }),
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 5 }),
        (productId, productName, initialQty, outQuantities) => {
          // Create an initial 'in' movement followed by 'out' movements
          const movements = [
            {
              id: 'id-initial',
              created_at: new Date(1704067200000).toISOString(),
              product_id: productId,
              product_name: productName,
              movement_type: 'in' as MovementType,
              quantity: initialQty,
              reference_type: undefined,
              reference_id: undefined,
            },
            ...outQuantities.map((qty, i) => ({
              id: `id-out-${i}`,
              created_at: new Date(1704067200000 + (i + 1) * 86400000).toISOString(),
              product_id: productId,
              product_name: productName,
              movement_type: 'out' as MovementType,
              quantity: qty,
              reference_type: undefined,
              reference_id: undefined,
            })),
          ];

          const result = calculateRunningBalance(movements);
          
          // Calculate expected final balance
          const totalOut = outQuantities.reduce((sum, q) => sum + q, 0);
          const expectedFinalBalance = initialQty - totalOut;
          
          // Most recent movement (first in result) should have the final balance
          return result[0].runningBalance === expectedFinalBalance;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.4: Running balance is calculated per product independently', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
        (productId1, productId2, quantities1, quantities2) => {
          // Skip if same product IDs
          if (productId1 === productId2) return true;

          // Create movements for two different products
          const movements = [
            ...quantities1.map((qty, i) => ({
              id: `p1-${i}`,
              created_at: new Date(1704067200000 + i * 86400000).toISOString(),
              product_id: productId1,
              product_name: 'Product 1',
              movement_type: 'in' as MovementType,
              quantity: qty,
              reference_type: undefined,
              reference_id: undefined,
            })),
            ...quantities2.map((qty, i) => ({
              id: `p2-${i}`,
              created_at: new Date(1704067200000 + i * 86400000).toISOString(),
              product_id: productId2,
              product_name: 'Product 2',
              movement_type: 'in' as MovementType,
              quantity: qty,
              reference_type: undefined,
              reference_id: undefined,
            })),
          ];

          const result = calculateRunningBalance(movements);
          
          // Get final balance for each product
          const product1Movements = result.filter(m => m.productId === productId1);
          const product2Movements = result.filter(m => m.productId === productId2);
          
          const expectedBalance1 = quantities1.reduce((sum, q) => sum + q, 0);
          const expectedBalance2 = quantities2.reduce((sum, q) => sum + q, 0);
          
          // Most recent movement for each product should have correct balance
          return product1Movements[0]?.runningBalance === expectedBalance1 &&
                 product2Movements[0]?.runningBalance === expectedBalance2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.5: Filter by date range returns only movements within range', () => {
    fc.assert(
      fc.property(
        fc.array(rawMovementArb, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1704067200000, max: 1720000000000 }),
        fc.integer({ min: 1720000000000, max: 1735689600000 }),
        (movements, startTs, endTs) => {
          const startDate = new Date(startTs).toISOString();
          const endDate = new Date(endTs).toISOString();
          
          const filtered = filterMovements(movements, { startDate, endDate });
          
          // All filtered movements should be within date range
          return filtered.every(m => {
            const movementTime = new Date(m.created_at).getTime();
            return movementTime >= startTs && movementTime <= endTs;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.6: Filter by product returns only movements for that product', () => {
    fc.assert(
      fc.property(
        fc.array(rawMovementArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (movements, productId) => {
          // Ensure some movements have the target product
          const movementsWithProduct = movements.map((m, i) => 
            i % 3 === 0 ? { ...m, product_id: productId } : m
          );
          
          const filtered = filterMovements(movementsWithProduct, { productId });
          
          // All filtered movements should be for the specified product
          return filtered.every(m => m.product_id === productId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.7: Filter by movement type returns only movements of that type', () => {
    fc.assert(
      fc.property(
        fc.array(rawMovementArb, { minLength: 1, maxLength: 50 }),
        movementTypeArb,
        (movements, movementType) => {
          const filtered = filterMovements(movements, { movementType });
          
          // All filtered movements should have the specified type
          return filtered.every(m => m.movement_type === movementType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.8: processStockMovements applies filters and calculates running balance', () => {
    fc.assert(
      fc.property(
        fc.array(rawMovementArb, { minLength: 1, maxLength: 50 }),
        movementTypeArb,
        (movements, movementType) => {
          const result = processStockMovements(movements, { movementType });
          
          // All movements should have the filtered type
          const allMatchType = result.movements.every(m => m.movementType === movementType);
          
          // All movements should have required fields
          const allHaveFields = result.movements.every(m =>
            typeof m.id === 'string' &&
            typeof m.date === 'string' &&
            typeof m.productId === 'string' &&
            typeof m.runningBalance === 'number'
          );
          
          return allMatchType && allHaveFields;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.9: Empty movements return empty result', () => {
    const result = calculateRunningBalance([]);
    expect(result).toEqual([]);
  });

  it('Property 5.10: No filters returns all movements', () => {
    fc.assert(
      fc.property(
        fc.array(rawMovementArb, { minLength: 0, maxLength: 50 }),
        (movements) => {
          const filtered = filterMovements(movements, {});
          return filtered.length === movements.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: laporan, Property 7: Dashboard Summary Accuracy**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 * 
 * For any dashboard query: today's sales should equal sum of today's completed transactions,
 * yesterday comparison should be accurate, week sales should equal sum of this week's transactions,
 * last week comparison should be accurate, low stock count should equal count of products where
 * stock <= min_stock, AND recent transactions should return exactly 5 most recent completed transactions.
 */
import {
  calculateSalesTotals,
  calculateLowStockCount,
  getRecentTransactionsFromList,
  processDashboardData,
  getDashboardDateRanges,
} from './reports';

describe('Dashboard Summary Accuracy', () => {
  // Arbitrary for generating mock transactions
  const transactionArb = fc.record({
    id: fc.uuid(),
    transaction_number: fc.string({ minLength: 5, maxLength: 20 }),
    total_amount: fc.float({ min: 0, max: 10000, noNaN: true }),
    transaction_date: fc.integer({ min: 1704067200000, max: 1735689600000 })
      .map(ts => new Date(ts).toISOString()),
    status: fc.constantFrom('completed', 'pending', 'cancelled'),
  });

  // Arbitrary for generating mock products
  const productArb = fc.record({
    stock_quantity: fc.integer({ min: 0, max: 1000 }),
    min_stock: fc.integer({ min: 1, max: 100 }),
    is_active: fc.boolean(),
  });

  it('Property 7.1: Today\'s sales equals sum of today\'s completed transactions', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          // Create a fixed date range for testing
          const now = new Date();
          const todayStart = new Date(now);
          todayStart.setUTCHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setUTCHours(23, 59, 59, 999);
          
          // Ensure some transactions are within today
          const todayTransactions = transactions.map((tx, i) => {
            if (i % 3 === 0) {
              const todayTime = todayStart.getTime() + Math.random() * (todayEnd.getTime() - todayStart.getTime());
              return { ...tx, transaction_date: new Date(todayTime).toISOString(), status: 'completed' as const };
            }
            return tx;
          });
          
          const result = calculateSalesTotals(
            todayTransactions,
            todayStart.toISOString(),
            todayEnd.toISOString()
          );
          
          // Calculate expected total manually
          const expectedTotal = todayTransactions
            .filter(tx => {
              if (tx.status !== 'completed') return false;
              const txTime = new Date(tx.transaction_date).getTime();
              return txTime >= todayStart.getTime() && txTime <= todayEnd.getTime();
            })
            .reduce((sum, tx) => sum + tx.total_amount, 0);
          
          return Math.abs(result.totalSales - expectedTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Transaction count equals number of completed transactions in range', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1704067200000, max: 1720000000000 }),
        fc.integer({ min: 1720000000000, max: 1735689600000 }),
        (transactions, startTs, endTs) => {
          const startDate = new Date(startTs).toISOString();
          const endDate = new Date(endTs).toISOString();
          
          const result = calculateSalesTotals(transactions, startDate, endDate);
          
          // Calculate expected count manually
          const expectedCount = transactions.filter(tx => {
            if (tx.status !== 'completed') return false;
            const txTime = new Date(tx.transaction_date).getTime();
            return txTime >= startTs && txTime <= endTs;
          }).length;
          
          return result.transactionCount === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Low stock count equals count of active products where stock <= min_stock', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 50 }),
        (products) => {
          const result = calculateLowStockCount(products);
          
          // Calculate expected count manually
          const expectedCount = products.filter(p => 
            p.is_active !== false && p.stock_quantity <= p.min_stock
          ).length;
          
          return result === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: Recent transactions returns at most 5 completed transactions', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const result = getRecentTransactionsFromList(transactions, 5);
          
          // Should return at most 5
          if (result.length > 5) return false;
          
          // All should be completed
          return result.every(tx => tx.status === 'completed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: Recent transactions are sorted by date descending (most recent first)', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 2, maxLength: 50 }),
        (transactions) => {
          const result = getRecentTransactionsFromList(transactions, 5);
          
          // Check descending order
          for (let i = 1; i < result.length; i++) {
            const prevTime = new Date(result[i - 1].transactionDate).getTime();
            const currTime = new Date(result[i].transactionDate).getTime();
            if (currTime > prevTime) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: Recent transactions include required fields', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 50 }),
        (transactions) => {
          const result = getRecentTransactionsFromList(transactions, 5);
          
          return result.every(tx =>
            typeof tx.id === 'string' &&
            typeof tx.transactionNumber === 'string' &&
            typeof tx.totalAmount === 'number' &&
            typeof tx.transactionDate === 'string' &&
            typeof tx.status === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.7: processDashboardData correctly aggregates all metrics', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 30 }),
        fc.array(productArb, { minLength: 0, maxLength: 30 }),
        (transactions, products) => {
          const dateRanges = getDashboardDateRanges();
          const result = processDashboardData(transactions, products, dateRanges);
          
          // Verify structure
          return (
            typeof result.todaySales === 'number' &&
            typeof result.todayTransactions === 'number' &&
            typeof result.yesterdaySales === 'number' &&
            typeof result.weekSales === 'number' &&
            typeof result.lastWeekSales === 'number' &&
            typeof result.lowStockCount === 'number' &&
            Array.isArray(result.recentTransactions) &&
            result.recentTransactions.length <= 5
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.8: Week sales includes today\'s sales', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const dateRanges = getDashboardDateRanges();
          
          // Create transactions specifically for today
          const now = new Date();
          const todayTransactions = transactions.map((tx, i) => {
            if (i % 2 === 0) {
              return { 
                ...tx, 
                transaction_date: now.toISOString(), 
                status: 'completed' as const 
              };
            }
            return tx;
          });
          
          const todayData = calculateSalesTotals(
            todayTransactions,
            dateRanges.todayStart,
            dateRanges.todayEnd
          );
          
          const weekData = calculateSalesTotals(
            todayTransactions,
            dateRanges.weekStart,
            dateRanges.weekEnd
          );
          
          // Week sales should be >= today's sales (since today is part of this week)
          return weekData.totalSales >= todayData.totalSales - 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.9: Empty transactions return zero sales', () => {
    const dateRanges = getDashboardDateRanges();
    const result = processDashboardData([], [], dateRanges);
    
    expect(result.todaySales).toBe(0);
    expect(result.todayTransactions).toBe(0);
    expect(result.yesterdaySales).toBe(0);
    expect(result.weekSales).toBe(0);
    expect(result.lastWeekSales).toBe(0);
    expect(result.lowStockCount).toBe(0);
    expect(result.recentTransactions).toEqual([]);
  });

  it('Property 7.10: Only completed transactions are counted in sales', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 50 }),
        (transactions) => {
          const dateRanges = getDashboardDateRanges();
          
          // Make all transactions pending or cancelled
          const nonCompletedTransactions = transactions.map(tx => ({
            ...tx,
            status: Math.random() > 0.5 ? 'pending' : 'cancelled' as const,
          }));
          
          const result = processDashboardData(nonCompletedTransactions, [], dateRanges);
          
          // All sales should be zero since no completed transactions
          return (
            result.todaySales === 0 &&
            result.todayTransactions === 0 &&
            result.yesterdaySales === 0 &&
            result.weekSales === 0 &&
            result.lastWeekSales === 0 &&
            result.recentTransactions.length === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 6.2, 6.3**
 * 
 * For any report with outlet filter: filtering by specific outlet should return data 
 * for that outlet only, AND filtering by "all outlets" (no filter) should return 
 * combined data from all outlets.
 */
import {
  filterTransactionsByOutletForReport,
  aggregateSalesWithOutletFilter,
} from './reports';

describe('Report Outlet Filtering', () => {
  // Arbitrary for generating mock transactions with outlet
  const transactionWithOutletArb = fc.record({
    id: fc.uuid(),
    total_amount: fc.float({ min: 1, max: 10000, noNaN: true }),
    transaction_date: fc.integer({ min: 1704067200000, max: 1735689600000 })
      .map(ts => new Date(ts).toISOString()),
    outlet_id: fc.option(fc.uuid(), { nil: undefined }),
  });

  it('Property 12.1: Filter by specific outlet returns only transactions from that outlet', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (transactions, targetOutletId) => {
          // Ensure some transactions have the target outlet
          const transactionsWithTarget = transactions.map((tx, i) => 
            i % 3 === 0 ? { ...tx, outlet_id: targetOutletId } : tx
          );

          const filtered = filterTransactionsByOutletForReport(transactionsWithTarget, targetOutletId);

          // All filtered transactions should have the target outlet_id
          return filtered.every(tx => tx.outlet_id === targetOutletId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.2: Filter with no outlet returns all transactions', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const filtered = filterTransactionsByOutletForReport(transactions, undefined);

          // Should return all transactions
          return filtered.length === transactions.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.3: Aggregated sales for specific outlet equals sum of that outlet\'s transactions', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (transactions, targetOutletId) => {
          // Ensure some transactions have the target outlet
          const transactionsWithTarget = transactions.map((tx, i) => 
            i % 3 === 0 ? { ...tx, outlet_id: targetOutletId } : tx
          );

          const result = aggregateSalesWithOutletFilter(transactionsWithTarget, targetOutletId);

          // Calculate expected total manually
          const expectedTotal = transactionsWithTarget
            .filter(tx => tx.outlet_id === targetOutletId)
            .reduce((sum, tx) => sum + tx.total_amount, 0);

          // Allow small floating point tolerance
          return Math.abs(result.totalSales - expectedTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.4: Aggregated sales with no filter equals sum of all transactions', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const result = aggregateSalesWithOutletFilter(transactions, undefined);

          // Calculate expected total manually
          const expectedTotal = transactions.reduce((sum, tx) => sum + tx.total_amount, 0);

          // Allow small floating point tolerance
          return Math.abs(result.totalSales - expectedTotal) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.5: Transaction count for specific outlet matches filtered count', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (transactions, targetOutletId) => {
          // Ensure some transactions have the target outlet
          const transactionsWithTarget = transactions.map((tx, i) => 
            i % 3 === 0 ? { ...tx, outlet_id: targetOutletId } : tx
          );

          const result = aggregateSalesWithOutletFilter(transactionsWithTarget, targetOutletId);

          // Calculate expected count manually
          const expectedCount = transactionsWithTarget.filter(tx => tx.outlet_id === targetOutletId).length;

          return result.transactionCount === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.6: Filter with non-existent outlet returns empty result', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 0, maxLength: 50 }),
        fc.uuid(),
        (transactions, nonExistentOutletId) => {
          // Ensure no transactions have the target outlet
          const transactionsWithoutTarget = transactions.map(tx => ({
            ...tx,
            outlet_id: tx.outlet_id === nonExistentOutletId ? 'different-id' : tx.outlet_id,
          }));

          const result = aggregateSalesWithOutletFilter(transactionsWithoutTarget, nonExistentOutletId);

          return result.totalSales === 0 && result.transactionCount === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.7: Sum of all outlet-specific sales equals total sales (when outlets are distinct)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        (outletIds, baseTransactions) => {
          // Assign transactions to specific outlets
          const transactions = baseTransactions.map((tx, i) => ({
            ...tx,
            outlet_id: outletIds[i % outletIds.length],
          }));

          // Get total sales without filter
          const totalResult = aggregateSalesWithOutletFilter(transactions, undefined);

          // Sum sales from each outlet
          let sumOfOutletSales = 0;
          for (const outletId of outletIds) {
            const outletResult = aggregateSalesWithOutletFilter(transactions, outletId);
            sumOfOutletSales += outletResult.totalSales;
          }

          // Sum of outlet-specific sales should equal total sales
          return Math.abs(sumOfOutletSales - totalResult.totalSales) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.8: Empty transactions array returns zero for any outlet filter', () => {
    const resultWithFilter = aggregateSalesWithOutletFilter([], 'any-outlet-id');
    const resultWithoutFilter = aggregateSalesWithOutletFilter([], undefined);

    expect(resultWithFilter.totalSales).toBe(0);
    expect(resultWithFilter.transactionCount).toBe(0);
    expect(resultWithoutFilter.totalSales).toBe(0);
    expect(resultWithoutFilter.transactionCount).toBe(0);
  });
});
