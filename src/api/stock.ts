import { supabase } from '@/lib/supabaseClient';
import { CartItem, Product } from '@/types';
import { AuditLogger } from '@/lib/auditLogger';

// ============================================
// Types
// ============================================

export interface StockUpdateInput {
  productId: string;
  quantity: number;
  movementType: 'in' | 'out' | 'adjustment';
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  outletId?: string; // Optional outlet ID for outlet-scoped stock operations
}

export interface StockValidationResult {
  valid: boolean;
  errors: StockValidationError[];
}

export interface StockValidationError {
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableStock: number;
  message: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  current_stock: number;
  min_stock: number;
  suggested_order_quantity: number;
  category_id?: string;
  supplier_id?: string;
}

// ============================================
// Stock Validation
// ============================================

/**
 * Validate that all cart items have sufficient stock
 * If outletId is provided, validates against outlet-specific stock
 */
export async function validateStockAvailability(
  items: CartItem[],
  outletId?: string
): Promise<StockValidationResult> {
  if (items.length === 0) {
    return { valid: true, errors: [] };
  }

  const productIds = items.map(item => item.product.id);
  const errors: StockValidationError[] = [];

  if (outletId) {
    // Validate against outlet-specific stock
    const { data: outletStock, error } = await supabase
      .from('outlet_stock')
      .select('product_id, quantity, products(id, name)')
      .eq('outlet_id', outletId)
      .in('product_id', productIds);

    if (error) {
      throw new Error(`Failed to validate outlet stock: ${error.message}`);
    }

    const stockMap = new Map(
      outletStock?.map(s => [s.product_id, { 
        id: s.product_id, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: (s.products as any)?.name || 'Unknown',
        stock_quantity: s.quantity 
      }]) || []
    );

    for (const item of items) {
      const stock = stockMap.get(item.product.id);
      
      if (!stock) {
        errors.push({
          productId: item.product.id,
          productName: item.product.name,
          requestedQuantity: item.quantity,
          availableStock: 0,
          message: `Produk "${item.product.name}" tidak tersedia di outlet ini`,
        });
        continue;
      }

      if (stock.stock_quantity < item.quantity) {
        errors.push({
          productId: item.product.id,
          productName: stock.name,
          requestedQuantity: item.quantity,
          availableStock: stock.stock_quantity,
          message: `Stok "${stock.name}" tidak cukup di outlet. Tersedia: ${stock.stock_quantity}, Diminta: ${item.quantity}`,
        });
      }
    }
  } else {
    // Validate against global product stock (legacy behavior)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity')
      .in('id', productIds);

    if (error) {
      throw new Error(`Failed to validate stock: ${error.message}`);
    }

    const stockMap = new Map(products?.map(p => [p.id, p]) || []);

    for (const item of items) {
      const product = stockMap.get(item.product.id);
      
      if (!product) {
        errors.push({
          productId: item.product.id,
          productName: item.product.name,
          requestedQuantity: item.quantity,
          availableStock: 0,
          message: `Produk "${item.product.name}" tidak ditemukan`,
        });
        continue;
      }

      if (product.stock_quantity < item.quantity) {
        errors.push({
          productId: item.product.id,
          productName: product.name,
          requestedQuantity: item.quantity,
          availableStock: product.stock_quantity,
          message: `Stok "${product.name}" tidak cukup. Tersedia: ${product.stock_quantity}, Diminta: ${item.quantity}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate stock availability without database call (for testing)
 */
export function validateStockAvailabilityLocal(
  items: CartItem[],
  stockMap: Map<string, number>
): StockValidationResult {
  const errors: StockValidationError[] = [];

  for (const item of items) {
    const availableStock = stockMap.get(item.product.id) ?? 0;

    if (availableStock < item.quantity) {
      errors.push({
        productId: item.product.id,
        productName: item.product.name,
        requestedQuantity: item.quantity,
        availableStock,
        message: `Stok "${item.product.name}" tidak cukup. Tersedia: ${availableStock}, Diminta: ${item.quantity}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


// ============================================
// Stock Update Operations
// ============================================

/**
 * Update stock for a single product
 * If outletId is provided, updates outlet-specific stock instead of global stock
 */
export async function updateStock(input: StockUpdateInput): Promise<void> {
  const { productId, quantity, movementType, referenceType, referenceId, notes, outletId } = input;

  // Calculate stock change based on movement type
  const stockChange = movementType === 'out' ? -quantity : quantity;

  if (outletId) {
    // Update outlet-specific stock
    const { data: existingStock, error: fetchError } = await supabase
      .from('outlet_stock')
      .select('id, quantity')
      .eq('outlet_id', outletId)
      .eq('product_id', productId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch outlet stock: ${fetchError.message}`);
    }

    if (existingStock) {
      // Update existing outlet stock
      const newQuantity = existingStock.quantity + stockChange;
      const { error: updateError } = await supabase
        .from('outlet_stock')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existingStock.id);

      if (updateError) {
        throw new Error(`Failed to update outlet stock: ${updateError.message}`);
      }
    } else {
      // Create new outlet stock record
      const { error: insertError } = await supabase
        .from('outlet_stock')
        .insert({
          outlet_id: outletId,
          product_id: productId,
          quantity: stockChange,
        });

      if (insertError) {
        throw new Error(`Failed to create outlet stock: ${insertError.message}`);
      }
    }
  } else {
    // Update global product stock (legacy behavior)
    const { error: updateError } = await supabase.rpc('update_product_stock', {
      p_product_id: productId,
      p_quantity_change: stockChange,
    });

    // If RPC doesn't exist, use direct update
    if (updateError?.code === 'PGRST202') {
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch product stock: ${fetchError.message}`);
      }

      const newStock = product.stock_quantity + stockChange;

      const { error: directUpdateError } = await supabase
        .from('products')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (directUpdateError) {
        throw new Error(`Failed to update stock: ${directUpdateError.message}`);
      }
    } else if (updateError) {
      throw new Error(`Failed to update stock: ${updateError.message}`);
    }
  }

  // Create stock movement record with outlet_id
  const { error: movementError } = await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      movement_type: movementType,
      quantity,
      reference_type: referenceType,
      reference_id: referenceId,
      notes,
      outlet_id: outletId || null,
    });

  if (movementError) {
    throw new Error(`Failed to create stock movement: ${movementError.message}`);
  }

  // Log stock adjustment
  // Requirements: 2.3 - Log stock adjustment with reason
  if (movementType === 'adjustment' || (movementType !== 'out' && referenceType !== 'transaction')) {
    await AuditLogger.logEvent('stock_adjustment', 'product', productId, {
      movement_type: movementType,
      quantity,
      stock_change: stockChange,
      reference_type: referenceType,
      reference_id: referenceId,
      notes,
      outlet_id: outletId || null,
    });
  }
}

/**
 * Bulk update stock for multiple products (used after transaction)
 */
export async function bulkUpdateStock(inputs: StockUpdateInput[]): Promise<void> {
  for (const input of inputs) {
    await updateStock(input);
  }
}

/**
 * Update stock after a transaction (reduce stock for sold items)
 * If outletId is provided, deducts from outlet-specific stock
 */
export async function updateStockAfterTransaction(
  items: CartItem[],
  transactionId: string,
  outletId?: string
): Promise<void> {
  const stockUpdates: StockUpdateInput[] = items.map(item => ({
    productId: item.product.id,
    quantity: item.quantity,
    movementType: 'out',
    referenceType: 'transaction',
    referenceId: transactionId,
    notes: `Penjualan - Transaksi`,
    outletId,
  }));

  await bulkUpdateStock(stockUpdates);
}

/**
 * Calculate stock change based on movement type
 */
export function calculateStockChange(quantity: number, movementType: 'in' | 'out' | 'adjustment'): number {
  return movementType === 'out' ? -quantity : quantity;
}

/**
 * Simulate stock reduction (for testing without database)
 */
export function simulateStockReduction(
  currentStock: Map<string, number>,
  items: CartItem[]
): Map<string, number> {
  const newStock = new Map(currentStock);

  for (const item of items) {
    const current = newStock.get(item.product.id) ?? 0;
    newStock.set(item.product.id, current - item.quantity);
  }

  return newStock;
}


// ============================================
// Low Stock Query Functions
// ============================================

/**
 * Get products where current stock is at or below minimum stock level
 * **Feature: purchase-order, Property 8: Low Stock Query**
 * **Validates: Requirements 6.1, 6.3**
 */
export async function getLowStockProducts(): Promise<LowStockProduct[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, stock_quantity, min_stock, category_id, supplier_id')
    .filter('is_active', 'eq', true);

  if (error) {
    throw new Error(`Failed to fetch low stock products: ${error.message}`);
  }

  // Filter products where stock <= min_stock and map to LowStockProduct
  const lowStockProducts: LowStockProduct[] = (products || [])
    .filter(p => p.stock_quantity <= p.min_stock)
    .map(p => ({
      id: p.id,
      name: p.name,
      current_stock: p.stock_quantity,
      min_stock: p.min_stock,
      suggested_order_quantity: calculateSuggestedOrderQuantity(p.stock_quantity, p.min_stock),
      category_id: p.category_id,
      supplier_id: p.supplier_id,
    }));

  return lowStockProducts;
}

/**
 * Calculate suggested order quantity based on current stock and min stock
 * Formula: (min_stock * 2) - current_stock
 * This ensures stock reaches twice the minimum level after restocking
 */
export function calculateSuggestedOrderQuantity(currentStock: number, minStock: number): number {
  const targetStock = minStock * 2;
  const suggestedQuantity = targetStock - currentStock;
  return Math.max(suggestedQuantity, 1); // At least 1 unit
}

/**
 * Filter products to get low stock items (for local/testing use)
 * Returns products where stock_quantity <= min_stock
 */
export function filterLowStockProducts(products: Product[]): LowStockProduct[] {
  return products
    .filter(p => p.stock_quantity <= p.min_stock && p.is_active)
    .map(p => ({
      id: p.id,
      name: p.name,
      current_stock: p.stock_quantity,
      min_stock: p.min_stock,
      suggested_order_quantity: calculateSuggestedOrderQuantity(p.stock_quantity, p.min_stock),
      category_id: p.category_id,
      supplier_id: p.supplier_id,
    }));
}
