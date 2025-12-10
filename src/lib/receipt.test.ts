import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatReceipt,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  centerText,
  formatLine,
  validateReceiptContent,
  ReceiptData,
  ReceiptItem,
} from './receipt';
import { Transaction } from '@/types';

/**
 * **Feature: kasir-checkout, Property 4: Receipt Contains All Required Information**
 * **Validates: Requirements 3.1**
 * 
 * For any completed transaction, the generated receipt string should contain:
 * store name, transaction number, date/time, all item names with prices,
 * subtotal, discount amount, tax amount, total amount, payment method,
 * and (for cash payments) change amount.
 */
describe('Receipt Contains All Required Information', () => {
  // Arbitrary for payment method
  const paymentMethodArb = fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet');

  // Arbitrary for receipt items
  const receiptItemArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    quantity: fc.integer({ min: 1, max: 100 }),
    unitPrice: fc.integer({ min: 100, max: 1000000 }),
    totalPrice: fc.integer({ min: 100, max: 10000000 }),
    discount: fc.integer({ min: 0, max: 100000 }),
  });

  // Arbitrary for transaction
  const transactionArb = (paymentMethod: 'cash' | 'card' | 'e-wallet', totalAmount: number) => fc.record({
    id: fc.uuid(),
    transaction_number: fc.constant(`TRX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`),
    user_id: fc.uuid(),
    total_amount: fc.constant(totalAmount),
    tax_amount: fc.integer({ min: 0, max: 50000 }),
    discount_amount: fc.integer({ min: 0, max: 50000 }),
    payment_method: fc.constant(paymentMethod),
    cash_received: paymentMethod === 'cash' ? fc.constant(totalAmount + 10000) : fc.constant(undefined),
    change_amount: paymentMethod === 'cash' ? fc.constant(10000) : fc.constant(undefined),
    transaction_date: fc.constant(new Date().toISOString()),
    status: fc.constant('completed' as const),
    created_at: fc.constant(new Date().toISOString()),
  });

  it('Property 4.1: Receipt contains store name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        fc.array(receiptItemArb, { minLength: 1, maxLength: 5 }),
        paymentMethodArb,
        (storeName, items, paymentMethod) => {
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
          const totalAmount = subtotal + 1000; // Add some tax

          const data: ReceiptData = {
            storeName,
            transaction: {
              id: 'test-id',
              transaction_number: 'TRX-20240101-0001',
              user_id: 'user-id',
              total_amount: totalAmount,
              tax_amount: 1000,
              discount_amount: 0,
              payment_method: paymentMethod,
              cash_received: paymentMethod === 'cash' ? totalAmount + 5000 : undefined,
              change_amount: paymentMethod === 'cash' ? 5000 : undefined,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal,
          };

          const receipt = formatReceipt(data);
          return receipt.includes(storeName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: Receipt contains transaction number', () => {
    fc.assert(
      fc.property(
        fc.array(receiptItemArb, { minLength: 1, maxLength: 5 }),
        fc.stringMatching(/^TRX-\d{8}-\d{4}$/),
        (items, trxNumber) => {
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

          const data: ReceiptData = {
            storeName: 'Test Store',
            transaction: {
              id: 'test-id',
              transaction_number: trxNumber,
              user_id: 'user-id',
              total_amount: subtotal,
              tax_amount: 0,
              discount_amount: 0,
              payment_method: 'cash',
              cash_received: subtotal,
              change_amount: 0,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal,
          };

          const receipt = formatReceipt(data);
          return receipt.includes(trxNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: Receipt contains all item names', () => {
    fc.assert(
      fc.property(
        fc.array(receiptItemArb, { minLength: 1, maxLength: 5 }),
        (items) => {
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

          const data: ReceiptData = {
            storeName: 'Test Store',
            transaction: {
              id: 'test-id',
              transaction_number: 'TRX-20240101-0001',
              user_id: 'user-id',
              total_amount: subtotal,
              tax_amount: 0,
              discount_amount: 0,
              payment_method: 'cash',
              cash_received: subtotal,
              change_amount: 0,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal,
          };

          const receipt = formatReceipt(data);
          return items.every(item => receipt.includes(item.name));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.4: Receipt contains total amount', () => {
    fc.assert(
      fc.property(
        fc.array(receiptItemArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1000, max: 10000000 }),
        (items, totalAmount) => {
          const data: ReceiptData = {
            storeName: 'Test Store',
            transaction: {
              id: 'test-id',
              transaction_number: 'TRX-20240101-0001',
              user_id: 'user-id',
              total_amount: totalAmount,
              tax_amount: 0,
              discount_amount: 0,
              payment_method: 'cash',
              cash_received: totalAmount,
              change_amount: 0,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal: totalAmount,
          };

          const receipt = formatReceipt(data);
          return receipt.includes(formatCurrency(totalAmount));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.5: Receipt contains payment method', () => {
    fc.assert(
      fc.property(
        fc.array(receiptItemArb, { minLength: 1, maxLength: 3 }),
        paymentMethodArb,
        (items, paymentMethod) => {
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

          const data: ReceiptData = {
            storeName: 'Test Store',
            transaction: {
              id: 'test-id',
              transaction_number: 'TRX-20240101-0001',
              user_id: 'user-id',
              total_amount: subtotal,
              tax_amount: 0,
              discount_amount: 0,
              payment_method: paymentMethod,
              cash_received: paymentMethod === 'cash' ? subtotal : undefined,
              change_amount: paymentMethod === 'cash' ? 0 : undefined,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal,
          };

          const receipt = formatReceipt(data);
          return receipt.includes(formatPaymentMethod(paymentMethod));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.6: Cash payment receipt contains change amount', () => {
    fc.assert(
      fc.property(
        fc.array(receiptItemArb, { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 1000, max: 100000 }), // change amount
        (items, changeAmount) => {
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
          const cashReceived = subtotal + changeAmount;

          const data: ReceiptData = {
            storeName: 'Test Store',
            transaction: {
              id: 'test-id',
              transaction_number: 'TRX-20240101-0001',
              user_id: 'user-id',
              total_amount: subtotal,
              tax_amount: 0,
              discount_amount: 0,
              payment_method: 'cash',
              cash_received: cashReceived,
              change_amount: changeAmount,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal,
          };

          const receipt = formatReceipt(data);
          return receipt.includes(formatCurrency(changeAmount));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.7: validateReceiptContent returns true for valid receipts', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.array(receiptItemArb, { minLength: 1, maxLength: 3 }),
        paymentMethodArb,
        (storeName, items, paymentMethod) => {
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

          const data: ReceiptData = {
            storeName,
            transaction: {
              id: 'test-id',
              transaction_number: 'TRX-20240101-0001',
              user_id: 'user-id',
              total_amount: subtotal,
              tax_amount: 0,
              discount_amount: 0,
              payment_method: paymentMethod,
              cash_received: paymentMethod === 'cash' ? subtotal + 5000 : undefined,
              change_amount: paymentMethod === 'cash' ? 5000 : undefined,
              transaction_date: new Date().toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
            },
            items,
            subtotal,
          };

          const receipt = formatReceipt(data);
          return validateReceiptContent(receipt, data);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests
describe('Receipt Utility Functions', () => {
  it('formatCurrency formats Indonesian Rupiah correctly', () => {
    expect(formatCurrency(10000)).toMatch(/10\.000/);
    expect(formatCurrency(1500000)).toMatch(/1\.500\.000/);
  });

  it('formatPaymentMethod returns Indonesian labels', () => {
    expect(formatPaymentMethod('cash')).toBe('Tunai');
    expect(formatPaymentMethod('card')).toBe('Kartu');
    expect(formatPaymentMethod('e-wallet')).toBe('E-Wallet');
  });

  it('centerText centers text correctly', () => {
    const result = centerText('Hello', 10);
    expect(result).toBe('  Hello');
  });

  it('formatLine aligns left and right text', () => {
    const result = formatLine('Left', 'Right', 20);
    expect(result.startsWith('Left')).toBe(true);
    expect(result.endsWith('Right')).toBe(true);
    expect(result.length).toBe(20);
  });

  it('formatDateTime returns formatted date string', () => {
    const result = formatDateTime('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
