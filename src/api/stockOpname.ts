/**
 * Stock Opname API
 * Provides CRUD operations for stock opname (inventory count) sessions
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';

// =====================================================
// INTERFACES
// =====================================================

export interface StockOpname {
  id: string;
  opname_number: string;
  outlet_id: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  items?: StockOpnameItem[];
}

export interface StockOpnameItem {
  id: string;
  opname_id: string;
  product_id: string;
  product?: Product;
  system_stock: number;
  actual_stock: number;
  discrepancy: number;
  scanned_at: string;
}

export interface StockAdjustment {
  id: string;
  opname_id: string | null;
  product_id: string;
  outlet_id: string | null;
  previous_stock: number;
  new_stock: number;
  adjustment: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateOpnameInput {
  outlet_id?: string;
  notes?: string;
}

export interface OpnameFilters {
  status?: 'in_progress' | 'completed' | 'cancelled';
  outlet_id?: string;
  start_date?: string;
  end_date?: string;
}


// =====================================================
// STOCK OPNAME CRUD FUNCTIONS
// Requirements: 5.1, 5.5
// =====================================================

/**
 * Generate a unique opname number
 * Format: OPN-YYYYMMDD-XXXX
 */
function generateOpnameNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OPN-${dateStr}-${random}`;
}

/**
 * Create a new stock opname session
 * Requirements: 5.1
 */
export async function createStockOpname(input: CreateOpnameInput): Promise<StockOpname> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('User not authenticated');
  }

  const opnameNumber = generateOpnameNumber();

  const { data, error } = await supabase
    .from('stock_opnames')
    .insert({
      opname_number: opnameNumber,
      outlet_id: input.outlet_id || null,
      notes: input.notes || null,
      created_by: userData.user.id,
      status: 'in_progress'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create stock opname: ${error.message}`);
  }

  return data as StockOpname;
}

/**
 * Get stock opnames with optional filters
 * Requirements: 5.5
 */
export async function getStockOpnames(filters?: OpnameFilters): Promise<StockOpname[]> {
  let query = supabase
    .from('stock_opnames')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  if (filters?.start_date) {
    query = query.gte('created_at', filters.start_date);
  }

  if (filters?.end_date) {
    query = query.lte('created_at', filters.end_date);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch stock opnames: ${error.message}`);
  }

  return (data || []) as StockOpname[];
}

/**
 * Get a single stock opname by ID with its items
 * Requirements: 5.1
 */
export async function getStockOpnameById(id: string): Promise<StockOpname | null> {
  const { data: opname, error: opnameError } = await supabase
    .from('stock_opnames')
    .select('*')
    .eq('id', id)
    .single();

  if (opnameError) {
    if (opnameError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch stock opname: ${opnameError.message}`);
  }

  if (!opname) {
    return null;
  }

  // Fetch items with product details
  const { data: items, error: itemsError } = await supabase
    .from('stock_opname_items')
    .select(`
      *,
      product:products(id, name, barcode, price, stock_quantity)
    `)
    .eq('opname_id', id)
    .order('scanned_at', { ascending: false });

  if (itemsError) {
    throw new Error(`Failed to fetch opname items: ${itemsError.message}`);
  }

  return {
    ...opname,
    items: items || []
  } as StockOpname;
}


// =====================================================
// OPNAME ITEM FUNCTIONS
// Requirements: 5.2, 5.3
// =====================================================

/**
 * Calculate discrepancy between actual and system stock
 * Requirements: 5.3
 */
export function calculateDiscrepancy(actualStock: number, systemStock: number): number {
  return actualStock - systemStock;
}

/**
 * Add an item to a stock opname session
 * Requirements: 5.2, 5.3
 */
export async function addOpnameItem(
  opnameId: string,
  productId: string,
  actualStock: number
): Promise<StockOpnameItem> {
  // Get current system stock for the product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw new Error('Product not found');
  }

  const systemStock = product.stock_quantity;

  // Check if item already exists for this opname
  const { data: existingItem } = await supabase
    .from('stock_opname_items')
    .select('id')
    .eq('opname_id', opnameId)
    .eq('product_id', productId)
    .single();

  if (existingItem) {
    // Update existing item
    return updateOpnameItem(existingItem.id, actualStock);
  }

  // Insert new item
  const { data, error } = await supabase
    .from('stock_opname_items')
    .insert({
      opname_id: opnameId,
      product_id: productId,
      system_stock: systemStock,
      actual_stock: actualStock
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add opname item: ${error.message}`);
  }

  return data as StockOpnameItem;
}

/**
 * Update an existing opname item's actual stock
 * Requirements: 5.2, 5.3
 */
export async function updateOpnameItem(
  itemId: string,
  actualStock: number
): Promise<StockOpnameItem> {
  const { data, error } = await supabase
    .from('stock_opname_items')
    .update({
      actual_stock: actualStock
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update opname item: ${error.message}`);
  }

  return data as StockOpnameItem;
}


// =====================================================
// OPNAME COMPLETION FUNCTIONS
// Requirements: 5.4
// =====================================================

/**
 * Complete a stock opname session
 * Updates product stock quantities and creates adjustment records
 * Requirements: 5.4
 */
export async function completeStockOpname(id: string): Promise<StockOpname> {
  // Get the opname with items
  const opname = await getStockOpnameById(id);
  
  if (!opname) {
    throw new Error('Stock opname not found');
  }

  if (opname.status !== 'in_progress') {
    throw new Error('Stock opname is not in progress');
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('User not authenticated');
  }

  // Process each item with discrepancy
  const items = opname.items || [];
  for (const item of items) {
    if (item.discrepancy !== 0) {
      // Create stock adjustment record
      const { error: adjustmentError } = await supabase
        .from('stock_adjustments')
        .insert({
          opname_id: id,
          product_id: item.product_id,
          outlet_id: opname.outlet_id,
          previous_stock: item.system_stock,
          new_stock: item.actual_stock,
          adjustment: item.discrepancy,
          reason: 'stock_opname',
          created_by: userData.user.id
        });

      if (adjustmentError) {
        throw new Error(`Failed to create adjustment: ${adjustmentError.message}`);
      }

      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: item.actual_stock,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.product_id);

      if (updateError) {
        throw new Error(`Failed to update product stock: ${updateError.message}`);
      }

      // Update outlet_stock if outlet_id is specified
      if (opname.outlet_id) {
        await supabase
          .from('outlet_stock')
          .update({
            quantity: item.actual_stock,
            updated_at: new Date().toISOString()
          })
          .eq('outlet_id', opname.outlet_id)
          .eq('product_id', item.product_id);
      }
    }
  }

  // Mark opname as completed
  const { data, error } = await supabase
    .from('stock_opnames')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete stock opname: ${error.message}`);
  }

  return data as StockOpname;
}

/**
 * Cancel a stock opname session
 * Requirements: 5.4
 */
export async function cancelStockOpname(id: string): Promise<StockOpname> {
  const opname = await getStockOpnameById(id);
  
  if (!opname) {
    throw new Error('Stock opname not found');
  }

  if (opname.status !== 'in_progress') {
    throw new Error('Stock opname is not in progress');
  }

  const { data, error } = await supabase
    .from('stock_opnames')
    .update({
      status: 'cancelled'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel stock opname: ${error.message}`);
  }

  return data as StockOpname;
}

/**
 * Get stock adjustments for an opname
 * Requirements: 5.5
 */
export async function getStockAdjustments(opnameId: string): Promise<StockAdjustment[]> {
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*')
    .eq('opname_id', opnameId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch stock adjustments: ${error.message}`);
  }

  return (data || []) as StockAdjustment[];
}
