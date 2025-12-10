import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateStockAvailabilityLocal,
  calculateStockChange,
  simulateStockReduction,
  filterLowStockProducts,
  calculateSuggestedOrderQuantity,
} from './stock';
import { CartItem, Product } from '@/types';

// Helper to create a mock product
function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-id',
    name: 'Test Product',
    price: 10000,
    stock_quantity: 100,
    min_stock: 10,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * **Feature: kasir-checkout, Property 3: Stock Validation Prevents Overselling**
 * **Validates: Requirements 2.3**
 * 
 * For any cart where any item's requested quantity exceeds the product's available stock,
 * the checkout operation should be rejected and return a validation error.
 */
describe('Stock Validation Prevents Overselling', () => {
  // Arbitrary for generating products with stock
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    price: fc.integer({ min: 100, max: 1000000 }).map(n => n / 100),
    stock_quantity: fc.integer({ min: 0, max: 1000 }),
    min_stock: fc.integer({ min: 1, max: 100 }),
    is_active: fc.constant(true),
    created_at: fc.constant(new Date().toISOString()),
    updated_at: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<Product>;

  it('Property 3.1: Validation fails when requested quantity exceeds available stock', () => {
    fc.assert(
      fc.property(
        productArb,
        fc.integer({ min: 1, max: 100 }), // extra quantity beyond stock
        (product, extraQty) => {
          const requestedQuantity = product.stock_quantity + extraQty;
          
          const items: CartItem[] = [{
            product,
            quantity: requestedQuantity,
            discount: 0,
          }];

          const stockMap = new Map([[product.id, product.stock_quantity]]);
          const result = validateStockAvailabilityLocal(items, stockMap);

          // Should be invalid
          if (result.valid) return false;
          
          // Should have exactly one error
          if (result.errors.length !== 1) return false;
          
          // Error should reference the correct product
          return result.errors[0].productId === product.id;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.2: Validation passes when requested quantity is within available stock', () => {
    fc.assert(
      fc.property(
        productArb.filter(p => p.stock_quantity > 0),
        (product) => {
          // Request quantity within stock
          const requestedQuantity = Math.min(product.stock_quantity, Math.max(1, Math.floor(product.stock_quantity * 0.5)));
          
          const items: CartItem[] = [{
            product,
            quantity: requestedQuantity,
            discount: 0,
          }];

          const stockMap = new Map([[product.id, product.stock_quantity]]);
          const result = validateStockAvailabilityLocal(items, stockMap);

          return result.valid && result.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.3: Validation fails for product not in stock map', () => {
    fc.assert(
      fc.property(
        productArb,
        fc.integer({ min: 1, max: 10 }),
        (product, quantity) => {
          const items: CartItem[] = [{
            product,
            quantity,
            discount: 0,
          }];

          // Empty stock map - product doesn't exist
          const stockMap = new Map<string, number>();
          const result = validateStockAvailabilityLocal(items, stockMap);

          return !result.valid && result.errors.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.4: Multiple items validation - all must have sufficient stock', () => {
    fc.assert(
      fc.property(
        fc.array(productArb.filter(p => p.stock_quantity > 0), { minLength: 2, maxLength: 5 }),
        (products) => {
          // Ensure unique product IDs
          const uniqueProducts = products.filter((p, i, arr) => 
            arr.findIndex(x => x.id === p.id) === i
          );
          
          if (uniqueProducts.length < 2) return true; // Skip if not enough unique products

          const items: CartItem[] = uniqueProducts.map(p => ({
            product: p,
            quantity: Math.max(1, Math.floor(p.stock_quantity * 0.5)),
            discount: 0,
          }));

          const stockMap = new Map(uniqueProducts.map(p => [p.id, p.stock_quantity]));
          const result = validateStockAvailabilityLocal(items, stockMap);

          return result.valid;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.5: Error message contains product name and quantities', () => {
    fc.assert(
      fc.property(
        productArb.filter(p => p.stock_quantity >= 0 && p.stock_quantity < 100),
        fc.integer({ min: 1, max: 50 }),
        (product, extraQty) => {
          const requestedQuantity = product.stock_quantity + extraQty;
          
          const items: CartItem[] = [{
            product,
            quantity: requestedQuantity,
            discount: 0,
          }];

          const stockMap = new Map([[product.id, product.stock_quantity]]);
          const result = validateStockAvailabilityLocal(items, stockMap);

          if (result.valid) return false;

          const error = result.errors[0];
          return (
            error.productName === product.name &&
            error.requestedQuantity === requestedQuantity &&
            error.availableStock === product.stock_quantity
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: kasir-checkout, Property 2: Stock Reduction Consistency**
 * **Validates: Requirements 2.1, 2.2**
 * 
 * For any completed transaction, the stock quantity of each sold product should decrease
 * by exactly the quantity purchased, AND a stock_movement record with type 'out' should
 * be created for each product with the correct quantity.
 */
describe('Stock Reduction Consistency', () => {
  // Arbitrary for generating products with stock
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    price: fc.integer({ min: 100, max: 1000000 }).map(n => n / 100),
    stock_quantity: fc.integer({ min: 10, max: 1000 }),
    min_stock: fc.integer({ min: 1, max: 100 }),
    is_active: fc.constant(true),
    created_at: fc.constant(new Date().toISOString()),
    updated_at: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<Product>;

  it('Property 2.1: Stock decreases by exactly the quantity purchased', () => {
    fc.assert(
      fc.property(
        productArb,
        fc.integer({ min: 1, max: 10 }),
        (product, quantity) => {
          // Ensure quantity doesn't exceed stock
          const purchaseQty = Math.min(quantity, product.stock_quantity);
          
          const items: CartItem[] = [{
            product,
            quantity: purchaseQty,
            discount: 0,
          }];

          const initialStock = new Map([[product.id, product.stock_quantity]]);
          const newStock = simulateStockReduction(initialStock, items);

          const expectedStock = product.stock_quantity - purchaseQty;
          return newStock.get(product.id) === expectedStock;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.2: Multiple items reduce stock independently', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 2, maxLength: 5 }),
        (products) => {
          // Ensure unique product IDs
          const uniqueProducts = products.filter((p, i, arr) => 
            arr.findIndex(x => x.id === p.id) === i
          );
          
          if (uniqueProducts.length < 2) return true;

          const items: CartItem[] = uniqueProducts.map(p => ({
            product: p,
            quantity: Math.min(5, p.stock_quantity),
            discount: 0,
          }));

          const initialStock = new Map(uniqueProducts.map(p => [p.id, p.stock_quantity]));
          const newStock = simulateStockReduction(initialStock, items);

          // Each product's stock should decrease by its purchased quantity
          return items.every(item => {
            const initial = initialStock.get(item.product.id) ?? 0;
            const final = newStock.get(item.product.id) ?? 0;
            return final === initial - item.quantity;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.3: calculateStockChange returns negative for "out" movements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (quantity) => {
          const change = calculateStockChange(quantity, 'out');
          return change === -quantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.4: calculateStockChange returns positive for "in" movements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (quantity) => {
          const change = calculateStockChange(quantity, 'in');
          return change === quantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.5: calculateStockChange returns positive for "adjustment" movements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (quantity) => {
          const change = calculateStockChange(quantity, 'adjustment');
          return change === quantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.6: Total stock reduction equals sum of all item quantities', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 10 }),
        (products) => {
          // Ensure unique product IDs
          const uniqueProducts = products.filter((p, i, arr) => 
            arr.findIndex(x => x.id === p.id) === i
          );

          const items: CartItem[] = uniqueProducts.map(p => ({
            product: p,
            quantity: Math.min(5, p.stock_quantity),
            discount: 0,
          }));

          const initialStock = new Map(uniqueProducts.map(p => [p.id, p.stock_quantity]));
          const newStock = simulateStockReduction(initialStock, items);

          // Calculate total reduction
          let totalInitial = 0;
          let totalFinal = 0;
          let totalPurchased = 0;

          for (const item of items) {
            totalInitial += initialStock.get(item.product.id) ?? 0;
            totalFinal += newStock.get(item.product.id) ?? 0;
            totalPurchased += item.quantity;
          }

          return totalInitial - totalFinal === totalPurchased;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests
describe('Stock Functions Unit Tests', () => {
  it('validateStockAvailabilityLocal returns valid for empty cart', () => {
    const result = validateStockAvailabilityLocal([], new Map());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('calculateStockChange handles all movement types', () => {
    expect(calculateStockChange(10, 'in')).toBe(10);
    expect(calculateStockChange(10, 'out')).toBe(-10);
    expect(calculateStockChange(10, 'adjustment')).toBe(10);
  });

  it('simulateStockReduction handles empty items', () => {
    const stock = new Map([['p1', 100]]);
    const result = simulateStockReduction(stock, []);
    expect(result.get('p1')).toBe(100);
  });

  it('simulateStockReduction can result in negative stock', () => {
    const product = createMockProduct({ id: 'p1', stock_quantity: 5 });
    const items: CartItem[] = [{ product, quantity: 10, discount: 0 }];
    const stock = new Map([['p1', 5]]);
    
    const result = simulateStockReduction(stock, items);
    expect(result.get('p1')).toBe(-5);
  });
});


/**
 * **Feature: purchase-order, Property 8: Low Stock Query**
 * **Validates: Requirements 6.1, 6.3**
 * 
 * For any low stock query, all returned products should have stock_quantity less than
 * or equal to min_stock, AND each product should include name, current_stock, min_stock,
 * and suggested_order_quantity.
 */
describe('Low Stock Query', () => {
  // Arbitrary for generating products with various stock levels
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    price: fc.integer({ min: 100, max: 1000000 }),
    stock_quantity: fc.integer({ min: 0, max: 100 }),
    min_stock: fc.integer({ min: 1, max: 50 }),
    is_active: fc.boolean(),
    created_at: fc.constant(new Date().toISOString()),
    updated_at: fc.constant(new Date().toISOString()),
    category_id: fc.option(fc.uuid(), { nil: undefined }),
    supplier_id: fc.option(fc.uuid(), { nil: undefined }),
  }) as fc.Arbitrary<Product>;

  it('Property 8.1: All returned products have stock_quantity <= min_stock', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 20 }),
        (products) => {
          const lowStockProducts = filterLowStockProducts(products);
          
          // All returned products should have stock <= min_stock
          return lowStockProducts.every(p => p.current_stock <= p.min_stock);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.2: All returned products are active', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 20 }),
        (products) => {
          const lowStockProducts = filterLowStockProducts(products);
          
          // Verify all returned products came from active products
          return lowStockProducts.every(lsp => {
            const original = products.find(p => p.id === lsp.id);
            return original?.is_active === true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.3: Each returned product includes required fields', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 1, maxLength: 20 }),
        (products) => {
          const lowStockProducts = filterLowStockProducts(products);
          
          // Each product should have all required fields
          return lowStockProducts.every(p => 
            typeof p.id === 'string' &&
            typeof p.name === 'string' &&
            typeof p.current_stock === 'number' &&
            typeof p.min_stock === 'number' &&
            typeof p.suggested_order_quantity === 'number'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.4: Suggested order quantity is always positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // current stock
        fc.integer({ min: 1, max: 50 }),  // min stock
        (currentStock, minStock) => {
          const suggested = calculateSuggestedOrderQuantity(currentStock, minStock);
          return suggested >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.5: Suggested order quantity brings stock to at least 2x min_stock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // current stock
        fc.integer({ min: 1, max: 50 }),  // min stock
        (currentStock, minStock) => {
          const suggested = calculateSuggestedOrderQuantity(currentStock, minStock);
          const newStock = currentStock + suggested;
          
          // After ordering suggested quantity, stock should be at least 2x min_stock
          // (or at least current + 1 if already above target)
          return newStock >= minStock * 2 || suggested === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.6: Products with stock > min_stock are not included', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 20 }),
        (products) => {
          const lowStockProducts = filterLowStockProducts(products);
          const lowStockIds = new Set(lowStockProducts.map(p => p.id));
          
          // Products with stock > min_stock should NOT be in the result
          return products.every(p => {
            if (p.stock_quantity > p.min_stock) {
              return !lowStockIds.has(p.id);
            }
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.7: Inactive products are not included', () => {
    fc.assert(
      fc.property(
        fc.array(productArb, { minLength: 0, maxLength: 20 }),
        (products) => {
          const lowStockProducts = filterLowStockProducts(products);
          const lowStockIds = new Set(lowStockProducts.map(p => p.id));
          
          // Inactive products should NOT be in the result
          return products.every(p => {
            if (!p.is_active) {
              return !lowStockIds.has(p.id);
            }
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for low stock functions
describe('Low Stock Functions Unit Tests', () => {
  it('filterLowStockProducts returns empty array for empty input', () => {
    const result = filterLowStockProducts([]);
    expect(result).toEqual([]);
  });

  it('filterLowStockProducts filters correctly', () => {
    const products: Product[] = [
      createMockProduct({ id: 'p1', stock_quantity: 5, min_stock: 10, is_active: true }),
      createMockProduct({ id: 'p2', stock_quantity: 15, min_stock: 10, is_active: true }),
      createMockProduct({ id: 'p3', stock_quantity: 10, min_stock: 10, is_active: true }),
      createMockProduct({ id: 'p4', stock_quantity: 5, min_stock: 10, is_active: false }),
    ];

    const result = filterLowStockProducts(products);
    
    expect(result.length).toBe(2);
    expect(result.map(p => p.id)).toContain('p1');
    expect(result.map(p => p.id)).toContain('p3');
    expect(result.map(p => p.id)).not.toContain('p2'); // stock > min_stock
    expect(result.map(p => p.id)).not.toContain('p4'); // inactive
  });

  it('calculateSuggestedOrderQuantity returns correct value', () => {
    // current=5, min=10, target=20, suggested=15
    expect(calculateSuggestedOrderQuantity(5, 10)).toBe(15);
    
    // current=0, min=10, target=20, suggested=20
    expect(calculateSuggestedOrderQuantity(0, 10)).toBe(20);
    
    // current=10, min=10, target=20, suggested=10
    expect(calculateSuggestedOrderQuantity(10, 10)).toBe(10);
  });

  it('calculateSuggestedOrderQuantity returns at least 1', () => {
    // Even if current stock is above target, return at least 1
    expect(calculateSuggestedOrderQuantity(100, 10)).toBe(1);
  });

  it('filterLowStockProducts includes all required fields', () => {
    const products: Product[] = [
      createMockProduct({ 
        id: 'p1', 
        name: 'Test Product',
        stock_quantity: 5, 
        min_stock: 10, 
        is_active: true,
        category_id: 'cat1',
        supplier_id: 'sup1',
      }),
    ];

    const result = filterLowStockProducts(products);
    
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      id: 'p1',
      name: 'Test Product',
      current_stock: 5,
      min_stock: 10,
      suggested_order_quantity: 15,
      category_id: 'cat1',
      supplier_id: 'sup1',
    });
  });
});
