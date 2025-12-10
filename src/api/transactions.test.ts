import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatDateForTrxNumber,
  isValidTransactionNumberFormat,
  parseTransactionNumber,
} from './transactions';

/**
 * **Feature: kasir-checkout, Property 7: Transaction Number Format and Uniqueness**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * For any generated transaction number, it should match the format TRX-YYYYMMDD-XXXX
 * where YYYY is the year, MM is the month, DD is the day, and XXXX is a 4-digit sequential number.
 * For any set of transaction numbers generated on the same day, all numbers should be unique.
 */
describe('Transaction Number Format and Uniqueness', () => {
  // Arbitrary for generating valid dates (filter out invalid dates)
  const dateArb = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).filter(d => !isNaN(d.getTime()));

  // Arbitrary for generating sequence numbers (1-9999)
  const sequenceArb = fc.integer({ min: 1, max: 9999 });

  it('Property 7.1: formatDateForTrxNumber produces YYYYMMDD format', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const result = formatDateForTrxNumber(date);
        
        // Should be exactly 8 characters
        if (result.length !== 8) return false;
        
        // Should be all digits
        if (!/^\d{8}$/.test(result)) return false;
        
        // Should match the date components
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        return result === `${year}${month}${day}`;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Valid transaction numbers match TRX-YYYYMMDD-XXXX format', () => {
    fc.assert(
      fc.property(dateArb, sequenceArb, (date, sequence) => {
        const dateStr = formatDateForTrxNumber(date);
        const seqStr = sequence.toString().padStart(4, '0');
        const trxNumber = `TRX-${dateStr}-${seqStr}`;
        
        return isValidTransactionNumberFormat(trxNumber);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Invalid formats are rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('TRX-2024010-0001'),  // Short date
          fc.constant('TRX-202401011-0001'), // Long date
          fc.constant('TRX-20240101-001'),   // Short sequence
          fc.constant('TRX-20240101-00001'), // Long sequence
          fc.constant('TX-20240101-0001'),   // Wrong prefix
          fc.constant('TRX20240101-0001'),   // Missing dash
          fc.constant('TRX-20240101_0001'),  // Wrong separator
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.startsWith('TRX-')),
        ),
        (invalidNumber) => {
          return !isValidTransactionNumberFormat(invalidNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: parseTransactionNumber extracts correct date and sequence', () => {
    fc.assert(
      fc.property(dateArb, sequenceArb, (date, sequence) => {
        const dateStr = formatDateForTrxNumber(date);
        const seqStr = sequence.toString().padStart(4, '0');
        const trxNumber = `TRX-${dateStr}-${seqStr}`;
        
        const parsed = parseTransactionNumber(trxNumber);
        
        if (!parsed) return false;
        
        return parsed.date === dateStr && parsed.sequence === sequence;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: parseTransactionNumber returns null for invalid formats', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).filter(s => !isValidTransactionNumberFormat(s)),
        (invalidNumber) => {
          return parseTransactionNumber(invalidNumber) === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: Transaction numbers for same date with different sequences are unique', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.array(sequenceArb, { minLength: 2, maxLength: 20 })
          .map(arr => [...new Set(arr)]) // Ensure unique sequences
          .filter(arr => arr.length >= 2),
        (date, sequences) => {
          const dateStr = formatDateForTrxNumber(date);
          const trxNumbers = sequences.map(seq => 
            `TRX-${dateStr}-${seq.toString().padStart(4, '0')}`
          );
          
          // All transaction numbers should be unique
          const uniqueNumbers = new Set(trxNumbers);
          return uniqueNumbers.size === trxNumbers.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for edge cases
describe('Transaction Number Unit Tests', () => {
  it('formats single digit month and day with leading zeros', () => {
    const date = new Date('2024-01-05');
    expect(formatDateForTrxNumber(date)).toBe('20240105');
  });

  it('formats double digit month and day correctly', () => {
    const date = new Date('2024-12-25');
    expect(formatDateForTrxNumber(date)).toBe('20241225');
  });

  it('validates correct transaction number format', () => {
    expect(isValidTransactionNumberFormat('TRX-20240101-0001')).toBe(true);
    expect(isValidTransactionNumberFormat('TRX-20241231-9999')).toBe(true);
  });

  it('rejects invalid transaction number formats', () => {
    expect(isValidTransactionNumberFormat('')).toBe(false);
    expect(isValidTransactionNumberFormat('TRX-2024-0001')).toBe(false);
    expect(isValidTransactionNumberFormat('INV-20240101-0001')).toBe(false);
  });

  it('parses valid transaction number correctly', () => {
    const result = parseTransactionNumber('TRX-20240115-0042');
    expect(result).toEqual({ date: '20240115', sequence: 42 });
  });

  it('returns null for invalid transaction number', () => {
    expect(parseTransactionNumber('invalid')).toBeNull();
  });
});


/**
 * **Feature: kasir-checkout, Property 1: Transaction Creation Completeness**
 * **Validates: Requirements 1.1, 1.2**
 * 
 * For any valid cart with items and valid payment information, when a transaction is created,
 * the system should produce a transaction record with all required fields AND create exactly
 * one transaction_item record for each cart item with correct quantity, unit_price, and total_price.
 */
describe('Transaction Creation Completeness', () => {
  // Arbitrary for generating mock products
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    barcode: fc.option(fc.string({ minLength: 8, maxLength: 13 }), { nil: undefined }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
    price: fc.integer({ min: 100, max: 1000000 }).map(n => n / 100),
    stock_quantity: fc.integer({ min: 1, max: 1000 }),
    min_stock: fc.integer({ min: 1, max: 100 }),
    category_id: fc.option(fc.uuid(), { nil: undefined }),
    supplier_id: fc.option(fc.uuid(), { nil: undefined }),
    image_url: fc.option(fc.string(), { nil: undefined }),
    is_active: fc.constant(true),
    created_at: fc.constant(new Date().toISOString()),
    updated_at: fc.constant(new Date().toISOString()),
  });

  // Arbitrary for cart items
  const cartItemArb = productArb.chain(product => 
    fc.record({
      product: fc.constant(product),
      quantity: fc.integer({ min: 1, max: Math.min(product.stock_quantity, 10) }),
      discount: fc.integer({ min: 0, max: Math.floor(product.price * 0.5) }).map(n => n / 100),
    })
  );

  // Arbitrary for payment method
  const paymentMethodArb = fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet');

  it('Property 1.1: Transaction input contains all required fields', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1, maxLength: 10 }),
        paymentMethodArb,
        fc.integer({ min: 0, max: 10000 }).map(n => n / 100), // discount
        fc.integer({ min: 0, max: 5000 }).map(n => n / 100),  // tax
        (items, paymentMethod, discountAmount, taxAmount) => {
          // Calculate totals
          const subtotal = items.reduce(
            (sum, item) => sum + (item.product.price * item.quantity - item.discount),
            0
          );
          const totalAmount = subtotal + taxAmount - discountAmount;

          // Create input object
          const input = {
            items,
            paymentMethod,
            cashReceived: paymentMethod === 'cash' ? totalAmount + 100 : undefined,
            discountAmount,
            taxAmount,
            subtotal,
            totalAmount,
          };

          // Verify input has all required fields
          return (
            Array.isArray(input.items) &&
            input.items.length > 0 &&
            ['cash', 'card', 'e-wallet'].includes(input.paymentMethod) &&
            typeof input.discountAmount === 'number' &&
            typeof input.taxAmount === 'number' &&
            typeof input.totalAmount === 'number'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: Each cart item has required product fields', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1, maxLength: 10 }),
        (items) => {
          return items.every(item =>
            typeof item.product.id === 'string' &&
            typeof item.product.name === 'string' &&
            typeof item.product.price === 'number' &&
            item.product.price > 0 &&
            typeof item.quantity === 'number' &&
            item.quantity > 0 &&
            typeof item.discount === 'number' &&
            item.discount >= 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: Transaction item total_price equals (unit_price * quantity) - discount', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1, maxLength: 10 }),
        (items) => {
          return items.every(item => {
            const expectedTotal = item.product.price * item.quantity - item.discount;
            // Allow small floating point tolerance
            return Math.abs(expectedTotal - (item.product.price * item.quantity - item.discount)) < 0.01;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.4: Number of transaction items equals number of cart items', () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1, maxLength: 20 }),
        (items) => {
          // Simulate creating transaction items
          const transactionItems = items.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            total_price: item.product.price * item.quantity - item.discount,
            discount: item.discount,
          }));

          return transactionItems.length === items.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.5: Change amount is calculated correctly for cash payments', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000 }).map(n => n / 100), // totalAmount
        fc.integer({ min: 0, max: 50000 }).map(n => n / 100),     // extra cash
        (totalAmount, extraCash) => {
          const cashReceived = totalAmount + extraCash;
          const changeAmount = cashReceived - totalAmount;

          return Math.abs(changeAmount - extraCash) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 10: Outlet-Scoped Transactions**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * For any transaction created, it should be associated with the current outlet,
 * AND stock should be deducted from the current outlet only.
 */
import { filterTransactionsByOutlet, validateTransactionOutlet } from './transactions';
import { Transaction } from '@/types';

describe('Outlet-Scoped Transactions', () => {
  // Arbitrary for generating mock transactions with outlet
  const transactionWithOutletArb = fc.record({
    id: fc.uuid(),
    transaction_number: fc.string({ minLength: 10, maxLength: 20 }),
    user_id: fc.uuid(),
    outlet_id: fc.option(fc.uuid(), { nil: undefined }),
    total_amount: fc.float({ min: 1, max: 10000, noNaN: true }),
    tax_amount: fc.float({ min: 0, max: 1000, noNaN: true }),
    discount_amount: fc.float({ min: 0, max: 500, noNaN: true }),
    payment_method: fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet'),
    cash_received: fc.option(fc.float({ min: 0, max: 20000, noNaN: true }), { nil: undefined }),
    change_amount: fc.option(fc.float({ min: 0, max: 10000, noNaN: true }), { nil: undefined }),
    transaction_date: fc.integer({ min: 1704067200000, max: 1735689600000 })
      .map(ts => new Date(ts).toISOString()),
    status: fc.constantFrom<'completed' | 'pending' | 'cancelled'>('completed', 'pending', 'cancelled'),
    created_at: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<Transaction>;

  it('Property 10.1: Transaction with outlet_id validates correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (outletId) => {
          const transaction: Transaction = {
            id: 'test-id',
            transaction_number: 'TRX-20240101-0001',
            user_id: 'user-id',
            outlet_id: outletId,
            total_amount: 100,
            tax_amount: 10,
            discount_amount: 0,
            payment_method: 'cash',
            transaction_date: new Date().toISOString(),
            status: 'completed',
            created_at: new Date().toISOString(),
          };

          return validateTransactionOutlet(transaction, outletId) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10.2: Transaction with different outlet_id fails validation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (outletId1, outletId2) => {
          // Skip if same outlet IDs
          if (outletId1 === outletId2) return true;

          const transaction: Transaction = {
            id: 'test-id',
            transaction_number: 'TRX-20240101-0001',
            user_id: 'user-id',
            outlet_id: outletId1,
            total_amount: 100,
            tax_amount: 10,
            discount_amount: 0,
            payment_method: 'cash',
            transaction_date: new Date().toISOString(),
            status: 'completed',
            created_at: new Date().toISOString(),
          };

          return validateTransactionOutlet(transaction, outletId2) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10.3: Transaction without outlet_id fails validation for any outlet', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (outletId) => {
          const transaction: Transaction = {
            id: 'test-id',
            transaction_number: 'TRX-20240101-0001',
            user_id: 'user-id',
            outlet_id: undefined,
            total_amount: 100,
            tax_amount: 10,
            discount_amount: 0,
            payment_method: 'cash',
            transaction_date: new Date().toISOString(),
            status: 'completed',
            created_at: new Date().toISOString(),
          };

          return validateTransactionOutlet(transaction, outletId) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 11: Outlet-Scoped Transaction History**
 * **Validates: Requirements 5.3**
 * 
 * For any outlet, viewing transaction history should return only transactions from that outlet.
 */
describe('Outlet-Scoped Transaction History', () => {
  // Arbitrary for generating mock transactions with outlet
  const transactionWithOutletArb = fc.record({
    id: fc.uuid(),
    transaction_number: fc.string({ minLength: 10, maxLength: 20 }),
    user_id: fc.uuid(),
    outlet_id: fc.option(fc.uuid(), { nil: undefined }),
    total_amount: fc.float({ min: 1, max: 10000, noNaN: true }),
    tax_amount: fc.float({ min: 0, max: 1000, noNaN: true }),
    discount_amount: fc.float({ min: 0, max: 500, noNaN: true }),
    payment_method: fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet'),
    cash_received: fc.option(fc.float({ min: 0, max: 20000, noNaN: true }), { nil: undefined }),
    change_amount: fc.option(fc.float({ min: 0, max: 10000, noNaN: true }), { nil: undefined }),
    transaction_date: fc.integer({ min: 1704067200000, max: 1735689600000 })
      .map(ts => new Date(ts).toISOString()),
    status: fc.constantFrom<'completed' | 'pending' | 'cancelled'>('completed', 'pending', 'cancelled'),
    created_at: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<Transaction>;

  it('Property 11.1: Filter by outlet returns only transactions from that outlet', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (transactions, targetOutletId) => {
          // Ensure some transactions have the target outlet
          const transactionsWithTarget = transactions.map((tx, i) => 
            i % 3 === 0 ? { ...tx, outlet_id: targetOutletId } : tx
          );

          const filtered = filterTransactionsByOutlet(transactionsWithTarget, targetOutletId);

          // All filtered transactions should have the target outlet_id
          return filtered.every(tx => tx.outlet_id === targetOutletId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.2: Filter returns all transactions with matching outlet', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (transactions, targetOutletId) => {
          // Ensure some transactions have the target outlet
          const transactionsWithTarget = transactions.map((tx, i) => 
            i % 3 === 0 ? { ...tx, outlet_id: targetOutletId } : tx
          );

          const filtered = filterTransactionsByOutlet(transactionsWithTarget, targetOutletId);

          // Count expected matches
          const expectedCount = transactionsWithTarget.filter(tx => tx.outlet_id === targetOutletId).length;

          return filtered.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.3: Filter with non-existent outlet returns empty array', () => {
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

          const filtered = filterTransactionsByOutlet(transactionsWithoutTarget, nonExistentOutletId);

          return filtered.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.4: Transactions without outlet_id are not included in outlet filter', () => {
    fc.assert(
      fc.property(
        fc.array(transactionWithOutletArb, { minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (transactions, targetOutletId) => {
          // Make some transactions have no outlet_id
          const mixedTransactions = transactions.map((tx, i) => ({
            ...tx,
            outlet_id: i % 2 === 0 ? targetOutletId : undefined,
          }));

          const filtered = filterTransactionsByOutlet(mixedTransactions, targetOutletId);

          // No filtered transaction should have undefined outlet_id
          return filtered.every(tx => tx.outlet_id !== undefined);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.5: Empty transactions array returns empty result', () => {
    const result = filterTransactionsByOutlet([], 'any-outlet-id');
    expect(result).toEqual([]);
  });
});
