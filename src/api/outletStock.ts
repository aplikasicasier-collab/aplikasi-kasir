import { supabase } from '@/lib/supabaseClient';
import { OutletStock, Product } from '@/types';

// ============================================
// Types
// ============================================

export interface OutletStockItem {
  id: string;
  outlet_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  product?: Product;
}

export interface OutletStockBreakdown {
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  quantity: number;
}

// ============================================
// Outlet Stock Functions
// ============================================

/**
 * Get all stock items for a specific outlet
 * Requirements: 3.1 - Display stock quantities for selected outlet only
 */
export async function getOutletStock(outletId: string): Promise<OutletStockItem[]> {
  const { data, error } = await supabase
    .from('outlet_stock')
    .select(`
      id,
      outlet_id,
      product_id,
      quantity,
      updated_at,
      products:product_id (
        id,
        name,
        barcode,
        description,
        price,
        stock_quantity,
        min_stock,
        category_id,
        supplier_id,
        image_url,
        is_active,
        created_at,
        updated_at
      )
    `)
    .eq('outlet_id', outletId);

  if (error) {
    throw new Error(`Failed to fetch outlet stock: ${error.message}`);
  }

  // Transform the data to match OutletStockItem interface
  return (data || []).map(item => ({
    id: item.id,
    outlet_id: item.outlet_id,
    product_id: item.product_id,
    quantity: item.quantity,
    updated_at: item.updated_at,
    product: item.products as unknown as Product,
  }));
}


/**
 * Get stock breakdown by outlet for a specific product
 * Requirements: 3.4 - Show stock breakdown by outlet
 */
export async function getProductStockByOutlet(productId: string): Promise<OutletStockBreakdown[]> {
  const { data, error } = await supabase
    .from('outlet_stock')
    .select(`
      outlet_id,
      quantity,
      outlets:outlet_id (
        id,
        name,
        code,
        is_active
      )
    `)
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to fetch product stock by outlet: ${error.message}`);
  }

  // Transform and filter to only include active outlets
  return (data || [])
    .filter(item => {
      const outlet = item.outlets as unknown as { is_active: boolean } | null;
      return outlet?.is_active === true;
    })
    .map(item => {
      const outlet = item.outlets as unknown as { id: string; name: string; code: string } | null;
      return {
        outlet_id: item.outlet_id,
        outlet_name: outlet?.name || '',
        outlet_code: outlet?.code || '',
        quantity: item.quantity,
      };
    });
}

/**
 * Update stock quantity for a specific outlet and product
 * Requirements: 3.2 - Update stock for selected outlet only
 */
export async function updateOutletStock(
  outletId: string,
  productId: string,
  quantity: number
): Promise<OutletStock> {
  // Use upsert to handle both insert and update cases
  const { data, error } = await supabase
    .from('outlet_stock')
    .upsert(
      {
        outlet_id: outletId,
        product_id: productId,
        quantity,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'outlet_id,product_id',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update outlet stock: ${error.message}`);
  }

  return data as OutletStock;
}

/**
 * Adjust stock quantity for a specific outlet and product (add or subtract)
 * Requirements: 3.2 - Update stock for selected outlet only
 */
export async function adjustOutletStock(
  outletId: string,
  productId: string,
  adjustment: number
): Promise<OutletStock> {
  // First get current stock
  const { data: currentStock, error: fetchError } = await supabase
    .from('outlet_stock')
    .select('quantity')
    .eq('outlet_id', outletId)
    .eq('product_id', productId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch current stock: ${fetchError.message}`);
  }

  const currentQuantity = currentStock?.quantity ?? 0;
  const newQuantity = currentQuantity + adjustment;

  if (newQuantity < 0) {
    throw new Error('Stok tidak mencukupi untuk operasi ini');
  }

  return updateOutletStock(outletId, productId, newQuantity);
}

/**
 * Initialize stock to zero for all active outlets when a product is created
 * Requirements: 3.3 - Initialize stock to zero for all active outlets
 * Note: This is also handled by database trigger, but this function
 * can be called manually if needed
 */
export async function initializeProductStock(productId: string): Promise<void> {
  // Get all active outlets
  const { data: outlets, error: outletsError } = await supabase
    .from('outlets')
    .select('id')
    .eq('is_active', true);

  if (outletsError) {
    throw new Error(`Failed to fetch outlets: ${outletsError.message}`);
  }

  if (!outlets || outlets.length === 0) {
    return; // No active outlets to initialize
  }

  // Create stock records for each outlet with quantity 0
  const stockRecords = outlets.map(outlet => ({
    outlet_id: outlet.id,
    product_id: productId,
    quantity: 0,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('outlet_stock')
    .upsert(stockRecords, {
      onConflict: 'outlet_id,product_id',
      ignoreDuplicates: true,
    });

  if (insertError) {
    throw new Error(`Failed to initialize product stock: ${insertError.message}`);
  }
}


/**
 * Get stock for a specific product at a specific outlet
 */
export async function getOutletProductStock(
  outletId: string,
  productId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('outlet_stock')
    .select('quantity')
    .eq('outlet_id', outletId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch outlet product stock: ${error.message}`);
  }

  return data?.quantity ?? 0;
}

// ============================================
// Local/Pure Functions for Testing
// ============================================

/**
 * Pure function to update stock in a map (for testing without database)
 * Returns a new map with updated stock
 */
export function updateOutletStockLocal(
  stockMap: Map<string, Map<string, number>>,
  outletId: string,
  productId: string,
  quantity: number
): Map<string, Map<string, number>> {
  const newMap = new Map(stockMap);
  
  if (!newMap.has(outletId)) {
    newMap.set(outletId, new Map());
  }
  
  const outletStock = new Map(newMap.get(outletId)!);
  outletStock.set(productId, quantity);
  newMap.set(outletId, outletStock);
  
  return newMap;
}

/**
 * Pure function to get stock from a map (for testing without database)
 */
export function getOutletStockLocal(
  stockMap: Map<string, Map<string, number>>,
  outletId: string,
  productId: string
): number {
  return stockMap.get(outletId)?.get(productId) ?? 0;
}

/**
 * Pure function to initialize product stock for all outlets (for testing)
 */
export function initializeProductStockLocal(
  stockMap: Map<string, Map<string, number>>,
  outletIds: string[],
  productId: string
): Map<string, Map<string, number>> {
  const newMap = new Map(stockMap);
  
  for (const outletId of outletIds) {
    if (!newMap.has(outletId)) {
      newMap.set(outletId, new Map());
    }
    
    const outletStock = new Map(newMap.get(outletId)!);
    // Only set if not already exists
    if (!outletStock.has(productId)) {
      outletStock.set(productId, 0);
    }
    newMap.set(outletId, outletStock);
  }
  
  return newMap;
}

/**
 * Pure function to adjust stock (for testing without database)
 */
export function adjustOutletStockLocal(
  stockMap: Map<string, Map<string, number>>,
  outletId: string,
  productId: string,
  adjustment: number
): { success: boolean; newMap: Map<string, Map<string, number>>; error?: string } {
  const currentQuantity = getOutletStockLocal(stockMap, outletId, productId);
  const newQuantity = currentQuantity + adjustment;
  
  if (newQuantity < 0) {
    return {
      success: false,
      newMap: stockMap,
      error: 'Stok tidak mencukupi untuk operasi ini',
    };
  }
  
  const newMap = updateOutletStockLocal(stockMap, outletId, productId, newQuantity);
  return { success: true, newMap };
}
