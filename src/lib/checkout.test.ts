import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateCheckout,
  validateCartNotEmpty,
  validateCashPayment,
  validatePayment,
  calculateChange,
  isCheckoutEnabled,
  PaymentInfo,
} from './checkout';
import { CartItem, Product } from '@/types';

// Helper to create mock product
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
 * **Feature: kasir-checkout, Property 5: Payment Validation Logic**
 * **Validates: Requirements 4.1, 4.2**
 * 
 * For any checkout attempt where payment method is 'cash' and cash_received is less than total_amount,
 * the validation should fail. For any checkout attempt where payment method is 'card' or 'e-wallet',
 * the validation should pass regardless of cash_received value.
 */
describe('Payment Validation Logic', () => {
  const paymentMethodArb = fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet');

  it('Property 5.1: Cash payment fails when cash_received < total_amount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }), // totalAmount
        fc.integer({ min: 1, max: 999 }),        // shortage (how much less)
        (totalAmount, shortage) => {
          const cashReceived = totalAmount - shortage;
          
          const payment: PaymentInfo = {
            method: 'cash',
            cashReceived,
            totalAmount,
          };

          const result = validatePayment(payment);
          return !result.valid && result.errors.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: Cash payment passes when cash_received >= total_amount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }), // totalAmount
        fc.integer({ min: 0, max: 100000 }),     // extra cash
        (totalAmount, extraCash) => {
          const cashReceived = totalAmount + extraCash;
          
          const payment: PaymentInfo = {
            method: 'cash',
            cashReceived,
            totalAmount,
          };

          const result = validatePayment(payment);
          return result.valid;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: Card payment passes regardless of cash_received', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }), // totalAmount
        fc.option(fc.integer({ min: 0, max: 1000000 }), { nil: undefined }), // cashReceived (optional)
        (totalAmount, cashReceived) => {
          const payment: PaymentInfo = {
            method: 'card',
            cashReceived,
            totalAmount,
          };

          const result = validatePayment(payment);
          return result.valid;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.4: E-wallet payment passes regardless of cash_received', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }), // totalAmount
        fc.option(fc.integer({ min: 0, max: 1000000 }), { nil: undefined }), // cashReceived (optional)
        (totalAmount, cashReceived) => {
          const payment: PaymentInfo = {
            method: 'e-wallet',
            cashReceived,
            totalAmount,
          };

          const result = validatePayment(payment);
          return result.valid;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.5: validateCashPayment returns correct boolean', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 1000000 }),
        (cashReceived, totalAmount) => {
          const result = validateCashPayment(cashReceived, totalAmount);
          return result === (cashReceived >= totalAmount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: kasir-checkout, Property 6: Empty Cart Rejection**
 * **Validates: Requirements 4.3**
 * 
 * For any checkout attempt with an empty cart (zero items),
 * the operation should be rejected with a validation error.
 */
describe('Empty Cart Rejection', () => {
  const paymentMethodArb = fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet');

  it('Property 6.1: Empty cart always fails validation', () => {
    fc.assert(
      fc.property(
        paymentMethodArb,
        fc.integer({ min: 1000, max: 1000000 }),
        (method, totalAmount) => {
          const items: CartItem[] = [];
          const payment: PaymentInfo = {
            method,
            cashReceived: method === 'cash' ? totalAmount : undefined,
            totalAmount,
          };

          const result = validateCheckout(items, payment);
          return !result.valid && result.errors.some(e => e.includes('Keranjang kosong'));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.2: validateCartNotEmpty returns false for empty array', () => {
    expect(validateCartNotEmpty([])).toBe(false);
  });

  it('Property 6.3: validateCartNotEmpty returns true for non-empty array', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          const items: CartItem[] = Array(count).fill(null).map((_, i) => ({
            product: createMockProduct({ id: `product-${i}` }),
            quantity: 1,
            discount: 0,
          }));

          return validateCartNotEmpty(items);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.4: Non-empty cart with valid payment passes validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1000, max: 100000 }),
        (itemCount, totalAmount) => {
          const items: CartItem[] = Array(itemCount).fill(null).map((_, i) => ({
            product: createMockProduct({ id: `product-${i}`, price: totalAmount / itemCount }),
            quantity: 1,
            discount: 0,
          }));

          const payment: PaymentInfo = {
            method: 'card', // Card doesn't need cash validation
            totalAmount,
          };

          const result = validateCheckout(items, payment);
          return result.valid;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests
describe('Checkout Utility Functions', () => {
  it('calculateChange returns correct change amount', () => {
    expect(calculateChange(50000, 35000)).toBe(15000);
    expect(calculateChange(100000, 100000)).toBe(0);
    expect(calculateChange(30000, 50000)).toBe(0); // Can't have negative change
  });

  it('isCheckoutEnabled returns false when loading', () => {
    const items: CartItem[] = [{ product: createMockProduct(), quantity: 1, discount: 0 }];
    const payment: PaymentInfo = { method: 'card', totalAmount: 10000 };
    
    expect(isCheckoutEnabled(items, payment, true)).toBe(false);
  });

  it('isCheckoutEnabled returns false for empty cart', () => {
    const payment: PaymentInfo = { method: 'card', totalAmount: 10000 };
    
    expect(isCheckoutEnabled([], payment, false)).toBe(false);
  });

  it('isCheckoutEnabled returns false for insufficient cash', () => {
    const items: CartItem[] = [{ product: createMockProduct(), quantity: 1, discount: 0 }];
    const payment: PaymentInfo = { method: 'cash', cashReceived: 5000, totalAmount: 10000 };
    
    expect(isCheckoutEnabled(items, payment, false)).toBe(false);
  });

  it('isCheckoutEnabled returns true for valid checkout', () => {
    const items: CartItem[] = [{ product: createMockProduct(), quantity: 1, discount: 0 }];
    const payment: PaymentInfo = { method: 'cash', cashReceived: 15000, totalAmount: 10000 };
    
    expect(isCheckoutEnabled(items, payment, false)).toBe(true);
  });
});
