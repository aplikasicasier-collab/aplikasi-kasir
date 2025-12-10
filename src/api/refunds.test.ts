import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateItemRefundAmount,
  calculateRefund,
  validateRefundCalculation,
  RefundCalculation,
  TransactionItemWithProduct,
} from './refunds';
import { ReturnItem } from './returns';

// ============================================
// Helpers
// ============================================

function createMockTransactionItem(
  overrides: Partial<TransactionItemWithProduct> = {}
): TransactionItemWithProduct {
  return {
    id: 'test-item-id',
    transaction_id: 'test-transaction-id',
    product_id: 'test-product-id',
    quantity: 5,
    unit_price: 10000,
    total_price: 50000,
    discount: 0,
    original_price: 10000,
    discount_amount: 0,
    products: {
      id: 'test-product-id',
      name: 'Test Product',
    },
    ...overrides,
  };
}

// ============================================
// Property 4: Refund Calculation with Discounts
// **Feature: retur-refund, Property 4: Refund Calculation with Discounts**
// **Validates: Requirements 2.1, 2.2**
// ============================================

describe('Property 4: Refund Calculation with Discounts', () => {
  // Arbitrary for generating valid prices (in cents to avoid floating point issues)
  const priceArb = fc.integer({ min: 100, max: 10000000 }); // 1 to 100,000 (in smallest currency unit)
  
  // Arbitrary for generating discount amounts (must be <= price)
  const discountArb = (maxPrice: number) => 
    fc.integer({ min: 0, max: maxPrice });
  
  // Arbitrary for generating quantities
  const quantityArb = fc.integer({ min: 1, max: 100 });

  /**
   * Property 4.1: Refund amount equals (original_price - discount_amount) × quantity
   * For any return item, the refund should preserve the original discount
   */
  it('Property 4.1: Refund amount equals (original_price - discount_amount) × quantity', () => {
    fc.assert(
      fc.property(
        priceArb,
        quantityArb,
        (originalPrice, quantity) => {
          // Generate discount that doesn't exceed price
          return fc.assert(
            fc.property(
              discountArb(originalPrice),
              (discountAmount) => {
                const refund = calculateItemRefundAmount(
                  originalPrice,
                  discountAmount,
                  quantity
                );

                const expectedRefund = (originalPrice - discountAmount) * quantity;
                
                return refund === expectedRefund;
              }
            ),
            { numRuns: 10 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.2: Total refund equals sum of individual item refunds
   */
  it('Property 4.2: Total refund equals sum of individual item refunds', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            product_id: fc.uuid(),
            original_price: priceArb,
            discount_amount: fc.integer({ min: 0, max: 1000 }),
            quantity: quantityArb,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          // Ensure discount doesn't exceed price
          const validItems = items.map(item => ({
            ...item,
            discount_amount: Math.min(item.discount_amount, item.original_price),
          }));

          // Create transaction items
          const transactionItems: TransactionItemWithProduct[] = validItems.map(item => 
            createMockTransactionItem({
              id: item.id,
              product_id: item.product_id,
              original_price: item.original_price,
              discount_amount: item.discount_amount,
              unit_price: item.original_price - item.discount_amount,
              quantity: item.quantity,
            })
          );

          // Create return items
          const returnItems = validItems.map(item => ({
            transaction_item_id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          const result = calculateRefund(returnItems, transactionItems);

          // Calculate expected total
          const expectedTotal = validItems.reduce((sum, item) => {
            return sum + (item.original_price - item.discount_amount) * item.quantity;
          }, 0);

          return result.total_refund === expectedTotal;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.3: Refund without discount equals original_price × quantity
   */
  it('Property 4.3: Refund without discount equals original_price × quantity', () => {
    fc.assert(
      fc.property(
        priceArb,
        quantityArb,
        (originalPrice, quantity) => {
          const refund = calculateItemRefundAmount(originalPrice, 0, quantity);
          const expectedRefund = originalPrice * quantity;
          
          return refund === expectedRefund;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.4: Refund is always non-negative when discount <= original_price
   */
  it('Property 4.4: Refund is always non-negative when discount <= original_price', () => {
    fc.assert(
      fc.property(
        priceArb,
        quantityArb,
        (originalPrice, quantity) => {
          return fc.assert(
            fc.property(
              discountArb(originalPrice),
              (discountAmount) => {
                const refund = calculateItemRefundAmount(
                  originalPrice,
                  discountAmount,
                  quantity
                );
                
                return refund >= 0;
              }
            ),
            { numRuns: 10 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.5: Subtotal equals sum of (original_price × quantity) for all items
   */
  it('Property 4.5: Subtotal equals sum of (original_price × quantity) for all items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            product_id: fc.uuid(),
            original_price: priceArb,
            discount_amount: fc.integer({ min: 0, max: 1000 }),
            quantity: quantityArb,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          const validItems = items.map(item => ({
            ...item,
            discount_amount: Math.min(item.discount_amount, item.original_price),
          }));

          const transactionItems: TransactionItemWithProduct[] = validItems.map(item => 
            createMockTransactionItem({
              id: item.id,
              product_id: item.product_id,
              original_price: item.original_price,
              discount_amount: item.discount_amount,
              unit_price: item.original_price - item.discount_amount,
              quantity: item.quantity,
            })
          );

          const returnItems = validItems.map(item => ({
            transaction_item_id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          const result = calculateRefund(returnItems, transactionItems);

          const expectedSubtotal = validItems.reduce((sum, item) => {
            return sum + item.original_price * item.quantity;
          }, 0);

          return result.subtotal === expectedSubtotal;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.6: Total discount equals sum of (discount_amount × quantity) for all items
   */
  it('Property 4.6: Total discount equals sum of (discount_amount × quantity) for all items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            product_id: fc.uuid(),
            original_price: priceArb,
            discount_amount: fc.integer({ min: 0, max: 1000 }),
            quantity: quantityArb,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          const validItems = items.map(item => ({
            ...item,
            discount_amount: Math.min(item.discount_amount, item.original_price),
          }));

          const transactionItems: TransactionItemWithProduct[] = validItems.map(item => 
            createMockTransactionItem({
              id: item.id,
              product_id: item.product_id,
              original_price: item.original_price,
              discount_amount: item.discount_amount,
              unit_price: item.original_price - item.discount_amount,
              quantity: item.quantity,
            })
          );

          const returnItems = validItems.map(item => ({
            transaction_item_id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          const result = calculateRefund(returnItems, transactionItems);

          const expectedTotalDiscount = validItems.reduce((sum, item) => {
            return sum + item.discount_amount * item.quantity;
          }, 0);

          return result.total_discount === expectedTotalDiscount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.7: total_refund = subtotal - total_discount
   */
  it('Property 4.7: total_refund = subtotal - total_discount', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            product_id: fc.uuid(),
            original_price: priceArb,
            discount_amount: fc.integer({ min: 0, max: 1000 }),
            quantity: quantityArb,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          const validItems = items.map(item => ({
            ...item,
            discount_amount: Math.min(item.discount_amount, item.original_price),
          }));

          const transactionItems: TransactionItemWithProduct[] = validItems.map(item => 
            createMockTransactionItem({
              id: item.id,
              product_id: item.product_id,
              original_price: item.original_price,
              discount_amount: item.discount_amount,
              unit_price: item.original_price - item.discount_amount,
              quantity: item.quantity,
            })
          );

          const returnItems = validItems.map(item => ({
            transaction_item_id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          const result = calculateRefund(returnItems, transactionItems);

          return result.total_refund === result.subtotal - result.total_discount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.8: Empty return items results in zero refund
   */
  it('Property 4.8: Empty return items results in zero refund', () => {
    const result = calculateRefund([], []);
    
    expect(result.items).toHaveLength(0);
    expect(result.subtotal).toBe(0);
    expect(result.total_discount).toBe(0);
    expect(result.total_refund).toBe(0);
  });

  /**
   * Property 4.9: Items not found in transaction are skipped
   */
  it('Property 4.9: Items not found in transaction are skipped', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // non-existent transaction_item_id
        fc.uuid(), // product_id
        quantityArb,
        (itemId, productId, quantity) => {
          const returnItems = [{
            transaction_item_id: itemId,
            product_id: productId,
            quantity,
          }];

          // Empty transaction items - nothing to match
          const transactionItems: TransactionItemWithProduct[] = [];

          const result = calculateRefund(returnItems, transactionItems);

          // Should have no items and zero totals
          return result.items.length === 0 &&
                 result.subtotal === 0 &&
                 result.total_discount === 0 &&
                 result.total_refund === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Unit Tests for Refund Calculation
// ============================================

describe('Refund Calculation Unit Tests', () => {
  it('calculates single item refund correctly', () => {
    const transactionItems: TransactionItemWithProduct[] = [
      createMockTransactionItem({
        id: 'item-1',
        product_id: 'prod-1',
        original_price: 50000,
        discount_amount: 5000,
        quantity: 2,
      }),
    ];

    const returnItems = [{
      transaction_item_id: 'item-1',
      product_id: 'prod-1',
      quantity: 1,
    }];

    const result = calculateRefund(returnItems, transactionItems);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].original_price).toBe(50000);
    expect(result.items[0].discount_amount).toBe(5000);
    expect(result.items[0].refund_amount).toBe(45000); // (50000 - 5000) * 1
    expect(result.subtotal).toBe(50000);
    expect(result.total_discount).toBe(5000);
    expect(result.total_refund).toBe(45000);
  });

  it('calculates multiple items refund correctly', () => {
    const transactionItems: TransactionItemWithProduct[] = [
      createMockTransactionItem({
        id: 'item-1',
        product_id: 'prod-1',
        original_price: 10000,
        discount_amount: 1000,
        quantity: 5,
        products: { id: 'prod-1', name: 'Product A' },
      }),
      createMockTransactionItem({
        id: 'item-2',
        product_id: 'prod-2',
        original_price: 20000,
        discount_amount: 2000,
        quantity: 3,
        products: { id: 'prod-2', name: 'Product B' },
      }),
    ];

    const returnItems = [
      { transaction_item_id: 'item-1', product_id: 'prod-1', quantity: 2 },
      { transaction_item_id: 'item-2', product_id: 'prod-2', quantity: 1 },
    ];

    const result = calculateRefund(returnItems, transactionItems);

    expect(result.items).toHaveLength(2);
    
    // Item 1: (10000 - 1000) * 2 = 18000
    expect(result.items[0].refund_amount).toBe(18000);
    
    // Item 2: (20000 - 2000) * 1 = 18000
    expect(result.items[1].refund_amount).toBe(18000);
    
    // Subtotal: 10000*2 + 20000*1 = 40000
    expect(result.subtotal).toBe(40000);
    
    // Total discount: 1000*2 + 2000*1 = 4000
    expect(result.total_discount).toBe(4000);
    
    // Total refund: 18000 + 18000 = 36000
    expect(result.total_refund).toBe(36000);
  });

  it('handles items without discount correctly', () => {
    const transactionItems: TransactionItemWithProduct[] = [
      createMockTransactionItem({
        id: 'item-1',
        product_id: 'prod-1',
        original_price: 25000,
        discount_amount: 0,
        quantity: 4,
      }),
    ];

    const returnItems = [{
      transaction_item_id: 'item-1',
      product_id: 'prod-1',
      quantity: 2,
    }];

    const result = calculateRefund(returnItems, transactionItems);

    expect(result.items[0].refund_amount).toBe(50000); // 25000 * 2
    expect(result.total_discount).toBe(0);
    expect(result.total_refund).toBe(50000);
  });

  it('uses unit_price when original_price is not available', () => {
    const transactionItems: TransactionItemWithProduct[] = [
      {
        id: 'item-1',
        transaction_id: 'tx-1',
        product_id: 'prod-1',
        quantity: 3,
        unit_price: 15000,
        total_price: 45000,
        discount: 0,
        // original_price is undefined
        products: { id: 'prod-1', name: 'Product' },
      } as TransactionItemWithProduct,
    ];

    const returnItems = [{
      transaction_item_id: 'item-1',
      product_id: 'prod-1',
      quantity: 1,
    }];

    const result = calculateRefund(returnItems, transactionItems);

    expect(result.items[0].original_price).toBe(15000);
    expect(result.items[0].refund_amount).toBe(15000);
  });
});

// ============================================
// Unit Tests for Refund Validation
// ============================================

describe('Refund Validation', () => {
  it('validates matching refund totals', () => {
    const returnItems: ReturnItem[] = [
      {
        id: '1',
        return_id: 'ret-1',
        transaction_item_id: 'ti-1',
        product_id: 'p-1',
        quantity: 2,
        original_price: 10000,
        discount_amount: 1000,
        refund_amount: 18000,
        reason: 'damaged',
        reason_detail: null,
        is_damaged: true,
        is_resellable: false,
        created_at: new Date().toISOString(),
      },
    ];

    const result = validateRefundCalculation(returnItems, 18000);
    
    expect(result.valid).toBe(true);
    expect(result.calculatedTotal).toBe(18000);
    expect(result.difference).toBe(0);
  });

  it('detects mismatched refund totals', () => {
    const returnItems: ReturnItem[] = [
      {
        id: '1',
        return_id: 'ret-1',
        transaction_item_id: 'ti-1',
        product_id: 'p-1',
        quantity: 2,
        original_price: 10000,
        discount_amount: 1000,
        refund_amount: 18000,
        reason: 'damaged',
        reason_detail: null,
        is_damaged: true,
        is_resellable: false,
        created_at: new Date().toISOString(),
      },
    ];

    const result = validateRefundCalculation(returnItems, 20000);
    
    expect(result.valid).toBe(false);
    expect(result.calculatedTotal).toBe(18000);
    expect(result.difference).toBe(2000);
  });
});
