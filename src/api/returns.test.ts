import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatDateForReturnNumber,
  isValidReturnNumberFormat,
  parseReturnNumber,
  calculateAvailableQuantity,
  validateReturnQuantities,
  calculateItemRefund,
  simulateStockUpdateForReturn,
  shouldCreateStockMovement,
  CreateReturnItemInput,
  ReturnReason,
} from './returns';
import { TransactionItem } from '@/types';

// ============================================
// Helpers
// ============================================

function createMockTransactionItem(overrides: Partial<TransactionItem> = {}): TransactionItem {
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
    ...overrides,
  };
}

// ============================================
// Property 3: Return Number Format and Uniqueness
// **Feature: retur-refund, Property 3: Return Number Format and Uniqueness**
// **Validates: Requirements 1.5**
// ============================================

describe('Property 3: Return Number Format and Uniqueness', () => {
  // Arbitrary for generating valid dates
  const dateArb = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).filter(d => !isNaN(d.getTime()));

  // Arbitrary for generating sequence numbers (1-9999)
  const sequenceArb = fc.integer({ min: 1, max: 9999 });

  /**
   * Property 3.1: formatDateForReturnNumber produces YYYYMMDD format
   */
  it('Property 3.1: formatDateForReturnNumber produces YYYYMMDD format', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const result = formatDateForReturnNumber(date);
        
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

  /**
   * Property 3.2: Valid return numbers match RTN-YYYYMMDD-XXXX format
   */
  it('Property 3.2: Valid return numbers match RTN-YYYYMMDD-XXXX format', () => {
    fc.assert(
      fc.property(dateArb, sequenceArb, (date, sequence) => {
        const dateStr = formatDateForReturnNumber(date);
        const seqStr = sequence.toString().padStart(4, '0');
        const returnNumber = `RTN-${dateStr}-${seqStr}`;
        
        return isValidReturnNumberFormat(returnNumber);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: Invalid formats are rejected
   */
  it('Property 3.3: Invalid formats are rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('RTN-2024010-0001'),  // Short date
          fc.constant('RTN-202401011-0001'), // Long date
          fc.constant('RTN-20240101-001'),   // Short sequence
          fc.constant('RTN-20240101-00001'), // Long sequence
          fc.constant('RET-20240101-0001'),  // Wrong prefix
          fc.constant('RTN20240101-0001'),   // Missing dash
          fc.constant('RTN-20240101_0001'),  // Wrong separator
          fc.constant('TRX-20240101-0001'),  // Transaction format
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.startsWith('RTN-')),
        ),
        (invalidNumber) => {
          return !isValidReturnNumberFormat(invalidNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.4: parseReturnNumber extracts correct date and sequence
   */
  it('Property 3.4: parseReturnNumber extracts correct date and sequence', () => {
    fc.assert(
      fc.property(dateArb, sequenceArb, (date, sequence) => {
        const dateStr = formatDateForReturnNumber(date);
        const seqStr = sequence.toString().padStart(4, '0');
        const returnNumber = `RTN-${dateStr}-${seqStr}`;
        
        const parsed = parseReturnNumber(returnNumber);
        
        if (!parsed) return false;
        
        return parsed.date === dateStr && parsed.sequence === sequence;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.5: parseReturnNumber returns null for invalid formats
   */
  it('Property 3.5: parseReturnNumber returns null for invalid formats', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).filter(s => !isValidReturnNumberFormat(s)),
        (invalidNumber) => {
          return parseReturnNumber(invalidNumber) === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.6: Return numbers for same date with different sequences are unique
   */
  it('Property 3.6: Return numbers for same date with different sequences are unique', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.array(sequenceArb, { minLength: 2, maxLength: 20 })
          .map(arr => [...new Set(arr)]) // Ensure unique sequences
          .filter(arr => arr.length >= 2),
        (date, sequences) => {
          const dateStr = formatDateForReturnNumber(date);
          const returnNumbers = sequences.map(seq => 
            `RTN-${dateStr}-${seq.toString().padStart(4, '0')}`
          );
          
          // All return numbers should be unique
          const uniqueNumbers = new Set(returnNumbers);
          return uniqueNumbers.size === returnNumbers.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// Property 1: Return Requires Valid Transaction
// **Feature: retur-refund, Property 1: Return Requires Valid Transaction**
// **Validates: Requirements 1.1, 1.2**
// ============================================

describe('Property 1: Return Requires Valid Transaction', () => {
  /**
   * Property 1.1: Return validation requires transaction items to exist
   */
  it('Property 1.1: Return validation fails when transaction item not found', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // non-existent transaction_item_id
        fc.integer({ min: 1, max: 10 }), // quantity
        fc.constantFrom<ReturnReason>('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'),
        (itemId, quantity, reason) => {
          const items: CreateReturnItemInput[] = [{
            transaction_item_id: itemId,
            quantity,
            reason,
            is_damaged: false,
          }];

          const transactionItems: TransactionItem[] = []; // Empty - no items
          const returnedQuantities = new Map<string, number>();
          const productNames = new Map<string, string>();

          const result = validateReturnQuantities(items, transactionItems, returnedQuantities, productNames);

          // Should fail because transaction item not found
          return result.valid === false && 
                 result.errors.length > 0 &&
                 result.errors[0].message === 'Item transaksi tidak ditemukan';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Return validation succeeds when transaction item exists with valid quantity
   */
  it('Property 1.2: Return validation succeeds when transaction item exists with valid quantity', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // transaction_item_id
        fc.uuid(), // product_id
        fc.integer({ min: 1, max: 100 }), // original quantity
        fc.constantFrom<ReturnReason>('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'),
        (itemId, productId, originalQty, reason) => {
          // Return quantity should be <= original quantity
          const returnQty = Math.max(1, Math.floor(originalQty / 2));

          const items: CreateReturnItemInput[] = [{
            transaction_item_id: itemId,
            quantity: returnQty,
            reason,
            is_damaged: false,
          }];

          const transactionItems: TransactionItem[] = [
            createMockTransactionItem({
              id: itemId,
              product_id: productId,
              quantity: originalQty,
            }),
          ];

          const returnedQuantities = new Map<string, number>();
          const productNames = new Map<string, string>([[productId, 'Test Product']]);

          const result = validateReturnQuantities(items, transactionItems, returnedQuantities, productNames);

          // Should succeed because quantity is valid
          return result.valid === true && result.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 2: Return Quantity Validation
// **Feature: retur-refund, Property 2: Return Quantity Validation**
// **Validates: Requirements 1.4**
// ============================================

describe('Property 2: Return Quantity Validation', () => {
  /**
   * Property 2.1: Return quantity cannot exceed original quantity
   */
  it('Property 2.1: Return quantity cannot exceed original quantity', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // transaction_item_id
        fc.uuid(), // product_id
        fc.integer({ min: 1, max: 50 }), // original quantity
        fc.integer({ min: 1, max: 100 }), // extra quantity to exceed
        fc.constantFrom<ReturnReason>('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'),
        (itemId, productId, originalQty, extraQty, reason) => {
          const returnQty = originalQty + extraQty; // Always exceeds

          const items: CreateReturnItemInput[] = [{
            transaction_item_id: itemId,
            quantity: returnQty,
            reason,
            is_damaged: false,
          }];

          const transactionItems: TransactionItem[] = [
            createMockTransactionItem({
              id: itemId,
              product_id: productId,
              quantity: originalQty,
            }),
          ];

          const returnedQuantities = new Map<string, number>();
          const productNames = new Map<string, string>([[productId, 'Test Product']]);

          const result = validateReturnQuantities(items, transactionItems, returnedQuantities, productNames);

          // Should fail because quantity exceeds original
          return result.valid === false && 
                 result.errors.length > 0 &&
                 result.errors[0].message.includes('melebihi');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.2: Return quantity cannot exceed (original - already returned)
   */
  it('Property 2.2: Return quantity cannot exceed (original - already returned)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // transaction_item_id
        fc.uuid(), // product_id
        fc.integer({ min: 5, max: 50 }), // original quantity (min 5 to allow partial returns)
        fc.integer({ min: 1, max: 4 }), // already returned (less than original)
        fc.constantFrom<ReturnReason>('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'),
        (itemId, productId, originalQty, alreadyReturned, reason) => {
          const availableQty = originalQty - alreadyReturned;
          const returnQty = availableQty + 1; // Exceeds available

          const items: CreateReturnItemInput[] = [{
            transaction_item_id: itemId,
            quantity: returnQty,
            reason,
            is_damaged: false,
          }];

          const transactionItems: TransactionItem[] = [
            createMockTransactionItem({
              id: itemId,
              product_id: productId,
              quantity: originalQty,
            }),
          ];

          const returnedQuantities = new Map<string, number>([[itemId, alreadyReturned]]);
          const productNames = new Map<string, string>([[productId, 'Test Product']]);

          const result = validateReturnQuantities(items, transactionItems, returnedQuantities, productNames);

          // Should fail because quantity exceeds available
          return result.valid === false && result.errors.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.3: Valid return quantity within available range succeeds
   */
  it('Property 2.3: Valid return quantity within available range succeeds', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // transaction_item_id
        fc.uuid(), // product_id
        fc.integer({ min: 5, max: 50 }), // original quantity
        fc.integer({ min: 0, max: 2 }), // already returned
        fc.constantFrom<ReturnReason>('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'),
        (itemId, productId, originalQty, alreadyReturned, reason) => {
          const availableQty = originalQty - alreadyReturned;
          // Return quantity should be between 1 and available
          const returnQty = Math.max(1, Math.floor(availableQty / 2));

          const items: CreateReturnItemInput[] = [{
            transaction_item_id: itemId,
            quantity: returnQty,
            reason,
            is_damaged: false,
          }];

          const transactionItems: TransactionItem[] = [
            createMockTransactionItem({
              id: itemId,
              product_id: productId,
              quantity: originalQty,
            }),
          ];

          const returnedQuantities = new Map<string, number>([[itemId, alreadyReturned]]);
          const productNames = new Map<string, string>([[productId, 'Test Product']]);

          const result = validateReturnQuantities(items, transactionItems, returnedQuantities, productNames);

          // Should succeed because quantity is within available range
          return result.valid === true && result.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.4: calculateAvailableQuantity returns correct value
   */
  it('Property 2.4: calculateAvailableQuantity returns correct value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // original quantity
        fc.integer({ min: 0, max: 100 }), // returned quantity
        (originalQty, returnedQty) => {
          const available = calculateAvailableQuantity(originalQty, returnedQty);
          const expected = Math.max(0, originalQty - returnedQty);
          
          return available === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.5: Zero or negative return quantity is rejected
   */
  it('Property 2.5: Zero or negative return quantity is rejected', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // transaction_item_id
        fc.uuid(), // product_id
        fc.integer({ min: 1, max: 50 }), // original quantity
        fc.integer({ min: -10, max: 0 }), // invalid return quantity
        fc.constantFrom<ReturnReason>('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other'),
        (itemId, productId, originalQty, returnQty, reason) => {
          const items: CreateReturnItemInput[] = [{
            transaction_item_id: itemId,
            quantity: returnQty,
            reason,
            is_damaged: false,
          }];

          const transactionItems: TransactionItem[] = [
            createMockTransactionItem({
              id: itemId,
              product_id: productId,
              quantity: originalQty,
            }),
          ];

          const returnedQuantities = new Map<string, number>();
          const productNames = new Map<string, string>([[productId, 'Test Product']]);

          const result = validateReturnQuantities(items, transactionItems, returnedQuantities, productNames);

          // Should fail because quantity is zero or negative
          return result.valid === false && result.errors.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// Property 6: Stock Update on Return Completion
// **Feature: retur-refund, Property 6: Stock Update on Return Completion**
// **Validates: Requirements 4.1, 4.2, 4.4**
// ============================================

describe('Property 6: Stock Update on Return Completion', () => {
  /**
   * Property 6.1: Resellable items increase stock by return quantity
   */
  it('Property 6.1: Resellable items increase stock by return quantity', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // product_id
        fc.integer({ min: 0, max: 100 }), // current stock
        fc.integer({ min: 1, max: 50 }), // return quantity
        (productId, currentStock, returnQty) => {
          const currentStockMap = new Map<string, number>([[productId, currentStock]]);
          
          const returnItems = [{
            product_id: productId,
            quantity: returnQty,
            is_resellable: true,
          }];

          const newStockMap = simulateStockUpdateForReturn(currentStockMap, returnItems);
          const newStock = newStockMap.get(productId) || 0;

          // Stock should increase by return quantity for resellable items
          return newStock === currentStock + returnQty;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: Non-resellable items do NOT increase stock
   */
  it('Property 6.2: Non-resellable items do NOT increase stock', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // product_id
        fc.integer({ min: 0, max: 100 }), // current stock
        fc.integer({ min: 1, max: 50 }), // return quantity
        (productId, currentStock, returnQty) => {
          const currentStockMap = new Map<string, number>([[productId, currentStock]]);
          
          const returnItems = [{
            product_id: productId,
            quantity: returnQty,
            is_resellable: false, // Damaged/non-resellable
          }];

          const newStockMap = simulateStockUpdateForReturn(currentStockMap, returnItems);
          const newStock = newStockMap.get(productId) || 0;

          // Stock should NOT change for non-resellable items
          return newStock === currentStock;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: Mixed resellable and non-resellable items update correctly
   */
  it('Property 6.3: Mixed resellable and non-resellable items update correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // product_id_1 (resellable)
        fc.uuid(), // product_id_2 (non-resellable)
        fc.integer({ min: 0, max: 100 }), // current stock 1
        fc.integer({ min: 0, max: 100 }), // current stock 2
        fc.integer({ min: 1, max: 50 }), // return quantity 1
        fc.integer({ min: 1, max: 50 }), // return quantity 2
        (productId1, productId2, stock1, stock2, qty1, qty2) => {
          // Skip if same product IDs
          if (productId1 === productId2) return true;

          const currentStockMap = new Map<string, number>([
            [productId1, stock1],
            [productId2, stock2],
          ]);
          
          const returnItems = [
            { product_id: productId1, quantity: qty1, is_resellable: true },
            { product_id: productId2, quantity: qty2, is_resellable: false },
          ];

          const newStockMap = simulateStockUpdateForReturn(currentStockMap, returnItems);
          
          const newStock1 = newStockMap.get(productId1) || 0;
          const newStock2 = newStockMap.get(productId2) || 0;

          // Resellable item should increase, non-resellable should stay same
          return newStock1 === stock1 + qty1 && newStock2 === stock2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.4: shouldCreateStockMovement returns true only for resellable items
   */
  it('Property 6.4: shouldCreateStockMovement returns true only for resellable items', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // is_resellable
        (isResellable) => {
          const item = { is_resellable: isResellable };
          const result = shouldCreateStockMovement(item);
          
          return result === isResellable;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.5: Multiple returns of same product accumulate correctly
   */
  it('Property 6.5: Multiple returns of same product accumulate correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // product_id
        fc.integer({ min: 0, max: 100 }), // current stock
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }), // return quantities
        (productId, currentStock, quantities) => {
          const currentStockMap = new Map<string, number>([[productId, currentStock]]);
          
          const returnItems = quantities.map(qty => ({
            product_id: productId,
            quantity: qty,
            is_resellable: true,
          }));

          const newStockMap = simulateStockUpdateForReturn(currentStockMap, returnItems);
          const newStock = newStockMap.get(productId) || 0;

          const totalReturned = quantities.reduce((sum, qty) => sum + qty, 0);

          // Stock should increase by total of all return quantities
          return newStock === currentStock + totalReturned;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Unit Tests for Refund Calculation
// ============================================

describe('Refund Calculation', () => {
  it('calculates refund correctly without discount', () => {
    const refund = calculateItemRefund(10000, 0, 2);
    expect(refund).toBe(20000);
  });

  it('calculates refund correctly with discount', () => {
    const refund = calculateItemRefund(10000, 1000, 2);
    expect(refund).toBe(18000); // (10000 - 1000) * 2
  });

  it('calculates refund for single item', () => {
    const refund = calculateItemRefund(50000, 5000, 1);
    expect(refund).toBe(45000);
  });
});

// ============================================
// Unit Tests for Return Number
// ============================================

describe('Return Number Unit Tests', () => {
  it('formats single digit month and day with leading zeros', () => {
    const date = new Date('2024-01-05');
    expect(formatDateForReturnNumber(date)).toBe('20240105');
  });

  it('formats double digit month and day correctly', () => {
    const date = new Date('2024-12-25');
    expect(formatDateForReturnNumber(date)).toBe('20241225');
  });

  it('validates correct return number format', () => {
    expect(isValidReturnNumberFormat('RTN-20240101-0001')).toBe(true);
    expect(isValidReturnNumberFormat('RTN-20241231-9999')).toBe(true);
  });

  it('rejects invalid return number formats', () => {
    expect(isValidReturnNumberFormat('')).toBe(false);
    expect(isValidReturnNumberFormat('RTN-2024-0001')).toBe(false);
    expect(isValidReturnNumberFormat('TRX-20240101-0001')).toBe(false);
  });

  it('parses valid return number correctly', () => {
    const result = parseReturnNumber('RTN-20240115-0042');
    expect(result).toEqual({ date: '20240115', sequence: 42 });
  });

  it('returns null for invalid return number', () => {
    expect(parseReturnNumber('invalid')).toBeNull();
  });
});
