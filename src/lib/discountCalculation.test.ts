import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculatePercentageDiscount,
  calculateNominalDiscount,
  calculateDiscountedPrice,
  getApplicableDiscount,
  calculateCartWithDiscounts,
  checkMinimumPurchase,
  Discount,
  Promo,
  DiscountType,
} from './discountCalculation';
import { CartItem, Product } from '@/types';

// ============================================
// Helpers
// ============================================

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

function createMockDiscount(overrides: Partial<Discount> = {}): Discount {
  return {
    id: 'discount-1',
    product_id: 'test-id',
    discount_type: 'percentage',
    discount_value: 10,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockPromo(overrides: Partial<Promo> = {}): Promo {
  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
  const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
  
  return {
    id: 'promo-1',
    name: 'Test Promo',
    description: null,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    discount_type: 'percentage',
    discount_value: 15,
    min_purchase: null,
    is_active: true,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}


// ============================================
// Property 7: Discount Calculation Accuracy
// **Feature: diskon-promo, Property 7: Discount Calculation Accuracy**
// **Validates: Requirements 4.3, 4.4**
// ============================================

describe('Property 7: Discount Calculation Accuracy', () => {
  /**
   * Property 7.1: Percentage discount formula
   * For any price and percentage, final_price = price × (1 - percentage/100)
   * and discount_amount = price - final_price
   */
  it('Property 7.1: Percentage discount calculates final_price = price × (1 - percentage/100)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000000 }), // price in cents to avoid floating point issues
        fc.integer({ min: 1, max: 100 }),        // percentage
        (price, percentage) => {
          const result = calculatePercentageDiscount(price, percentage);
          
          // Verify formula: final_price = price × (1 - percentage/100)
          const expectedFinalPrice = price - Math.round(price * (percentage / 100));
          
          return (
            result.originalPrice === price &&
            result.finalPrice === expectedFinalPrice &&
            result.discountAmount === price - result.finalPrice &&
            result.discountType === 'percentage' &&
            result.discountValue === percentage
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Nominal discount formula
   * For any price and nominal, final_price = price - nominal_value
   * and discount_amount = price - final_price
   */
  it('Property 7.2: Nominal discount calculates final_price = price - nominal_value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }), // price
        fc.integer({ min: 1, max: 999 }),          // nominal (less than min price)
        (price, nominal) => {
          // Ensure nominal is less than price
          const validNominal = Math.min(nominal, price - 1);
          const result = calculateNominalDiscount(price, validNominal);
          
          // Verify formula: final_price = price - nominal_value
          const expectedFinalPrice = price - validNominal;
          
          return (
            result.originalPrice === price &&
            result.finalPrice === expectedFinalPrice &&
            result.discountAmount === validNominal &&
            result.discountType === 'nominal' &&
            result.discountValue === validNominal
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Discount amount invariant
   * For any discount calculation, discount_amount = original_price - final_price
   */
  it('Property 7.3: Discount amount equals original_price - final_price', () => {
    const discountTypeArb = fc.constantFrom<DiscountType>('percentage', 'nominal');
    
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }), // price
        discountTypeArb,
        fc.integer({ min: 1, max: 100 }),         // value (percentage or nominal factor)
        (price, discountType, value) => {
          let result;
          if (discountType === 'percentage') {
            result = calculatePercentageDiscount(price, value);
          } else {
            // For nominal, ensure value doesn't exceed price
            const nominalValue = Math.min(value * 100, price - 1);
            result = calculateNominalDiscount(price, nominalValue);
          }
          
          // Invariant: discountAmount = originalPrice - finalPrice
          return result.discountAmount === result.originalPrice - result.finalPrice;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Final price is non-negative
   * For any discount calculation, final_price >= 0
   */
  it('Property 7.4: Final price is always non-negative', () => {
    const discountTypeArb = fc.constantFrom<DiscountType>('percentage', 'nominal');
    
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }),
        discountTypeArb,
        fc.integer({ min: 0, max: 10000000 }),
        (price, discountType, value) => {
          let result;
          if (discountType === 'percentage') {
            result = calculatePercentageDiscount(price, value);
          } else {
            result = calculateNominalDiscount(price, value);
          }
          
          return result.finalPrice >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: calculateDiscountedPrice delegates correctly
   */
  it('Property 7.5: calculateDiscountedPrice delegates to correct function based on type', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }),
        fc.integer({ min: 1, max: 100 }),
        (price, value) => {
          const percentageDiscount = createMockDiscount({
            discount_type: 'percentage',
            discount_value: value,
          });
          
          const nominalDiscount = createMockDiscount({
            discount_type: 'nominal',
            discount_value: Math.min(value * 100, price - 1),
          });
          
          const percentageResult = calculateDiscountedPrice(price, percentageDiscount);
          const nominalResult = calculateDiscountedPrice(price, nominalDiscount);
          
          const expectedPercentage = calculatePercentageDiscount(price, value);
          const expectedNominal = calculateNominalDiscount(price, nominalDiscount.discount_value);
          
          return (
            percentageResult.finalPrice === expectedPercentage.finalPrice &&
            nominalResult.finalPrice === expectedNominal.finalPrice
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// Property 8: Cart Total with Discounts
// **Feature: diskon-promo, Property 8: Cart Total with Discounts**
// **Validates: Requirements 4.2**
// ============================================

describe('Property 8: Cart Total with Discounts', () => {
  /**
   * Property 8.1: Cart total equals sum of (quantity × discounted_price)
   * For any cart with discounted items, total = Σ(quantity × finalPrice)
   */
  it('Property 8.1: Cart total equals sum of (quantity × discounted_price) for all items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            productId: fc.uuid(),
            price: fc.integer({ min: 1000, max: 1000000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            productId: fc.uuid(),
            discountType: fc.constantFrom<DiscountType>('percentage', 'nominal'),
            discountValue: fc.integer({ min: 1, max: 50 }),
          }),
          { minLength: 0, maxLength: 3 }
        ),
        (cartData, discountData) => {
          // Create cart items
          const items: CartItem[] = cartData.map(data => ({
            product: createMockProduct({
              id: data.productId,
              price: data.price,
            }),
            quantity: data.quantity,
            discount: 0,
          }));

          // Create discounts (some may match products, some may not)
          const discounts: Discount[] = discountData.map((data, idx) => {
            const discountValue = data.discountType === 'nominal'
              ? Math.min(data.discountValue * 100, 999) // nominal in rupiah
              : data.discountValue; // percentage
            
            return createMockDiscount({
              id: `discount-${idx}`,
              product_id: data.productId,
              discount_type: data.discountType,
              discount_value: discountValue,
            });
          });

          const result = calculateCartWithDiscounts(items, discounts, []);

          // Calculate expected total manually
          let expectedTotal = 0;
          for (const item of result.items) {
            expectedTotal += item.finalPrice * item.quantity;
          }

          return result.total === expectedTotal;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: Total discount equals subtotal - total
   */
  it('Property 8.2: Total discount equals subtotal minus total', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.integer({ min: 1000, max: 1000000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (cartData) => {
          const productId = 'product-with-discount';
          
          const items: CartItem[] = cartData.map((data, idx) => ({
            product: createMockProduct({
              id: idx === 0 ? productId : `product-${idx}`,
              price: data.price,
            }),
            quantity: data.quantity,
            discount: 0,
          }));

          const discounts: Discount[] = [
            createMockDiscount({
              product_id: productId,
              discount_type: 'percentage',
              discount_value: 10,
            }),
          ];

          const result = calculateCartWithDiscounts(items, discounts, []);

          // Invariant: totalDiscount = subtotal - total
          return result.totalDiscount === result.subtotal - result.total;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: Subtotal equals sum of (quantity × originalPrice)
   */
  it('Property 8.3: Subtotal equals sum of (quantity × originalPrice)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.integer({ min: 1000, max: 1000000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (cartData) => {
          const items: CartItem[] = cartData.map((data, idx) => ({
            product: createMockProduct({
              id: `product-${idx}`,
              price: data.price,
            }),
            quantity: data.quantity,
            discount: 0,
          }));

          const result = calculateCartWithDiscounts(items, [], []);

          // Calculate expected subtotal
          let expectedSubtotal = 0;
          for (const item of items) {
            expectedSubtotal += item.product.price * item.quantity;
          }

          return result.subtotal === expectedSubtotal;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: Cart without discounts has total equal to subtotal
   */
  it('Property 8.4: Cart without discounts has total equal to subtotal', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.integer({ min: 1000, max: 1000000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (cartData) => {
          const items: CartItem[] = cartData.map((data, idx) => ({
            product: createMockProduct({
              id: `product-${idx}`,
              price: data.price,
            }),
            quantity: data.quantity,
            discount: 0,
          }));

          const result = calculateCartWithDiscounts(items, [], []);

          return (
            result.total === result.subtotal &&
            result.totalDiscount === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// Property 9: Minimum Purchase Requirement
// **Feature: diskon-promo, Property 9: Minimum Purchase Requirement**
// **Validates: Requirements 6.2, 6.3**
// ============================================

describe('Property 9: Minimum Purchase Requirement', () => {
  /**
   * Property 9.1: Cart below minimum is not eligible
   * For any promo with min_purchase and cart_total < min_purchase,
   * the promo discount should NOT be applied
   */
  it('Property 9.1: Cart below minimum purchase is not eligible for promo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 1000000 }),  // minPurchase
        fc.integer({ min: 1, max: 9999 }),          // shortage (how much below)
        (minPurchase, shortage) => {
          const cartTotal = minPurchase - shortage;
          
          const promo = createMockPromo({
            min_purchase: minPurchase,
          });

          const result = checkMinimumPurchase(cartTotal, promo);
          
          return !result.eligible && result.remaining > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Cart at or above minimum is eligible
   * For any promo with min_purchase and cart_total >= min_purchase,
   * the promo discount should be applied
   */
  it('Property 9.2: Cart at or above minimum purchase is eligible for promo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 1000000 }),  // minPurchase
        fc.integer({ min: 0, max: 100000 }),       // extra amount
        (minPurchase, extra) => {
          const cartTotal = minPurchase + extra;
          
          const promo = createMockPromo({
            min_purchase: minPurchase,
          });

          const result = checkMinimumPurchase(cartTotal, promo);
          
          return result.eligible && result.remaining === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: Promo without minimum purchase is always eligible
   */
  it('Property 9.3: Promo without minimum purchase is always eligible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }),  // any cart total
        (cartTotal) => {
          const promo = createMockPromo({
            min_purchase: null,
          });

          const result = checkMinimumPurchase(cartTotal, promo);
          
          return result.eligible && result.remaining === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 10: Remaining Amount Calculation
// **Feature: diskon-promo, Property 10: Remaining Amount Calculation**
// **Validates: Requirements 6.4**
// ============================================

describe('Property 10: Remaining Amount Calculation', () => {
  /**
   * Property 10.1: Remaining amount equals min_purchase - cart_total
   * For any promo with min_purchase and cart_total < min_purchase,
   * remaining = min_purchase - cart_total
   */
  it('Property 10.1: Remaining amount equals min_purchase - cart_total when below minimum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 1000000 }),  // minPurchase
        fc.integer({ min: 1, max: 9999 }),          // shortage
        (minPurchase, shortage) => {
          const cartTotal = minPurchase - shortage;
          
          const promo = createMockPromo({
            min_purchase: minPurchase,
          });

          const result = checkMinimumPurchase(cartTotal, promo);
          
          const expectedRemaining = minPurchase - cartTotal;
          
          return result.remaining === expectedRemaining;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: Remaining is zero when eligible
   * For any promo where cart_total >= min_purchase, remaining = 0
   */
  it('Property 10.2: Remaining is zero when cart meets minimum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 1000000 }),  // minPurchase
        fc.integer({ min: 0, max: 100000 }),       // extra
        (minPurchase, extra) => {
          const cartTotal = minPurchase + extra;
          
          const promo = createMockPromo({
            min_purchase: minPurchase,
          });

          const result = checkMinimumPurchase(cartTotal, promo);
          
          return result.remaining === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.3: Remaining is always non-negative
   */
  it('Property 10.3: Remaining amount is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }),                    // cartTotal
        fc.option(fc.integer({ min: 0, max: 10000000 }), { nil: null }), // minPurchase (nullable)
        (cartTotal, minPurchase) => {
          const promo = createMockPromo({
            min_purchase: minPurchase,
          });

          const result = checkMinimumPurchase(cartTotal, promo);
          
          return result.remaining >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
