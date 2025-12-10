import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  StockState,
  LocalTransfer,
  getStockFromState,
  setStockInState,
  validateTransferLocal,
  createTransferLocal,
  completeTransferLocal,
  approveTransferLocal,
  cancelTransferLocal,
  generateTransferNumberSync,
} from './stockTransfers';

// ============================================
// Arbitraries for generating test data
// ============================================

const uuidArb = fc.uuid();
const quantityArb = fc.integer({ min: 1, max: 1000 });
const stockQuantityArb = fc.integer({ min: 0, max: 10000 });

// Generate a transfer item
const transferItemArb = fc.record({
  product_id: uuidArb,
  quantity: quantityArb,
});

// Generate multiple unique transfer items
const transferItemsArb = fc.array(transferItemArb, { minLength: 1, maxLength: 5 })
  .map(items => {
    // Ensure unique product IDs
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.product_id)) return false;
      seen.add(item.product_id);
      return true;
    });
  })
  .filter(items => items.length > 0);

/**
 * **Feature: multi-outlet, Property 8: Stock Transfer Validation**
 * **Validates: Requirements 4.2**
 *
 * For any stock transfer request, the system should reject transfers where
 * source outlet has insufficient stock for any item.
 */
describe('Stock Transfer Validation', () => {
  it('Property 8.1: Transfer is rejected when source has insufficient stock', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 101, max: 200 }),
        (sourceOutletId, destOutletId, productId, availableStock, requestedQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up stock state with limited stock at source
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, availableStock);

          // Try to create transfer requesting more than available
          const items = [{ product_id: productId, quantity: requestedQuantity }];
          const result = createTransferLocal(stockState, sourceOutletId, destOutletId, items);

          // Should fail due to insufficient stock
          return result.success === false && 
                 result.error?.includes('Stok tidak mencukupi');
        }
      ),
      { numRuns: 100 }
    );
  });


  it('Property 8.2: Transfer is accepted when source has sufficient stock', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (sourceOutletId, destOutletId, productId, availableStock, requestedQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up stock state with sufficient stock at source
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, availableStock);

          // Try to create transfer requesting less than available
          const items = [{ product_id: productId, quantity: requestedQuantity }];
          const result = createTransferLocal(stockState, sourceOutletId, destOutletId, items);

          // Should succeed
          return result.success === true && result.transfer !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.3: Transfer to same outlet is rejected', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        stockQuantityArb,
        quantityArb,
        (outletId, productId, availableStock, requestedQuantity) => {
          // Set up stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, outletId, productId, availableStock);

          // Try to create transfer to same outlet
          const items = [{ product_id: productId, quantity: requestedQuantity }];
          const result = createTransferLocal(stockState, outletId, outletId, items);

          // Should fail due to same outlet
          return result.success === false && 
                 result.error?.includes('Outlet tujuan harus berbeda');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.4: Transfer with zero or negative quantity is rejected', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        stockQuantityArb,
        fc.integer({ min: -100, max: 0 }),
        (sourceOutletId, destOutletId, productId, availableStock, invalidQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, availableStock);

          // Try to create transfer with invalid quantity
          const items = [{ product_id: productId, quantity: invalidQuantity }];
          const result = createTransferLocal(stockState, sourceOutletId, destOutletId, items);

          // Should fail due to invalid quantity
          return result.success === false && 
                 result.error?.includes('Jumlah transfer harus lebih dari 0');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.5: Transfer with multiple items validates all items', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
        (sourceOutletId, destOutletId, productIds) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Ensure unique product IDs
          const uniqueProductIds = [...new Set(productIds)];
          if (uniqueProductIds.length < 2) return true;

          // Set up stock state - first product has enough, second doesn't
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, uniqueProductIds[0], 100);
          stockState = setStockInState(stockState, sourceOutletId, uniqueProductIds[1], 5);

          // Try to create transfer - first item OK, second exceeds stock
          const items = [
            { product_id: uniqueProductIds[0], quantity: 50 },
            { product_id: uniqueProductIds[1], quantity: 10 }, // Exceeds available 5
          ];
          const result = createTransferLocal(stockState, sourceOutletId, destOutletId, items);

          // Should fail due to insufficient stock for second item
          return result.success === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 9: Stock Transfer Completion**
 * **Validates: Requirements 4.3, 4.4**
 *
 * For any completed stock transfer:
 * - Source outlet stock should decrease by transfer quantity
 * - Destination outlet stock should increase by transfer quantity
 * - Stock movement records should be created for both outlets
 */
describe('Stock Transfer Completion', () => {
  it('Property 9.1: Completed transfer decreases source stock by exact quantity', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (sourceOutletId, destOutletId, productId, initialStock, transferQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up initial stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, initialStock);
          stockState = setStockInState(stockState, destOutletId, productId, 0);

          // Create and approve transfer
          const items = [{ product_id: productId, quantity: transferQuantity }];
          const createResult = createTransferLocal(stockState, sourceOutletId, destOutletId, items);
          
          if (!createResult.success || !createResult.transfer) return true;

          // Approve the transfer
          const approveResult = approveTransferLocal(createResult.transfer);
          if (!approveResult.success || !approveResult.transfer) return true;

          // Complete the transfer
          const completeResult = completeTransferLocal(stockState, approveResult.transfer);
          
          if (!completeResult.success || !completeResult.stockState) return false;

          // Verify source stock decreased by exact quantity
          const newSourceStock = getStockFromState(completeResult.stockState, sourceOutletId, productId);
          return newSourceStock === initialStock - transferQuantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9.2: Completed transfer increases destination stock by exact quantity', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 99 }),
        (sourceOutletId, destOutletId, productId, sourceStock, destInitialStock, transferQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up initial stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, sourceStock);
          stockState = setStockInState(stockState, destOutletId, productId, destInitialStock);

          // Create and approve transfer
          const items = [{ product_id: productId, quantity: transferQuantity }];
          const createResult = createTransferLocal(stockState, sourceOutletId, destOutletId, items);
          
          if (!createResult.success || !createResult.transfer) return true;

          const approveResult = approveTransferLocal(createResult.transfer);
          if (!approveResult.success || !approveResult.transfer) return true;

          // Complete the transfer
          const completeResult = completeTransferLocal(stockState, approveResult.transfer);
          
          if (!completeResult.success || !completeResult.stockState) return false;

          // Verify destination stock increased by exact quantity
          const newDestStock = getStockFromState(completeResult.stockState, destOutletId, productId);
          return newDestStock === destInitialStock + transferQuantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9.3: Stock movement records are created for both outlets', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (sourceOutletId, destOutletId, productId, initialStock, transferQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up initial stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, initialStock);

          // Create and approve transfer
          const items = [{ product_id: productId, quantity: transferQuantity }];
          const createResult = createTransferLocal(stockState, sourceOutletId, destOutletId, items);
          
          if (!createResult.success || !createResult.transfer) return true;

          const approveResult = approveTransferLocal(createResult.transfer);
          if (!approveResult.success || !approveResult.transfer) return true;

          // Complete the transfer
          const completeResult = completeTransferLocal(stockState, approveResult.transfer);
          
          if (!completeResult.success || !completeResult.stockMovements) return false;

          // Verify stock movements exist for both outlets
          const movements = completeResult.stockMovements;
          
          const sourceMovement = movements.find(
            m => m.outlet_id === sourceOutletId && m.product_id === productId
          );
          const destMovement = movements.find(
            m => m.outlet_id === destOutletId && m.product_id === productId
          );

          return (
            sourceMovement !== undefined &&
            sourceMovement.quantity === -transferQuantity &&
            destMovement !== undefined &&
            destMovement.quantity === transferQuantity
          );
        }
      ),
      { numRuns: 100 }
    );
  });


  it('Property 9.4: Total stock is conserved after transfer completion', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 99 }),
        (sourceOutletId, destOutletId, productId, sourceStock, destStock, transferQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up initial stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, sourceStock);
          stockState = setStockInState(stockState, destOutletId, productId, destStock);

          const totalBefore = sourceStock + destStock;

          // Create and approve transfer
          const items = [{ product_id: productId, quantity: transferQuantity }];
          const createResult = createTransferLocal(stockState, sourceOutletId, destOutletId, items);
          
          if (!createResult.success || !createResult.transfer) return true;

          const approveResult = approveTransferLocal(createResult.transfer);
          if (!approveResult.success || !approveResult.transfer) return true;

          // Complete the transfer
          const completeResult = completeTransferLocal(stockState, approveResult.transfer);
          
          if (!completeResult.success || !completeResult.stockState) return false;

          // Verify total stock is conserved
          const newSourceStock = getStockFromState(completeResult.stockState, sourceOutletId, productId);
          const newDestStock = getStockFromState(completeResult.stockState, destOutletId, productId);
          const totalAfter = newSourceStock + newDestStock;

          return totalBefore === totalAfter;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9.5: Only approved transfers can be completed', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (sourceOutletId, destOutletId, productId, initialStock, transferQuantity) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Set up initial stock state
          let stockState: StockState = new Map();
          stockState = setStockInState(stockState, sourceOutletId, productId, initialStock);

          // Create transfer (status = pending)
          const items = [{ product_id: productId, quantity: transferQuantity }];
          const createResult = createTransferLocal(stockState, sourceOutletId, destOutletId, items);
          
          if (!createResult.success || !createResult.transfer) return true;

          // Try to complete without approving first
          const completeResult = completeTransferLocal(stockState, createResult.transfer);

          // Should fail because transfer is not approved
          return completeResult.success === false &&
                 completeResult.error?.includes('approved');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9.6: Multi-item transfer updates all products correctly', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(uuidArb, { minLength: 2, maxLength: 4 }),
        fc.array(fc.integer({ min: 100, max: 500 }), { minLength: 2, maxLength: 4 }),
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 2, maxLength: 4 }),
        (sourceOutletId, destOutletId, productIds, initialStocks, quantities) => {
          // Skip if outlets are the same
          if (sourceOutletId === destOutletId) return true;

          // Ensure unique product IDs
          const uniqueProductIds = [...new Set(productIds)];
          if (uniqueProductIds.length < 2) return true;

          // Set up initial stock state
          let stockState: StockState = new Map();
          const items: Array<{ product_id: string; quantity: number }> = [];

          for (let i = 0; i < uniqueProductIds.length; i++) {
            const stock = initialStocks[i % initialStocks.length];
            const qty = quantities[i % quantities.length];
            stockState = setStockInState(stockState, sourceOutletId, uniqueProductIds[i], stock);
            stockState = setStockInState(stockState, destOutletId, uniqueProductIds[i], 0);
            items.push({ product_id: uniqueProductIds[i], quantity: qty });
          }

          // Create and approve transfer
          const createResult = createTransferLocal(stockState, sourceOutletId, destOutletId, items);
          if (!createResult.success || !createResult.transfer) return true;

          const approveResult = approveTransferLocal(createResult.transfer);
          if (!approveResult.success || !approveResult.transfer) return true;

          // Complete the transfer
          const completeResult = completeTransferLocal(stockState, approveResult.transfer);
          if (!completeResult.success || !completeResult.stockState) return false;

          // Verify all products were updated correctly
          for (let i = 0; i < uniqueProductIds.length; i++) {
            const productId = uniqueProductIds[i];
            const initialStock = initialStocks[i % initialStocks.length];
            const transferQty = quantities[i % quantities.length];

            const newSourceStock = getStockFromState(completeResult.stockState, sourceOutletId, productId);
            const newDestStock = getStockFromState(completeResult.stockState, destOutletId, productId);

            if (newSourceStock !== initialStock - transferQty) return false;
            if (newDestStock !== transferQty) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// Unit Tests for Edge Cases
// ============================================

describe('Stock Transfer Unit Tests', () => {
  it('generates transfer number with correct format', () => {
    const number = generateTransferNumberSync();
    const pattern = /^TRF-\d{8}-\d{4}$/;
    expect(pattern.test(number)).toBe(true);
  });

  it('transfer number contains current date', () => {
    const number = generateTransferNumberSync();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(number).toContain(today);
  });

  it('pending transfer does not change stock state', () => {
    let stockState: StockState = new Map();
    const sourceId = 'source-outlet';
    const destId = 'dest-outlet';
    const productId = 'product-1';

    stockState = setStockInState(stockState, sourceId, productId, 100);

    const result = createTransferLocal(
      stockState,
      sourceId,
      destId,
      [{ product_id: productId, quantity: 50 }]
    );

    expect(result.success).toBe(true);
    // Stock should remain unchanged for pending transfer
    expect(getStockFromState(stockState, sourceId, productId)).toBe(100);
  });

  it('cancelled transfer does not affect stock', () => {
    const transfer: LocalTransfer = {
      id: 'transfer-1',
      transfer_number: 'TRF-20231201-0001',
      source_outlet_id: 'source',
      destination_outlet_id: 'dest',
      status: 'pending',
      items: [{ product_id: 'product-1', quantity: 50 }],
      created_at: new Date().toISOString(),
    };

    const result = cancelTransferLocal(transfer);

    expect(result.success).toBe(true);
    expect(result.transfer?.status).toBe('cancelled');
  });

  it('completed transfer cannot be cancelled', () => {
    const transfer: LocalTransfer = {
      id: 'transfer-1',
      transfer_number: 'TRF-20231201-0001',
      source_outlet_id: 'source',
      destination_outlet_id: 'dest',
      status: 'completed',
      items: [{ product_id: 'product-1', quantity: 50 }],
      created_at: new Date().toISOString(),
    };

    const result = cancelTransferLocal(transfer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('sudah selesai');
  });

  it('already cancelled transfer cannot be cancelled again', () => {
    const transfer: LocalTransfer = {
      id: 'transfer-1',
      transfer_number: 'TRF-20231201-0001',
      source_outlet_id: 'source',
      destination_outlet_id: 'dest',
      status: 'cancelled',
      items: [{ product_id: 'product-1', quantity: 50 }],
      created_at: new Date().toISOString(),
    };

    const result = cancelTransferLocal(transfer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('sudah dibatalkan');
  });

  it('only pending transfer can be approved', () => {
    const approvedTransfer: LocalTransfer = {
      id: 'transfer-1',
      transfer_number: 'TRF-20231201-0001',
      source_outlet_id: 'source',
      destination_outlet_id: 'dest',
      status: 'approved',
      items: [{ product_id: 'product-1', quantity: 50 }],
      created_at: new Date().toISOString(),
    };

    const result = approveTransferLocal(approvedTransfer);

    expect(result.success).toBe(false);
    expect(result.error).toContain('pending');
  });

  it('getStockFromState returns 0 for non-existent entries', () => {
    const stockState: StockState = new Map();
    const stock = getStockFromState(stockState, 'non-existent', 'product');
    expect(stock).toBe(0);
  });

  it('setStockInState creates new outlet entry if not exists', () => {
    let stockState: StockState = new Map();
    stockState = setStockInState(stockState, 'new-outlet', 'product-1', 100);

    expect(stockState.has('new-outlet')).toBe(true);
    expect(getStockFromState(stockState, 'new-outlet', 'product-1')).toBe(100);
  });
});
