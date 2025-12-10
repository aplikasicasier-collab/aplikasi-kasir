import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateReturnReceipt,
  validateReturnReceiptContent,
  formatReturnReason,
  formatRefundMethod,
  formatReturnStatus,
  returnItemsToReceiptItems,
  receiptContainsReturnDate,
  ReturnReceiptData,
} from './returnReceipt';
import { formatCurrency, formatDateTime } from './receipt';
import { Return, ReturnItem, ReturnReason, ReturnStatus } from '@/api/returns';
import { Transaction } from '@/types';

/**
 * **Feature: retur-refund, Property 8: Return Receipt Content**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 * 
 * For any completed return, the generated receipt should contain:
 * return_number, original transaction_number, all returned items with 
 * quantities and refund amounts, total refund amount, return date, and kasir name.
 */
describe('Return Receipt Content - Property 8', () => {
  // Arbitrary for return reason
  const returnReasonArb = fc.constantFrom<ReturnReason>(
    'damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'
  );

  // Arbitrary for return status
  const returnStatusArb = fc.constantFrom<ReturnStatus>(
    'pending_approval', 'approved', 'completed', 'rejected', 'cancelled'
  );

  // Arbitrary for refund method
  const refundMethodArb = fc.constantFrom<string | null>('cash', 'card', 'e-wallet', null);

  // Arbitrary for return item
  const returnItemArb = fc.record({
    id: fc.uuid(),
    return_id: fc.uuid(),
    transaction_item_id: fc.uuid(),
    product_id: fc.uuid(),
    product_name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    quantity: fc.integer({ min: 1, max: 10 }),
    original_price: fc.integer({ min: 1000, max: 1000000 }),
    discount_amount: fc.integer({ min: 0, max: 100000 }),
    refund_amount: fc.integer({ min: 100, max: 1000000 }),
    reason: returnReasonArb,
    reason_detail: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    is_damaged: fc.boolean(),
    is_resellable: fc.boolean(),
    created_at: fc.constant(new Date().toISOString()),
  });

  // Arbitrary for return number format RTN-YYYYMMDD-XXXX
  const returnNumberArb = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 1, max: 9999 })
  ).map(([year, month, day, seq]) => {
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const s = seq.toString().padStart(4, '0');
    return `RTN-${year}${m}${d}-${s}`;
  });

  // Arbitrary for transaction number format TRX-YYYYMMDD-XXXX
  const transactionNumberArb = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 1, max: 9999 })
  ).map(([year, month, day, seq]) => {
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const s = seq.toString().padStart(4, '0');
    return `TRX-${year}${m}${d}-${s}`;
  });

  // Arbitrary for return data
  const returnDataArb = (items: ReturnItem[], returnNumber: string, status: ReturnStatus, refundMethod: string | null) => {
    const totalRefund = items.reduce((sum, item) => sum + item.refund_amount, 0);
    return fc.record({
      id: fc.uuid(),
      return_number: fc.constant(returnNumber),
      transaction_id: fc.uuid(),
      outlet_id: fc.option(fc.uuid(), { nil: null }),
      status: fc.constant(status),
      total_refund: fc.constant(totalRefund),
      refund_method: fc.constant(refundMethod),
      requires_approval: fc.boolean(),
      approved_by: fc.option(fc.uuid(), { nil: null }),
      approval_reason: fc.option(fc.string(), { nil: null }),
      rejected_reason: fc.option(fc.string(), { nil: null }),
      notes: fc.option(fc.string(), { nil: null }),
      created_by: fc.uuid(),
      completed_at: fc.option(fc.constant(new Date().toISOString()), { nil: null }),
      created_at: fc.constant(new Date().toISOString()),
      updated_at: fc.constant(new Date().toISOString()),
      items: fc.constant(items),
    });
  };

  // Arbitrary for transaction
  const transactionArb = (transactionNumber: string) => fc.record({
    id: fc.uuid(),
    transaction_number: fc.constant(transactionNumber),
    user_id: fc.uuid(),
    total_amount: fc.integer({ min: 1000, max: 10000000 }),
    tax_amount: fc.integer({ min: 0, max: 100000 }),
    discount_amount: fc.integer({ min: 0, max: 100000 }),
    payment_method: fc.constantFrom<'cash' | 'card' | 'e-wallet'>('cash', 'card', 'e-wallet'),
    transaction_date: fc.constant(new Date().toISOString()),
    status: fc.constant('completed' as const),
    created_at: fc.constant(new Date().toISOString()),
  });

  it('Property 8.1: Receipt contains return number', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 5 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return receipt.includes(returnNumber);
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.2: Receipt contains original transaction number', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 5 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return receipt.includes(txNumber);
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.3: Receipt contains all returned item names', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 5 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return items.every(item => receipt.includes(item.product_name!));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.4: Receipt contains total refund amount', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 5 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return receipt.includes(formatCurrency(returnData.total_refund));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.5: Receipt contains kasir name', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 5 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return receipt.includes(kasirName);
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.6: Receipt contains return date', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 5 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return receiptContainsReturnDate(receipt, returnData.created_at);
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.7: validateReturnReceiptContent returns true for valid receipts', () => {
    fc.assert(
      fc.property(
        fc.array(returnItemArb, { minLength: 1, maxLength: 3 }),
        returnNumberArb,
        transactionNumberArb,
        returnStatusArb,
        refundMethodArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (items, returnNumber, txNumber, status, refundMethod, storeName, kasirName) => {
          const returnDataGen = returnDataArb(items, returnNumber, status, refundMethod);
          const txGen = transactionArb(txNumber);
          
          return fc.assert(
            fc.property(returnDataGen, txGen, (returnData, transaction) => {
              const data: ReturnReceiptData = {
                storeName,
                returnData: returnData as Return,
                originalTransaction: transaction as Transaction,
                kasirName,
              };
              
              const receipt = generateReturnReceipt(data);
              return validateReturnReceiptContent(receipt, data);
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for utility functions
describe('Return Receipt Utility Functions', () => {
  it('formatReturnReason returns Indonesian labels', () => {
    expect(formatReturnReason('damaged')).toBe('Rusak');
    expect(formatReturnReason('wrong_product')).toBe('Salah Produk');
    expect(formatReturnReason('not_as_described')).toBe('Tidak Sesuai');
    expect(formatReturnReason('changed_mind')).toBe('Berubah Pikiran');
    expect(formatReturnReason('other')).toBe('Lainnya');
  });

  it('formatRefundMethod returns Indonesian labels', () => {
    expect(formatRefundMethod('cash')).toBe('Tunai');
    expect(formatRefundMethod('card')).toBe('Kartu');
    expect(formatRefundMethod('e-wallet')).toBe('E-Wallet');
    expect(formatRefundMethod(null)).toBe('-');
  });

  it('formatReturnStatus returns Indonesian labels', () => {
    expect(formatReturnStatus('pending_approval')).toBe('Menunggu Persetujuan');
    expect(formatReturnStatus('approved')).toBe('Disetujui');
    expect(formatReturnStatus('completed')).toBe('Selesai');
    expect(formatReturnStatus('rejected')).toBe('Ditolak');
    expect(formatReturnStatus('cancelled')).toBe('Dibatalkan');
  });

  it('returnItemsToReceiptItems converts items correctly', () => {
    const items: ReturnItem[] = [
      {
        id: '1',
        return_id: 'r1',
        transaction_item_id: 'ti1',
        product_id: 'p1',
        product_name: 'Test Product',
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

    const receiptItems = returnItemsToReceiptItems(items);
    
    expect(receiptItems).toHaveLength(1);
    expect(receiptItems[0].name).toBe('Test Product');
    expect(receiptItems[0].quantity).toBe(2);
    expect(receiptItems[0].originalPrice).toBe(10000);
    expect(receiptItems[0].discountAmount).toBe(1000);
    expect(receiptItems[0].refundAmount).toBe(18000);
    expect(receiptItems[0].reason).toBe('damaged');
  });

  it('generateReturnReceipt includes store info when provided', () => {
    const data: ReturnReceiptData = {
      storeName: 'Test Store',
      storeAddress: 'Jl. Test No. 123',
      storePhone: '021-1234567',
      returnData: {
        id: '1',
        return_number: 'RTN-20240101-0001',
        transaction_id: 't1',
        outlet_id: null,
        status: 'completed',
        total_refund: 50000,
        refund_method: 'cash',
        requires_approval: false,
        approved_by: null,
        approval_reason: null,
        rejected_reason: null,
        notes: null,
        created_by: 'u1',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          {
            id: 'i1',
            return_id: '1',
            transaction_item_id: 'ti1',
            product_id: 'p1',
            product_name: 'Product A',
            quantity: 1,
            original_price: 50000,
            discount_amount: 0,
            refund_amount: 50000,
            reason: 'damaged',
            reason_detail: null,
            is_damaged: true,
            is_resellable: false,
            created_at: new Date().toISOString(),
          },
        ],
      },
      originalTransaction: {
        id: 't1',
        transaction_number: 'TRX-20240101-0001',
        user_id: 'u1',
        total_amount: 100000,
        tax_amount: 0,
        discount_amount: 0,
        payment_method: 'cash',
        transaction_date: new Date().toISOString(),
        status: 'completed',
        created_at: new Date().toISOString(),
      },
      kasirName: 'John Doe',
    };

    const receipt = generateReturnReceipt(data);
    
    expect(receipt).toContain('Test Store');
    expect(receipt).toContain('Jl. Test No. 123');
    expect(receipt).toContain('021-1234567');
    expect(receipt).toContain('BUKTI RETUR');
    expect(receipt).toContain('RTN-20240101-0001');
    expect(receipt).toContain('TRX-20240101-0001');
    expect(receipt).toContain('Product A');
    expect(receipt).toContain('John Doe');
    expect(receipt).toContain('Rusak');
  });
});
