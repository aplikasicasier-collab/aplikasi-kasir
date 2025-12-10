import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  updateOutletStockLocal,
  getOutletStockLocal,
  initializeProductStockLocal,
  adjustOutletStockLocal,
} from './outletStock';

/**
 * **Feature: multi-outlet, Property 6: Outlet-Scoped Stock**
 * **Validates: Requirements 3.1, 3.2**
 *
 * For any outlet and product, the stock quantity should be independent per outlet,
 * AND updating stock for one outlet should not affect stock in other outlets.
 */
describe('Outlet-Scoped Stock', () => {
  // Arbitrary for generating valid UUIDs
  const uuidArb = fc.uuid();

  // Arbitrary for generating valid stock quantities
  const quantityArb = fc.integer({ min: 0, max: 10000 });

  it('Property 6.1: Stock is independent per outlet - updating one outlet does not affect others', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        quantityArb,
        quantityArb,
        (outlet1Id, outlet2Id, productId, quantity1, quantity2) => {
          // Skip if outlets are the same
          if (outlet1Id === outlet2Id) return true;

          // Start with empty stock map
          let stockMap = new Map<string, Map<string, number>>();

          // Set stock for outlet 1
          stockMap = updateOutletStockLocal(stockMap, outlet1Id, productId, quantity1);

          // Set stock for outlet 2
          stockMap = updateOutletStockLocal(stockMap, outlet2Id, productId, quantity2);

          // Verify each outlet has its own independent stock
          const stock1 = getOutletStockLocal(stockMap, outlet1Id, productId);
          const stock2 = getOutletStockLocal(stockMap, outlet2Id, productId);

          return stock1 === quantity1 && stock2 === quantity2;
        }
      ),
      { numRuns: 100 }
    );
  });


  it('Property 6.2: Updating stock for one outlet preserves stock in other outlets', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 2, maxLength: 10 }),
        uuidArb,
        fc.array(quantityArb, { minLength: 2, maxLength: 10 }),
        (outletIds, productId, quantities) => {
          // Ensure unique outlet IDs
          const uniqueOutletIds = [...new Set(outletIds)];
          if (uniqueOutletIds.length < 2) return true;

          // Initialize stock for all outlets
          let stockMap = new Map<string, Map<string, number>>();
          uniqueOutletIds.forEach((outletId, index) => {
            const qty = quantities[index % quantities.length];
            stockMap = updateOutletStockLocal(stockMap, outletId, productId, qty);
          });

          // Store original values
          const originalStocks = uniqueOutletIds.map(outletId =>
            getOutletStockLocal(stockMap, outletId, productId)
          );

          // Update stock for first outlet only
          const newQuantity = 9999;
          stockMap = updateOutletStockLocal(stockMap, uniqueOutletIds[0], productId, newQuantity);

          // Verify first outlet was updated
          const updatedStock = getOutletStockLocal(stockMap, uniqueOutletIds[0], productId);
          if (updatedStock !== newQuantity) return false;

          // Verify other outlets remain unchanged
          for (let i = 1; i < uniqueOutletIds.length; i++) {
            const currentStock = getOutletStockLocal(stockMap, uniqueOutletIds[i], productId);
            if (currentStock !== originalStocks[i]) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.3: Different products have independent stock within same outlet', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        quantityArb,
        quantityArb,
        (outletId, product1Id, product2Id, quantity1, quantity2) => {
          // Skip if products are the same
          if (product1Id === product2Id) return true;

          let stockMap = new Map<string, Map<string, number>>();

          // Set stock for product 1
          stockMap = updateOutletStockLocal(stockMap, outletId, product1Id, quantity1);

          // Set stock for product 2
          stockMap = updateOutletStockLocal(stockMap, outletId, product2Id, quantity2);

          // Verify each product has independent stock
          const stock1 = getOutletStockLocal(stockMap, outletId, product1Id);
          const stock2 = getOutletStockLocal(stockMap, outletId, product2Id);

          return stock1 === quantity1 && stock2 === quantity2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.4: Stock adjustment only affects target outlet', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        quantityArb,
        quantityArb,
        fc.integer({ min: -100, max: 100 }),
        (outlet1Id, outlet2Id, productId, initialQty1, initialQty2, adjustment) => {
          // Skip if outlets are the same
          if (outlet1Id === outlet2Id) return true;

          // Initialize stock
          let stockMap = new Map<string, Map<string, number>>();
          stockMap = updateOutletStockLocal(stockMap, outlet1Id, productId, initialQty1);
          stockMap = updateOutletStockLocal(stockMap, outlet2Id, productId, initialQty2);

          // Adjust stock for outlet 1 (only if result would be non-negative)
          const result = adjustOutletStockLocal(stockMap, outlet1Id, productId, adjustment);

          if (result.success) {
            // Verify outlet 2 stock is unchanged
            const stock2 = getOutletStockLocal(result.newMap, outlet2Id, productId);
            return stock2 === initialQty2;
          }

          // If adjustment failed (negative result), original map should be unchanged
          return result.newMap === stockMap;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 7: Product Stock Initialization**
 * **Validates: Requirements 3.3**
 *
 * For any newly created product, stock should be initialized to zero for all active outlets.
 */
describe('Product Stock Initialization', () => {
  // Arbitrary for generating valid UUIDs
  const uuidArb = fc.uuid();

  it('Property 7.1: New product has zero stock for all outlets', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 1, maxLength: 20 }),
        uuidArb,
        (outletIds, productId) => {
          // Ensure unique outlet IDs
          const uniqueOutletIds = [...new Set(outletIds)];

          // Start with empty stock map
          let stockMap = new Map<string, Map<string, number>>();

          // Initialize product stock for all outlets
          stockMap = initializeProductStockLocal(stockMap, uniqueOutletIds, productId);

          // Verify all outlets have zero stock for the product
          for (const outletId of uniqueOutletIds) {
            const stock = getOutletStockLocal(stockMap, outletId, productId);
            if (stock !== 0) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Product initialization does not overwrite existing stock', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 2, maxLength: 10 }),
        uuidArb,
        fc.integer({ min: 1, max: 1000 }),
        (outletIds, productId, existingQuantity) => {
          // Ensure unique outlet IDs
          const uniqueOutletIds = [...new Set(outletIds)];
          if (uniqueOutletIds.length < 2) return true;

          // Start with empty stock map
          let stockMap = new Map<string, Map<string, number>>();

          // Set existing stock for first outlet
          stockMap = updateOutletStockLocal(
            stockMap,
            uniqueOutletIds[0],
            productId,
            existingQuantity
          );

          // Initialize product stock for all outlets
          stockMap = initializeProductStockLocal(stockMap, uniqueOutletIds, productId);

          // Verify first outlet still has existing stock (not overwritten)
          const stock1 = getOutletStockLocal(stockMap, uniqueOutletIds[0], productId);
          if (stock1 !== existingQuantity) return false;

          // Verify other outlets have zero stock
          for (let i = 1; i < uniqueOutletIds.length; i++) {
            const stock = getOutletStockLocal(stockMap, uniqueOutletIds[i], productId);
            if (stock !== 0) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Multiple products can be initialized independently', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
        fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
        (outletIds, productIds) => {
          // Ensure unique IDs
          const uniqueOutletIds = [...new Set(outletIds)];
          const uniqueProductIds = [...new Set(productIds)];
          if (uniqueProductIds.length < 2) return true;

          let stockMap = new Map<string, Map<string, number>>();

          // Initialize all products
          for (const productId of uniqueProductIds) {
            stockMap = initializeProductStockLocal(stockMap, uniqueOutletIds, productId);
          }

          // Verify all products have zero stock for all outlets
          for (const outletId of uniqueOutletIds) {
            for (const productId of uniqueProductIds) {
              const stock = getOutletStockLocal(stockMap, outletId, productId);
              if (stock !== 0) return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Unit tests for edge cases and basic functionality
describe('Outlet Stock Unit Tests', () => {
  it('returns 0 for non-existent outlet/product combination', () => {
    const stockMap = new Map<string, Map<string, number>>();
    const stock = getOutletStockLocal(stockMap, 'non-existent-outlet', 'non-existent-product');
    expect(stock).toBe(0);
  });

  it('correctly updates stock quantity', () => {
    let stockMap = new Map<string, Map<string, number>>();
    const outletId = 'outlet-1';
    const productId = 'product-1';

    stockMap = updateOutletStockLocal(stockMap, outletId, productId, 100);
    expect(getOutletStockLocal(stockMap, outletId, productId)).toBe(100);

    stockMap = updateOutletStockLocal(stockMap, outletId, productId, 50);
    expect(getOutletStockLocal(stockMap, outletId, productId)).toBe(50);
  });

  it('adjustment fails when result would be negative', () => {
    let stockMap = new Map<string, Map<string, number>>();
    const outletId = 'outlet-1';
    const productId = 'product-1';

    stockMap = updateOutletStockLocal(stockMap, outletId, productId, 10);

    const result = adjustOutletStockLocal(stockMap, outletId, productId, -20);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Stok tidak mencukupi untuk operasi ini');
  });

  it('adjustment succeeds when result is non-negative', () => {
    let stockMap = new Map<string, Map<string, number>>();
    const outletId = 'outlet-1';
    const productId = 'product-1';

    stockMap = updateOutletStockLocal(stockMap, outletId, productId, 100);

    const result = adjustOutletStockLocal(stockMap, outletId, productId, -50);
    expect(result.success).toBe(true);
    expect(getOutletStockLocal(result.newMap, outletId, productId)).toBe(50);
  });

  it('adjustment to zero is allowed', () => {
    let stockMap = new Map<string, Map<string, number>>();
    const outletId = 'outlet-1';
    const productId = 'product-1';

    stockMap = updateOutletStockLocal(stockMap, outletId, productId, 100);

    const result = adjustOutletStockLocal(stockMap, outletId, productId, -100);
    expect(result.success).toBe(true);
    expect(getOutletStockLocal(result.newMap, outletId, productId)).toBe(0);
  });
});
