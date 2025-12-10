import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatDateForPONumber,
  generatePONumberLocal,
  isValidPONumberFormat,
  validatePOInput,
  calculatePOTotal,
  createPOLocally,
  CreatePOInput,
  CreatePOItemInput,
} from './purchaseOrders';

// ============================================
// Arbitraries for generating test data
// ============================================

// Valid UUID arbitrary
const uuidArb = fc.uuid();

// Valid PO item arbitrary
const validPOItemArb: fc.Arbitrary<CreatePOItemInput> = fc.record({
  productId: uuidArb,
  quantity: fc.integer({ min: 1, max: 1000 }),
  unitPrice: fc.integer({ min: 0, max: 10000000 }),
});

// Valid date arbitrary that filters out invalid dates
const validDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .filter(d => !isNaN(d.getTime()));

// Valid PO input arbitrary
const validPOInputArb: fc.Arbitrary<CreatePOInput> = fc.record({
  supplierId: uuidArb,
  expectedDate: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  items: fc.array(validPOItemArb, { minLength: 1, maxLength: 10 }),
});

// Invalid supplier ID arbitrary (empty or whitespace)
const invalidSupplierIdArb = fc.constantFrom('', '   ', '\t', '\n');

// Invalid quantity arbitrary (zero or negative)
const invalidQuantityArb = fc.integer({ min: -100, max: 0 });

// Invalid unit price arbitrary (negative)
const invalidUnitPriceArb = fc.integer({ min: -10000, max: -1 });

/**
 * **Feature: purchase-order, Property 1: PO Creation Validation**
 * **Validates: Requirements 1.1, 1.4, 1.5**
 * 
 * For any purchase order creation request, the system should generate a unique 
 * order number in format PO-YYYYMMDD-XXXX, set initial status to 'pending', 
 * AND reject the request if no supplier is specified.
 */
describe('PO Creation Validation', () => {
  describe('Property 1.1: PO number format is PO-YYYYMMDD-XXXX', () => {
    it('generates PO number with correct format for any date', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
          (date, existingNumbers) => {
            const poNumber = generatePONumberLocal(existingNumbers, date);
            return isValidPONumberFormat(poNumber);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PO number contains correct date component', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const poNumber = generatePONumberLocal([], date);
            const expectedDateStr = formatDateForPONumber(date);
            return poNumber.includes(expectedDateStr);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.2: PO number sequence increments correctly', () => {
    it('generates sequential numbers for same date', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc.integer({ min: 1, max: 100 }),
          (date, count) => {
            const existingNumbers: string[] = [];
            
            for (let i = 0; i < count; i++) {
              const newNumber = generatePONumberLocal(existingNumbers, date);
              existingNumbers.push(newNumber);
            }

            // All numbers should be unique
            const uniqueNumbers = new Set(existingNumbers);
            if (uniqueNumbers.size !== existingNumbers.length) return false;

            // All numbers should have valid format
            return existingNumbers.every(n => isValidPONumberFormat(n));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('first PO of the day has sequence 0001', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const poNumber = generatePONumberLocal([], date);
            return poNumber.endsWith('-0001');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.3: Initial status is pending', () => {
    it('created PO always has pending status', () => {
      fc.assert(
        fc.property(
          validPOInputArb,
          uuidArb,
          (input, userId) => {
            const orderNumber = generatePONumberLocal([], new Date());
            const po = createPOLocally(input, orderNumber, userId);
            return po.status === 'pending';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.4: Validation rejects missing supplier', () => {
    it('rejects PO without supplier ID', () => {
      fc.assert(
        fc.property(
          invalidSupplierIdArb,
          fc.array(validPOItemArb, { minLength: 1, maxLength: 5 }),
          (supplierId, items) => {
            const input: CreatePOInput = {
              supplierId,
              items,
            };
            const result = validatePOInput(input);
            return !result.valid && result.errors.some(e => e.includes('Supplier'));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.5: Validation accepts valid PO input', () => {
    it('accepts valid PO input with supplier and items', () => {
      fc.assert(
        fc.property(
          validPOInputArb,
          (input) => {
            const result = validatePOInput(input);
            return result.valid && result.errors.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.6: Validation rejects empty items', () => {
    it('rejects PO without items', () => {
      fc.assert(
        fc.property(
          uuidArb,
          (supplierId) => {
            const input: CreatePOInput = {
              supplierId,
              items: [],
            };
            const result = validatePOInput(input);
            return !result.valid && result.errors.some(e => e.includes('item'));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.7: Validation rejects invalid item quantities', () => {
    it('rejects items with zero or negative quantity', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          invalidQuantityArb,
          fc.integer({ min: 0, max: 10000 }),
          (supplierId, productId, quantity, unitPrice) => {
            const input: CreatePOInput = {
              supplierId,
              items: [{ productId, quantity, unitPrice }],
            };
            const result = validatePOInput(input);
            return !result.valid && result.errors.some(e => e.includes('Quantity'));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.8: Validation rejects negative unit prices', () => {
    it('rejects items with negative unit price', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.integer({ min: 1, max: 100 }),
          invalidUnitPriceArb,
          (supplierId, productId, quantity, unitPrice) => {
            const input: CreatePOInput = {
              supplierId,
              items: [{ productId, quantity, unitPrice }],
            };
            const result = validatePOInput(input);
            return !result.valid && result.errors.some(e => e.includes('price'));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Unit tests for edge cases
describe('PO Number Generation Unit Tests', () => {
  it('formatDateForPONumber formats date correctly', () => {
    expect(formatDateForPONumber(new Date('2024-01-15'))).toBe('20240115');
    expect(formatDateForPONumber(new Date('2024-12-31'))).toBe('20241231');
    expect(formatDateForPONumber(new Date('2024-06-05'))).toBe('20240605');
  });

  it('isValidPONumberFormat validates correctly', () => {
    expect(isValidPONumberFormat('PO-20240115-0001')).toBe(true);
    expect(isValidPONumberFormat('PO-20241231-9999')).toBe(true);
    expect(isValidPONumberFormat('PO-2024015-0001')).toBe(false); // Wrong date length
    expect(isValidPONumberFormat('PO-20240115-001')).toBe(false); // Wrong sequence length
    expect(isValidPONumberFormat('XX-20240115-0001')).toBe(false); // Wrong prefix
    expect(isValidPONumberFormat('PO20240115-0001')).toBe(false); // Missing dash
  });

  it('generatePONumberLocal handles existing numbers correctly', () => {
    const date = new Date('2024-06-15');
    const existing = ['PO-20240615-0001', 'PO-20240615-0002', 'PO-20240615-0003'];
    const newNumber = generatePONumberLocal(existing, date);
    expect(newNumber).toBe('PO-20240615-0004');
  });

  it('generatePONumberLocal ignores numbers from other dates', () => {
    const date = new Date('2024-06-15');
    const existing = ['PO-20240614-0005', 'PO-20240616-0010'];
    const newNumber = generatePONumberLocal(existing, date);
    expect(newNumber).toBe('PO-20240615-0001');
  });
});

describe('PO Validation Unit Tests', () => {
  it('validatePOInput returns all errors for multiple issues', () => {
    const input: CreatePOInput = {
      supplierId: '',
      items: [],
    };
    const result = validatePOInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('calculatePOTotal calculates correctly', () => {
    const items: CreatePOItemInput[] = [
      { productId: 'p1', quantity: 2, unitPrice: 1000 },
      { productId: 'p2', quantity: 3, unitPrice: 500 },
    ];
    expect(calculatePOTotal(items)).toBe(3500);
  });

  it('calculatePOTotal returns 0 for empty items', () => {
    expect(calculatePOTotal([])).toBe(0);
  });
});


/**
 * **Feature: purchase-order, Property 2: PO Items and Total Calculation**
 * **Validates: Requirements 1.2, 1.3**
 * 
 * For any purchase order with items, each item should have product_id, quantity, 
 * and unit_price recorded, AND the total_amount should equal the sum of 
 * (quantity × unit_price) for all items.
 */
describe('PO Items and Total Calculation', () => {
  describe('Property 2.1: Total equals sum of item totals', () => {
    it('total_amount equals sum of (quantity × unit_price) for all items', () => {
      fc.assert(
        fc.property(
          fc.array(validPOItemArb, { minLength: 1, maxLength: 20 }),
          (items) => {
            const calculatedTotal = calculatePOTotal(items);
            const expectedTotal = items.reduce(
              (sum, item) => sum + (item.quantity * item.unitPrice),
              0
            );
            return calculatedTotal === expectedTotal;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2.2: Each item has required fields', () => {
    it('created PO items have product_id, quantity, and unit_price', () => {
      fc.assert(
        fc.property(
          validPOInputArb,
          uuidArb,
          (input, userId) => {
            const orderNumber = generatePONumberLocal([], new Date());
            const po = createPOLocally(input, orderNumber, userId);

            // Verify PO has correct total
            const expectedTotal = input.items.reduce(
              (sum, item) => sum + (item.quantity * item.unitPrice),
              0
            );

            // Verify all items have required fields
            const allItemsValid = input.items.every(item =>
              item.productId &&
              item.productId.length > 0 &&
              item.quantity > 0 &&
              item.unitPrice >= 0
            );

            return po.total_amount === expectedTotal && allItemsValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2.3: Total is non-negative', () => {
    it('total_amount is always non-negative for valid items', () => {
      fc.assert(
        fc.property(
          fc.array(validPOItemArb, { minLength: 0, maxLength: 20 }),
          (items) => {
            const total = calculatePOTotal(items);
            return total >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2.4: Single item total equals quantity × unit_price', () => {
    it('single item PO total equals item quantity × unit_price', () => {
      fc.assert(
        fc.property(
          validPOItemArb,
          (item) => {
            const total = calculatePOTotal([item]);
            return total === item.quantity * item.unitPrice;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2.5: Adding items increases total', () => {
    it('adding an item with positive price increases total', () => {
      fc.assert(
        fc.property(
          fc.array(validPOItemArb, { minLength: 1, maxLength: 10 }),
          fc.record({
            productId: uuidArb,
            quantity: fc.integer({ min: 1, max: 100 }),
            unitPrice: fc.integer({ min: 1, max: 10000 }), // Positive price
          }),
          (existingItems, newItem) => {
            const totalBefore = calculatePOTotal(existingItems);
            const totalAfter = calculatePOTotal([...existingItems, newItem]);
            return totalAfter > totalBefore;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// Import filtering functions
import {
  filterPOsByStatus,
  filterPOsByDateRange,
  searchPOs,
  filterPOs,
  PurchaseOrderWithItems,
  POFilters,
} from './purchaseOrders';

// ============================================
// Arbitraries for PO filtering tests
// ============================================

// PO status arbitrary
const poStatusArb = fc.constantFrom('pending', 'approved', 'received', 'cancelled') as fc.Arbitrary<PurchaseOrder['status']>;

// Supplier arbitrary for PO
const supplierArb = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 1, maxLength: 50 }),
});

// PO with items arbitrary (for filtering tests)
const poWithItemsArb: fc.Arbitrary<PurchaseOrderWithItems> = fc.record({
  id: uuidArb,
  order_number: fc.tuple(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())),
    fc.integer({ min: 1, max: 9999 })
  ).map(([date, seq]) => `PO-${formatDateForPONumber(date)}-${String(seq).padStart(4, '0')}`),
  supplier_id: uuidArb,
  user_id: uuidArb,
  total_amount: fc.integer({ min: 0, max: 100000000 }),
  status: poStatusArb,
  order_date: validDateArb.map(d => d.toISOString()),
  expected_date: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  received_date: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  notes: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  created_at: validDateArb.map(d => d.toISOString()),
  updated_at: validDateArb.map(d => d.toISOString()),
  items: fc.array(fc.record({
    id: uuidArb,
    purchase_order_id: uuidArb,
    product_id: uuidArb,
    quantity: fc.integer({ min: 1, max: 1000 }),
    received_quantity: fc.integer({ min: 0, max: 1000 }),
    unit_price: fc.integer({ min: 0, max: 10000000 }),
    total_price: fc.integer({ min: 0, max: 100000000 }),
    created_at: validDateArb.map(d => d.toISOString()),
  }), { minLength: 0, maxLength: 5 }),
  supplier: fc.option(supplierArb, { nil: undefined }),
});

// Import PurchaseOrder type for status
import { PurchaseOrder } from '@/types';

/**
 * **Feature: purchase-order, Property 6: PO Filtering and Search**
 * **Validates: Requirements 2.2, 2.3, 2.4**
 * 
 * For any filter applied to purchase orders: (1) status filter should return only 
 * POs with matching status, (2) date range filter should return only POs within 
 * the range, AND (3) search should return POs matching order_number or supplier name.
 */
describe('PO Filtering and Search', () => {
  describe('Property 6.1: Status filter returns only matching status', () => {
    it('all returned POs have the filtered status', () => {
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          poStatusArb,
          (purchaseOrders, status) => {
            const filtered = filterPOsByStatus(purchaseOrders, status);
            return filtered.every(po => po.status === status);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no POs with matching status are excluded', () => {
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          poStatusArb,
          (purchaseOrders, status) => {
            const filtered = filterPOsByStatus(purchaseOrders, status);
            const expectedCount = purchaseOrders.filter(po => po.status === status).length;
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6.2: Date range filter returns only POs within range', () => {
    it('all returned POs are within date range', () => {
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          validDateArb,
          validDateArb,
          (purchaseOrders, date1, date2) => {
            // Ensure startDate <= endDate
            const startDate = date1 < date2 ? date1.toISOString() : date2.toISOString();
            const endDate = date1 < date2 ? date2.toISOString() : date1.toISOString();
            
            const filtered = filterPOsByDateRange(purchaseOrders, startDate, endDate);
            
            return filtered.every(po => {
              const orderDate = new Date(po.order_date);
              return orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no POs within range are excluded', () => {
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          validDateArb,
          validDateArb,
          (purchaseOrders, date1, date2) => {
            const startDate = date1 < date2 ? date1.toISOString() : date2.toISOString();
            const endDate = date1 < date2 ? date2.toISOString() : date1.toISOString();
            
            const filtered = filterPOsByDateRange(purchaseOrders, startDate, endDate);
            const expectedCount = purchaseOrders.filter(po => {
              const orderDate = new Date(po.order_date);
              return orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
            }).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6.3: Search returns POs matching order_number or supplier name', () => {
    it('all returned POs match search term in order_number or supplier name', () => {
      // Use non-whitespace strings to avoid edge case where trim() changes the search term
      const nonWhitespaceSearchArb = fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          nonWhitespaceSearchArb,
          (purchaseOrders, searchTerm) => {
            const filtered = searchPOs(purchaseOrders, searchTerm);
            const searchLower = searchTerm.toLowerCase().trim();
            
            return filtered.every(po =>
              po.order_number.toLowerCase().includes(searchLower) ||
              (po.supplier?.name?.toLowerCase().includes(searchLower) ?? false)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no matching POs are excluded', () => {
      // Use non-whitespace strings to avoid edge case where trim() changes the search term
      const nonWhitespaceSearchArb = fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          nonWhitespaceSearchArb,
          (purchaseOrders, searchTerm) => {
            const filtered = searchPOs(purchaseOrders, searchTerm);
            const searchLower = searchTerm.toLowerCase().trim();
            
            const expectedCount = purchaseOrders.filter(po =>
              po.order_number.toLowerCase().includes(searchLower) ||
              (po.supplier?.name?.toLowerCase().includes(searchLower) ?? false)
            ).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty search returns all POs', () => {
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          fc.constantFrom('', '   ', '\t'),
          (purchaseOrders, emptySearch) => {
            const filtered = searchPOs(purchaseOrders, emptySearch);
            return filtered.length === purchaseOrders.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6.4: Combined filters work correctly', () => {
    it('combined filters apply all conditions', () => {
      fc.assert(
        fc.property(
          fc.array(poWithItemsArb, { minLength: 0, maxLength: 20 }),
          poStatusArb,
          validDateArb,
          validDateArb,
          (purchaseOrders, status, date1, date2) => {
            const startDate = date1 < date2 ? date1.toISOString() : date2.toISOString();
            const endDate = date1 < date2 ? date2.toISOString() : date1.toISOString();
            
            const filters: POFilters = {
              status,
              startDate,
              endDate,
            };
            
            const filtered = filterPOs(purchaseOrders, filters);
            
            return filtered.every(po => {
              const orderDate = new Date(po.order_date);
              return (
                po.status === status &&
                orderDate >= new Date(startDate) &&
                orderDate <= new Date(endDate)
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// Import status management functions
import {
  isTerminalState,
  validateStatusTransition,
  updatePOStatusLocally,
  TERMINAL_STATES,
} from './purchaseOrders';

// ============================================
// Arbitraries for Status Transition Tests
// ============================================

// Non-terminal status arbitrary (pending, approved)
const nonTerminalStatusArb = fc.constantFrom('pending', 'approved') as fc.Arbitrary<PurchaseOrder['status']>;

// Terminal status arbitrary (received, cancelled)
const terminalStatusArb = fc.constantFrom('received', 'cancelled') as fc.Arbitrary<PurchaseOrder['status']>;

// PO arbitrary for status tests
const poForStatusTestArb = (status: PurchaseOrder['status']): fc.Arbitrary<PurchaseOrder> => fc.record({
  id: uuidArb,
  order_number: fc.tuple(
    validDateArb,
    fc.integer({ min: 1, max: 9999 })
  ).map(([date, seq]) => `PO-${formatDateForPONumber(date)}-${String(seq).padStart(4, '0')}`),
  supplier_id: uuidArb,
  user_id: uuidArb,
  total_amount: fc.integer({ min: 0, max: 100000000 }),
  status: fc.constant(status),
  order_date: validDateArb.map(d => d.toISOString()),
  expected_date: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  received_date: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
  notes: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  created_at: validDateArb.map(d => d.toISOString()),
  updated_at: validDateArb.map(d => d.toISOString()),
});

/**
 * **Feature: purchase-order, Property 3: Status Transition Rules**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * For any purchase order status change: (1) approving a 'pending' PO should result 
 * in 'approved' status, (2) cancelling a PO should result in 'cancelled' status, 
 * (3) attempting to change status of 'received' or 'cancelled' PO should fail, 
 * AND (4) successful status changes should update the timestamp.
 */
describe('Status Transition Rules', () => {
  describe('Property 3.1: Approving pending PO results in approved status', () => {
    it('pending PO can be approved and results in approved status', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('pending'),
          (po) => {
            const result = updatePOStatusLocally(po, 'approved');
            return (
              result.success === true &&
              result.purchaseOrder !== undefined &&
              result.purchaseOrder.status === 'approved'
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3.2: Cancelling PO results in cancelled status', () => {
    it('pending PO can be cancelled and results in cancelled status', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('pending'),
          (po) => {
            const result = updatePOStatusLocally(po, 'cancelled');
            return (
              result.success === true &&
              result.purchaseOrder !== undefined &&
              result.purchaseOrder.status === 'cancelled'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('approved PO can be cancelled and results in cancelled status', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('approved'),
          (po) => {
            const result = updatePOStatusLocally(po, 'cancelled');
            return (
              result.success === true &&
              result.purchaseOrder !== undefined &&
              result.purchaseOrder.status === 'cancelled'
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3.3: Terminal states cannot be changed', () => {
    it('received PO cannot have status changed', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('received'),
          poStatusArb,
          (po, newStatus) => {
            const result = updatePOStatusLocally(po, newStatus);
            return (
              result.success === false &&
              result.error !== undefined &&
              result.error.includes('received')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cancelled PO cannot have status changed', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('cancelled'),
          poStatusArb,
          (po, newStatus) => {
            const result = updatePOStatusLocally(po, newStatus);
            return (
              result.success === false &&
              result.error !== undefined &&
              result.error.includes('cancelled')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isTerminalState correctly identifies terminal states', () => {
      fc.assert(
        fc.property(
          terminalStatusArb,
          (status) => {
            return isTerminalState(status) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isTerminalState correctly identifies non-terminal states', () => {
      fc.assert(
        fc.property(
          nonTerminalStatusArb,
          (status) => {
            return isTerminalState(status) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3.4: Successful status changes update timestamp', () => {
    it('approved PO has updated_at timestamp changed', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('pending'),
          (po) => {
            const originalUpdatedAt = po.updated_at;
            const result = updatePOStatusLocally(po, 'approved');
            
            if (!result.success || !result.purchaseOrder) return false;
            
            // The updated_at should be different (newer)
            return result.purchaseOrder.updated_at !== originalUpdatedAt;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cancelled PO has updated_at timestamp changed', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('pending'),
          (po) => {
            const originalUpdatedAt = po.updated_at;
            const result = updatePOStatusLocally(po, 'cancelled');
            
            if (!result.success || !result.purchaseOrder) return false;
            
            // The updated_at should be different (newer)
            return result.purchaseOrder.updated_at !== originalUpdatedAt;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3.5: Invalid transitions are rejected', () => {
    it('pending PO cannot be directly set to received', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('pending'),
          (po) => {
            const result = updatePOStatusLocally(po, 'received');
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('approved PO cannot be set back to pending', () => {
      fc.assert(
        fc.property(
          poForStatusTestArb('approved'),
          (po) => {
            const result = updatePOStatusLocally(po, 'pending');
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Unit tests for status management edge cases
describe('Status Management Unit Tests', () => {
  it('TERMINAL_STATES contains received and cancelled', () => {
    expect(TERMINAL_STATES).toContain('received');
    expect(TERMINAL_STATES).toContain('cancelled');
    expect(TERMINAL_STATES).not.toContain('pending');
    expect(TERMINAL_STATES).not.toContain('approved');
  });

  it('validateStatusTransition returns valid for pending -> approved', () => {
    const result = validateStatusTransition('pending', 'approved');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validateStatusTransition returns valid for pending -> cancelled', () => {
    const result = validateStatusTransition('pending', 'cancelled');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validateStatusTransition returns valid for approved -> cancelled', () => {
    const result = validateStatusTransition('approved', 'cancelled');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validateStatusTransition returns valid for approved -> received', () => {
    const result = validateStatusTransition('approved', 'received');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validateStatusTransition returns invalid for received -> any', () => {
    expect(validateStatusTransition('received', 'pending').valid).toBe(false);
    expect(validateStatusTransition('received', 'approved').valid).toBe(false);
    expect(validateStatusTransition('received', 'cancelled').valid).toBe(false);
  });

  it('validateStatusTransition returns invalid for cancelled -> any', () => {
    expect(validateStatusTransition('cancelled', 'pending').valid).toBe(false);
    expect(validateStatusTransition('cancelled', 'approved').valid).toBe(false);
    expect(validateStatusTransition('cancelled', 'received').valid).toBe(false);
  });

  it('validateStatusTransition returns invalid for pending -> received (skip approved)', () => {
    const result = validateStatusTransition('pending', 'received');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});


// Import receive PO functions
import {
  validateReceiveInput,
  checkReceiptDiscrepancy,
  generateDiscrepancyNotes,
  receivePOLocally,
  ReceivedItem,
} from './purchaseOrders';

// ============================================
// Arbitraries for Receive PO Tests
// ============================================

// PO item arbitrary for receive tests
const poItemArb = (productId: string): fc.Arbitrary<PurchaseOrderItem> => fc.record({
  id: uuidArb,
  purchase_order_id: uuidArb,
  product_id: fc.constant(productId),
  quantity: fc.integer({ min: 1, max: 100 }),
  received_quantity: fc.constant(0),
  unit_price: fc.integer({ min: 100, max: 10000 }),
  total_price: fc.integer({ min: 100, max: 1000000 }),
  created_at: validDateArb.map(d => d.toISOString()),
});

// Generate PO with items for receive tests
const approvedPOWithItemsArb: fc.Arbitrary<PurchaseOrderWithItems> = fc
  .array(uuidArb, { minLength: 1, maxLength: 5 })
  .chain(productIds => {
    const itemsArb = fc.tuple(
      ...productIds.map(pid => poItemArb(pid))
    );
    
    return fc.record({
      id: uuidArb,
      order_number: fc.tuple(
        validDateArb,
        fc.integer({ min: 1, max: 9999 })
      ).map(([date, seq]) => `PO-${formatDateForPONumber(date)}-${String(seq).padStart(4, '0')}`),
      supplier_id: uuidArb,
      user_id: uuidArb,
      total_amount: fc.integer({ min: 0, max: 100000000 }),
      status: fc.constant('approved' as const),
      order_date: validDateArb.map(d => d.toISOString()),
      expected_date: fc.option(validDateArb.map(d => d.toISOString()), { nil: undefined }),
      received_date: fc.constant(undefined),
      notes: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      created_at: validDateArb.map(d => d.toISOString()),
      updated_at: validDateArb.map(d => d.toISOString()),
      items: itemsArb.map(items => items as PurchaseOrderItem[]),
      supplier: fc.option(supplierArb, { nil: undefined }),
    });
  });

// Generate received items that match PO items (full receipt)
const fullReceiptItemsArb = (poItems: PurchaseOrderItem[]): fc.Arbitrary<ReceivedItem[]> => {
  return fc.constant(
    poItems.map(item => ({
      productId: item.product_id,
      receivedQuantity: item.quantity,
    }))
  );
};

// Generate received items with random quantities (may differ from ordered)
const randomReceiptItemsArb = (poItems: PurchaseOrderItem[]): fc.Arbitrary<ReceivedItem[]> => {
  return fc.tuple(
    ...poItems.map(item => 
      fc.integer({ min: 0, max: item.quantity + 10 }).map(qty => ({
        productId: item.product_id,
        receivedQuantity: qty,
      }))
    )
  ).map(items => items as ReceivedItem[]);
};

// Import PurchaseOrderItem type
import { PurchaseOrderItem } from '@/types';

/**
 * **Feature: purchase-order, Property 4: Receive PO and Stock Update**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 * 
 * For any purchase order marked as received, the status should change to 'received', 
 * stock quantity for each product should increase by the received quantity, 
 * AND a stock_movement record with type 'in' should be created for each item.
 */
describe('Receive PO and Stock Update', () => {
  describe('Property 4.1: Receiving PO changes status to received', () => {
    it('approved PO status changes to received after receiving', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            return (
              result.success === true &&
              result.purchaseOrder !== undefined &&
              result.purchaseOrder.status === 'received'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('received PO has received_date set', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            return (
              result.success === true &&
              result.purchaseOrder !== undefined &&
              result.purchaseOrder.received_date !== undefined
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.2: Stock increases by received quantity', () => {
    it('stock updates contain correct quantity changes', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success || !result.stockUpdates) return false;
            
            // Each stock update should match the received quantity
            return receivedItems.every(received => {
              const stockUpdate = result.stockUpdates!.find(
                su => su.productId === received.productId
              );
              return stockUpdate && stockUpdate.quantityChange === received.receivedQuantity;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all received items with quantity > 0 have stock updates', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success || !result.stockUpdates) return false;
            
            const itemsWithQty = receivedItems.filter(r => r.receivedQuantity > 0);
            return result.stockUpdates.length === itemsWithQty.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.3: Stock movements created with type in', () => {
    it('stock movements are created for each received item', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success || !result.stockMovements) return false;
            
            const itemsWithQty = receivedItems.filter(r => r.receivedQuantity > 0);
            return result.stockMovements.length === itemsWithQty.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all stock movements have type in', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success || !result.stockMovements) return false;
            
            return result.stockMovements.every(sm => sm.movementType === 'in');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('stock movements reference the purchase order', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success || !result.stockMovements) return false;
            
            return result.stockMovements.every(
              sm => sm.referenceType === 'purchase_order' && sm.referenceId === po.id
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.4: Only approved POs can be received', () => {
    it('pending PO cannot be received', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const pendingPO = { ...po, status: 'pending' as const };
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(pendingPO, receivedItems);
            
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cancelled PO cannot be received', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const cancelledPO = { ...po, status: 'cancelled' as const };
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(cancelledPO, receivedItems);
            
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('already received PO cannot be received again', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedPO = { ...po, status: 'received' as const };
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const result = receivePOLocally(receivedPO, receivedItems);
            
            return result.success === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Unit tests for receive PO edge cases
describe('Receive PO Unit Tests', () => {
  it('validateReceiveInput rejects non-approved PO', () => {
    const po: PurchaseOrderWithItems = {
      id: 'test-id',
      order_number: 'PO-20240101-0001',
      supplier_id: 'supplier-id',
      user_id: 'user-id',
      total_amount: 1000,
      status: 'pending',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{
        id: 'item-id',
        purchase_order_id: 'test-id',
        product_id: 'product-id',
        quantity: 10,
        received_quantity: 0,
        unit_price: 100,
        total_price: 1000,
        created_at: new Date().toISOString(),
      }],
    };
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 10 }];
    const result = validateReceiveInput(po, receivedItems);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('pending'))).toBe(true);
  });

  it('validateReceiveInput rejects empty received items', () => {
    const po: PurchaseOrderWithItems = {
      id: 'test-id',
      order_number: 'PO-20240101-0001',
      supplier_id: 'supplier-id',
      user_id: 'user-id',
      total_amount: 1000,
      status: 'approved',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{
        id: 'item-id',
        purchase_order_id: 'test-id',
        product_id: 'product-id',
        quantity: 10,
        received_quantity: 0,
        unit_price: 100,
        total_price: 1000,
        created_at: new Date().toISOString(),
      }],
    };
    
    const result = validateReceiveInput(po, []);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('item'))).toBe(true);
  });

  it('validateReceiveInput rejects negative received quantity', () => {
    const po: PurchaseOrderWithItems = {
      id: 'test-id',
      order_number: 'PO-20240101-0001',
      supplier_id: 'supplier-id',
      user_id: 'user-id',
      total_amount: 1000,
      status: 'approved',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{
        id: 'item-id',
        purchase_order_id: 'test-id',
        product_id: 'product-id',
        quantity: 10,
        received_quantity: 0,
        unit_price: 100,
        total_price: 1000,
        created_at: new Date().toISOString(),
      }],
    };
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: -5 }];
    const result = validateReceiveInput(po, receivedItems);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('negative'))).toBe(true);
  });

  it('validateReceiveInput rejects product not in PO', () => {
    const po: PurchaseOrderWithItems = {
      id: 'test-id',
      order_number: 'PO-20240101-0001',
      supplier_id: 'supplier-id',
      user_id: 'user-id',
      total_amount: 1000,
      status: 'approved',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{
        id: 'item-id',
        purchase_order_id: 'test-id',
        product_id: 'product-id',
        quantity: 10,
        received_quantity: 0,
        unit_price: 100,
        total_price: 1000,
        created_at: new Date().toISOString(),
      }],
    };
    
    const receivedItems: ReceivedItem[] = [{ productId: 'unknown-product', receivedQuantity: 10 }];
    const result = validateReceiveInput(po, receivedItems);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not found'))).toBe(true);
  });

  it('checkReceiptDiscrepancy detects no discrepancy for full receipt', () => {
    const poItems: PurchaseOrderItem[] = [{
      id: 'item-id',
      purchase_order_id: 'test-id',
      product_id: 'product-id',
      quantity: 10,
      received_quantity: 0,
      unit_price: 100,
      total_price: 1000,
      created_at: new Date().toISOString(),
    }];
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 10 }];
    const result = checkReceiptDiscrepancy(poItems, receivedItems);
    
    expect(result.hasDiscrepancy).toBe(false);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('checkReceiptDiscrepancy detects partial receipt', () => {
    const poItems: PurchaseOrderItem[] = [{
      id: 'item-id',
      purchase_order_id: 'test-id',
      product_id: 'product-id',
      quantity: 10,
      received_quantity: 0,
      unit_price: 100,
      total_price: 1000,
      created_at: new Date().toISOString(),
    }];
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 7 }];
    const result = checkReceiptDiscrepancy(poItems, receivedItems);
    
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].orderedQuantity).toBe(10);
    expect(result.discrepancies[0].receivedQuantity).toBe(7);
    expect(result.discrepancies[0].difference).toBe(-3);
  });

  it('generateDiscrepancyNotes returns empty string for no discrepancy', () => {
    const discrepancyInfo = { hasDiscrepancy: false, discrepancies: [] };
    const notes = generateDiscrepancyNotes(discrepancyInfo);
    expect(notes).toBe('');
  });

  it('generateDiscrepancyNotes generates notes for discrepancy', () => {
    const discrepancyInfo = {
      hasDiscrepancy: true,
      discrepancies: [{
        productId: 'product-id',
        orderedQuantity: 10,
        receivedQuantity: 7,
        difference: -3,
      }],
    };
    const notes = generateDiscrepancyNotes(discrepancyInfo);
    expect(notes).toContain('Discrepancy');
    expect(notes).toContain('10');
    expect(notes).toContain('7');
  });
});


/**
 * **Feature: purchase-order, Property 5: Partial Receipt Handling**
 * **Validates: Requirements 4.4, 4.5**
 * 
 * For any purchase order receipt where received quantity differs from ordered quantity, 
 * the system should accept the partial receipt AND record the discrepancy in the notes field.
 */
describe('Partial Receipt Handling', () => {
  describe('Property 5.1: Partial receipt is accepted', () => {
    it('PO can be received with quantities less than ordered', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            // Create partial receipt (receive less than ordered)
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: Math.max(0, item.quantity - 1),
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            return result.success === true && result.purchaseOrder !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PO can be received with quantities more than ordered', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            // Create over-receipt (receive more than ordered)
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity + 1,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            return result.success === true && result.purchaseOrder !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PO can be received with zero quantity for some items', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb.filter(po => po.items.length >= 2),
          (po) => {
            // Receive first item fully, rest with zero
            const receivedItems = po.items.map((item, index) => ({
              productId: item.product_id,
              receivedQuantity: index === 0 ? item.quantity : 0,
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            return result.success === true && result.purchaseOrder !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5.2: Discrepancy is recorded in notes', () => {
    it('notes contain discrepancy info when received != ordered', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          fc.integer({ min: 1, max: 10 }),
          (po, diff) => {
            // Create partial receipt with discrepancy
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: Math.max(0, item.quantity - diff),
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success) return false;
            
            // Check if there's a discrepancy
            const hasDiscrepancy = receivedItems.some((received, index) => 
              received.receivedQuantity !== po.items[index].quantity
            );
            
            if (hasDiscrepancy) {
              // Notes should contain discrepancy info
              return result.notes !== undefined && result.notes.includes('Discrepancy');
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notes contain ordered and received quantities', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb.filter(po => po.items.length === 1),
          fc.integer({ min: 1, max: 5 }),
          (po, diff) => {
            const orderedQty = po.items[0].quantity;
            const receivedQty = Math.max(0, orderedQty - diff);
            
            const receivedItems = [{
              productId: po.items[0].product_id,
              receivedQuantity: receivedQty,
            }];
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success) return false;
            
            if (orderedQty !== receivedQty) {
              // Notes should contain both quantities
              return (
                result.notes !== undefined &&
                result.notes.includes(String(orderedQty)) &&
                result.notes.includes(String(receivedQty))
              );
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5.3: checkReceiptDiscrepancy correctly identifies discrepancies', () => {
    it('detects discrepancy when any item has different quantity', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          fc.integer({ min: 1, max: 10 }),
          (po, diff) => {
            // Create receipt with at least one discrepancy
            const receivedItems = po.items.map((item, index) => ({
              productId: item.product_id,
              receivedQuantity: index === 0 ? Math.max(0, item.quantity - diff) : item.quantity,
            }));
            
            const discrepancyInfo = checkReceiptDiscrepancy(po.items, receivedItems);
            
            // Should detect discrepancy if first item has different quantity
            const firstItemDiff = po.items[0].quantity !== receivedItems[0].receivedQuantity;
            
            return discrepancyInfo.hasDiscrepancy === firstItemDiff;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no discrepancy when all quantities match', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          (po) => {
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: item.quantity,
            }));
            
            const discrepancyInfo = checkReceiptDiscrepancy(po.items, receivedItems);
            
            return discrepancyInfo.hasDiscrepancy === false && discrepancyInfo.discrepancies.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('discrepancy difference is calculated correctly', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb.filter(po => po.items.length === 1),
          fc.integer({ min: -10, max: 10 }),
          (po, diff) => {
            const orderedQty = po.items[0].quantity;
            const receivedQty = Math.max(0, orderedQty + diff);
            
            const receivedItems = [{
              productId: po.items[0].product_id,
              receivedQuantity: receivedQty,
            }];
            
            const discrepancyInfo = checkReceiptDiscrepancy(po.items, receivedItems);
            
            if (orderedQty === receivedQty) {
              return discrepancyInfo.hasDiscrepancy === false;
            }
            
            const expectedDiff = receivedQty - orderedQty;
            return (
              discrepancyInfo.hasDiscrepancy === true &&
              discrepancyInfo.discrepancies.length === 1 &&
              discrepancyInfo.discrepancies[0].difference === expectedDiff
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5.4: Stock updates reflect actual received quantities', () => {
    it('stock updates use received quantity, not ordered quantity', () => {
      fc.assert(
        fc.property(
          approvedPOWithItemsArb,
          fc.integer({ min: 1, max: 5 }),
          (po, diff) => {
            // Create partial receipt
            const receivedItems = po.items.map(item => ({
              productId: item.product_id,
              receivedQuantity: Math.max(1, item.quantity - diff),
            }));
            
            const result = receivePOLocally(po, receivedItems);
            
            if (!result.success || !result.stockUpdates) return false;
            
            // Each stock update should match received quantity, not ordered
            return receivedItems.every(received => {
              const stockUpdate = result.stockUpdates!.find(
                su => su.productId === received.productId
              );
              
              if (received.receivedQuantity === 0) {
                // No stock update for zero quantity
                return stockUpdate === undefined;
              }
              
              return stockUpdate && stockUpdate.quantityChange === received.receivedQuantity;
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Unit tests for partial receipt edge cases
describe('Partial Receipt Unit Tests', () => {
  it('partial receipt with all items at zero quantity still succeeds', () => {
    const po: PurchaseOrderWithItems = {
      id: 'test-id',
      order_number: 'PO-20240101-0001',
      supplier_id: 'supplier-id',
      user_id: 'user-id',
      total_amount: 1000,
      status: 'approved',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{
        id: 'item-id',
        purchase_order_id: 'test-id',
        product_id: 'product-id',
        quantity: 10,
        received_quantity: 0,
        unit_price: 100,
        total_price: 1000,
        created_at: new Date().toISOString(),
      }],
    };
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 0 }];
    const result = receivePOLocally(po, receivedItems);
    
    expect(result.success).toBe(true);
    expect(result.stockUpdates).toHaveLength(0); // No stock updates for zero quantity
    expect(result.stockMovements).toHaveLength(0);
  });

  it('over-receipt records positive difference', () => {
    const poItems: PurchaseOrderItem[] = [{
      id: 'item-id',
      purchase_order_id: 'test-id',
      product_id: 'product-id',
      quantity: 10,
      received_quantity: 0,
      unit_price: 100,
      total_price: 1000,
      created_at: new Date().toISOString(),
    }];
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 15 }];
    const result = checkReceiptDiscrepancy(poItems, receivedItems);
    
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancies[0].difference).toBe(5); // 15 - 10 = 5
  });

  it('under-receipt records negative difference', () => {
    const poItems: PurchaseOrderItem[] = [{
      id: 'item-id',
      purchase_order_id: 'test-id',
      product_id: 'product-id',
      quantity: 10,
      received_quantity: 0,
      unit_price: 100,
      total_price: 1000,
      created_at: new Date().toISOString(),
    }];
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 7 }];
    const result = checkReceiptDiscrepancy(poItems, receivedItems);
    
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancies[0].difference).toBe(-3); // 7 - 10 = -3
  });

  it('existing notes are preserved when adding discrepancy notes', () => {
    const po: PurchaseOrderWithItems = {
      id: 'test-id',
      order_number: 'PO-20240101-0001',
      supplier_id: 'supplier-id',
      user_id: 'user-id',
      total_amount: 1000,
      status: 'approved',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: 'Existing note',
      items: [{
        id: 'item-id',
        purchase_order_id: 'test-id',
        product_id: 'product-id',
        quantity: 10,
        received_quantity: 0,
        unit_price: 100,
        total_price: 1000,
        created_at: new Date().toISOString(),
      }],
    };
    
    const receivedItems: ReceivedItem[] = [{ productId: 'product-id', receivedQuantity: 7 }];
    const result = receivePOLocally(po, receivedItems);
    
    expect(result.success).toBe(true);
    expect(result.notes).toContain('Existing note');
    expect(result.notes).toContain('Discrepancy');
  });
});
