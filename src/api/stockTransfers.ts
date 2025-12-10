import { supabase } from '@/lib/supabaseClient';
import { Outlet, Product } from '@/types';

// ============================================
// Types
// ============================================

export type TransferStatus = 'pending' | 'approved' | 'completed' | 'cancelled';

export interface StockTransfer {
  id: string;
  transfer_number: string;
  source_outlet_id: string;
  source_outlet?: Outlet;
  destination_outlet_id: string;
  destination_outlet?: Outlet;
  status: TransferStatus;
  notes: string | null;
  items?: StockTransferItem[];
  created_by: string;
  approved_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  created_at: string;
}

export interface CreateTransferInput {
  source_outlet_id: string;
  destination_outlet_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  notes?: string;
}

export interface TransferFilters {
  source_outlet_id?: string;
  destination_outlet_id?: string;
  status?: TransferStatus;
  from_date?: string;
  to_date?: string;
}

export interface StockMovementRecord {
  outlet_id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'transfer_in' | 'transfer_out';
  quantity: number;
  reference_type: string;
  reference_id: string;
}


// ============================================
// Transfer Number Generation
// ============================================

/**
 * Generates a transfer number with format TRF-YYYYMMDD-XXXX
 * XXXX is a random 4-digit number
 */
export function generateTransferNumberSync(): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TRF-${dateStr}-${randomNum}`;
}

/**
 * Generates a unique transfer number, checking database for uniqueness
 */
export async function generateTransferNumber(): Promise<string> {
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const number = generateTransferNumberSync();
    
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('id')
      .eq('transfer_number', number)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to check transfer number: ${error.message}`);
    }
    
    if (!data) {
      return number;
    }
  }
  
  throw new Error('Failed to generate unique transfer number after 3 attempts');
}

// ============================================
// Stock Transfer CRUD Functions
// ============================================

/**
 * Create a new stock transfer
 * Requirements: 4.1, 4.2 - Record transfer and validate source stock
 */
export async function createStockTransfer(
  input: CreateTransferInput,
  userId: string
): Promise<StockTransfer> {
  // Validate source and destination are different
  if (input.source_outlet_id === input.destination_outlet_id) {
    throw new Error('Outlet tujuan harus berbeda dari outlet asal');
  }

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new Error('Transfer harus memiliki minimal satu item');
  }

  // Validate all quantities are positive
  for (const item of input.items) {
    if (item.quantity <= 0) {
      throw new Error('Jumlah transfer harus lebih dari 0');
    }
  }

  // Check source outlet has sufficient stock for all items
  for (const item of input.items) {
    const { data: stockData, error: stockError } = await supabase
      .from('outlet_stock')
      .select('quantity')
      .eq('outlet_id', input.source_outlet_id)
      .eq('product_id', item.product_id)
      .maybeSingle();

    if (stockError) {
      throw new Error(`Failed to check stock: ${stockError.message}`);
    }

    const availableStock = stockData?.quantity ?? 0;
    if (availableStock < item.quantity) {
      throw new Error(`Stok tidak mencukupi di outlet asal untuk produk ${item.product_id}`);
    }
  }

  // Generate transfer number
  const transferNumber = await generateTransferNumber();

  // Create transfer record
  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .insert({
      transfer_number: transferNumber,
      source_outlet_id: input.source_outlet_id,
      destination_outlet_id: input.destination_outlet_id,
      status: 'pending',
      notes: input.notes?.trim() || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (transferError) {
    throw new Error(`Failed to create transfer: ${transferError.message}`);
  }

  // Create transfer items
  const itemsToInsert = input.items.map(item => ({
    transfer_id: transfer.id,
    product_id: item.product_id,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from('stock_transfer_items')
    .insert(itemsToInsert);

  if (itemsError) {
    // Rollback transfer if items fail
    await supabase.from('stock_transfers').delete().eq('id', transfer.id);
    throw new Error(`Failed to create transfer items: ${itemsError.message}`);
  }

  return transfer as StockTransfer;
}


/**
 * Get stock transfers with optional filters
 * Requirements: 4.5 - Display transfer history with status and timestamps
 */
export async function getStockTransfers(
  filters?: TransferFilters
): Promise<StockTransfer[]> {
  let query = supabase
    .from('stock_transfers')
    .select(`
      *,
      source_outlet:source_outlet_id (id, code, name),
      destination_outlet:destination_outlet_id (id, code, name),
      items:stock_transfer_items (
        id,
        transfer_id,
        product_id,
        quantity,
        created_at,
        product:product_id (id, name, barcode)
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.source_outlet_id) {
    query = query.eq('source_outlet_id', filters.source_outlet_id);
  }

  if (filters?.destination_outlet_id) {
    query = query.eq('destination_outlet_id', filters.destination_outlet_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.from_date) {
    query = query.gte('created_at', filters.from_date);
  }

  if (filters?.to_date) {
    query = query.lte('created_at', filters.to_date);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch transfers: ${error.message}`);
  }

  return (data || []) as StockTransfer[];
}

/**
 * Get a single stock transfer by ID
 */
export async function getStockTransferById(id: string): Promise<StockTransfer | null> {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select(`
      *,
      source_outlet:source_outlet_id (id, code, name),
      destination_outlet:destination_outlet_id (id, code, name),
      items:stock_transfer_items (
        id,
        transfer_id,
        product_id,
        quantity,
        created_at,
        product:product_id (id, name, barcode)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as StockTransfer;
}

/**
 * Approve a stock transfer
 * Requirements: 4.3 - Approve transfer (status change only, no stock movement yet)
 */
export async function approveStockTransfer(
  id: string,
  userId: string
): Promise<StockTransfer> {
  // Get current transfer
  const transfer = await getStockTransferById(id);
  
  if (!transfer) {
    throw new Error('Transfer tidak ditemukan');
  }

  if (transfer.status !== 'pending') {
    throw new Error('Hanya transfer dengan status pending yang dapat disetujui');
  }

  const { data, error } = await supabase
    .from('stock_transfers')
    .update({
      status: 'approved',
      approved_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve transfer: ${error.message}`);
  }

  return data as StockTransfer;
}


/**
 * Complete a stock transfer - updates stock at both outlets
 * Requirements: 4.3, 4.4 - Decrease source, increase destination, create stock_movement records
 */
export async function completeStockTransfer(id: string): Promise<StockTransfer> {
  // Get current transfer with items
  const transfer = await getStockTransferById(id);
  
  if (!transfer) {
    throw new Error('Transfer tidak ditemukan');
  }

  if (transfer.status !== 'approved') {
    throw new Error('Hanya transfer dengan status approved yang dapat diselesaikan');
  }

  if (!transfer.items || transfer.items.length === 0) {
    throw new Error('Transfer tidak memiliki item');
  }

  // Re-validate source stock before completing
  for (const item of transfer.items) {
    const { data: stockData, error: stockError } = await supabase
      .from('outlet_stock')
      .select('quantity')
      .eq('outlet_id', transfer.source_outlet_id)
      .eq('product_id', item.product_id)
      .maybeSingle();

    if (stockError) {
      throw new Error(`Failed to check stock: ${stockError.message}`);
    }

    const availableStock = stockData?.quantity ?? 0;
    if (availableStock < item.quantity) {
      throw new Error(`Stok tidak mencukupi di outlet asal untuk menyelesaikan transfer`);
    }
  }

  // Process each item - decrease source, increase destination
  for (const item of transfer.items) {
    // Decrease source outlet stock
    const { data: sourceStock } = await supabase
      .from('outlet_stock')
      .select('quantity')
      .eq('outlet_id', transfer.source_outlet_id)
      .eq('product_id', item.product_id)
      .single();

    await supabase
      .from('outlet_stock')
      .upsert({
        outlet_id: transfer.source_outlet_id,
        product_id: item.product_id,
        quantity: (sourceStock?.quantity ?? 0) - item.quantity,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'outlet_id,product_id' });

    // Increase destination outlet stock
    const { data: destStock } = await supabase
      .from('outlet_stock')
      .select('quantity')
      .eq('outlet_id', transfer.destination_outlet_id)
      .eq('product_id', item.product_id)
      .maybeSingle();

    await supabase
      .from('outlet_stock')
      .upsert({
        outlet_id: transfer.destination_outlet_id,
        product_id: item.product_id,
        quantity: (destStock?.quantity ?? 0) + item.quantity,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'outlet_id,product_id' });

    // Create stock movement records for both outlets
    await supabase.from('stock_movements').insert([
      {
        product_id: item.product_id,
        movement_type: 'out',
        quantity: -item.quantity,
        reference_type: 'stock_transfer',
        reference_id: transfer.id,
        outlet_id: transfer.source_outlet_id,
        notes: `Transfer keluar ke ${transfer.destination_outlet?.name || transfer.destination_outlet_id}`,
      },
      {
        product_id: item.product_id,
        movement_type: 'in',
        quantity: item.quantity,
        reference_type: 'stock_transfer',
        reference_id: transfer.id,
        outlet_id: transfer.destination_outlet_id,
        notes: `Transfer masuk dari ${transfer.source_outlet?.name || transfer.source_outlet_id}`,
      },
    ]);
  }

  // Update transfer status to completed
  const { data, error } = await supabase
    .from('stock_transfers')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete transfer: ${error.message}`);
  }

  return data as StockTransfer;
}

/**
 * Cancel a stock transfer
 * Requirements: 4.5 - Allow cancellation of pending/approved transfers
 */
export async function cancelStockTransfer(id: string): Promise<StockTransfer> {
  // Get current transfer
  const transfer = await getStockTransferById(id);
  
  if (!transfer) {
    throw new Error('Transfer tidak ditemukan');
  }

  if (transfer.status === 'completed') {
    throw new Error('Transfer yang sudah selesai tidak dapat dibatalkan');
  }

  if (transfer.status === 'cancelled') {
    throw new Error('Transfer sudah dibatalkan');
  }

  const { data, error } = await supabase
    .from('stock_transfers')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel transfer: ${error.message}`);
  }

  return data as StockTransfer;
}


// ============================================
// Local/Pure Functions for Testing
// ============================================

/**
 * Stock state representation for testing
 * Map<outlet_id, Map<product_id, quantity>>
 */
export type StockState = Map<string, Map<string, number>>;

/**
 * Transfer state for testing
 */
export interface LocalTransfer {
  id: string;
  transfer_number: string;
  source_outlet_id: string;
  destination_outlet_id: string;
  status: TransferStatus;
  items: Array<{ product_id: string; quantity: number }>;
  created_at: string;
}

/**
 * Result of a transfer operation
 */
export interface TransferResult {
  success: boolean;
  error?: string;
  transfer?: LocalTransfer;
  stockState?: StockState;
  stockMovements?: StockMovementRecord[];
}

/**
 * Get stock for a specific outlet and product from state
 */
export function getStockFromState(
  state: StockState,
  outletId: string,
  productId: string
): number {
  return state.get(outletId)?.get(productId) ?? 0;
}

/**
 * Set stock for a specific outlet and product in state
 * Returns a new state (immutable)
 */
export function setStockInState(
  state: StockState,
  outletId: string,
  productId: string,
  quantity: number
): StockState {
  const newState = new Map(state);
  
  if (!newState.has(outletId)) {
    newState.set(outletId, new Map());
  }
  
  const outletStock = new Map(newState.get(outletId)!);
  outletStock.set(productId, quantity);
  newState.set(outletId, outletStock);
  
  return newState;
}

/**
 * Validate a transfer request (pure function)
 * Requirements: 4.2 - Validate source outlet has sufficient stock
 */
export function validateTransferLocal(
  stockState: StockState,
  sourceOutletId: string,
  destinationOutletId: string,
  items: Array<{ product_id: string; quantity: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check source and destination are different
  if (sourceOutletId === destinationOutletId) {
    errors.push('Outlet tujuan harus berbeda dari outlet asal');
  }

  // Check items exist
  if (!items || items.length === 0) {
    errors.push('Transfer harus memiliki minimal satu item');
  }

  // Check each item
  for (const item of items) {
    // Check quantity is positive
    if (item.quantity <= 0) {
      errors.push(`Jumlah transfer harus lebih dari 0 untuk produk ${item.product_id}`);
      continue;
    }

    // Check sufficient stock at source
    const availableStock = getStockFromState(stockState, sourceOutletId, item.product_id);
    if (availableStock < item.quantity) {
      errors.push(`Stok tidak mencukupi di outlet asal untuk produk ${item.product_id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a transfer locally (pure function for testing)
 */
export function createTransferLocal(
  stockState: StockState,
  sourceOutletId: string,
  destinationOutletId: string,
  items: Array<{ product_id: string; quantity: number }>
): TransferResult {
  // Validate first
  const validation = validateTransferLocal(stockState, sourceOutletId, destinationOutletId, items);
  
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0],
    };
  }

  // Create transfer object
  const transfer: LocalTransfer = {
    id: crypto.randomUUID(),
    transfer_number: generateTransferNumberSync(),
    source_outlet_id: sourceOutletId,
    destination_outlet_id: destinationOutletId,
    status: 'pending',
    items: items.map(item => ({ ...item })),
    created_at: new Date().toISOString(),
  };

  return {
    success: true,
    transfer,
    stockState, // Stock not changed yet for pending transfer
  };
}


/**
 * Complete a transfer locally (pure function for testing)
 * Requirements: 4.3, 4.4 - Decrease source, increase destination, create movements
 */
export function completeTransferLocal(
  stockState: StockState,
  transfer: LocalTransfer
): TransferResult {
  // Can only complete approved transfers
  if (transfer.status !== 'approved') {
    return {
      success: false,
      error: 'Hanya transfer dengan status approved yang dapat diselesaikan',
    };
  }

  // Re-validate stock availability
  const validation = validateTransferLocal(
    stockState,
    transfer.source_outlet_id,
    transfer.destination_outlet_id,
    transfer.items
  );

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0],
    };
  }

  // Apply stock changes
  let newState = stockState;
  const movements: StockMovementRecord[] = [];

  for (const item of transfer.items) {
    // Decrease source
    const sourceStock = getStockFromState(newState, transfer.source_outlet_id, item.product_id);
    newState = setStockInState(
      newState,
      transfer.source_outlet_id,
      item.product_id,
      sourceStock - item.quantity
    );

    // Increase destination
    const destStock = getStockFromState(newState, transfer.destination_outlet_id, item.product_id);
    newState = setStockInState(
      newState,
      transfer.destination_outlet_id,
      item.product_id,
      destStock + item.quantity
    );

    // Record movements
    movements.push({
      outlet_id: transfer.source_outlet_id,
      product_id: item.product_id,
      movement_type: 'transfer_out',
      quantity: -item.quantity,
      reference_type: 'stock_transfer',
      reference_id: transfer.id,
    });

    movements.push({
      outlet_id: transfer.destination_outlet_id,
      product_id: item.product_id,
      movement_type: 'transfer_in',
      quantity: item.quantity,
      reference_type: 'stock_transfer',
      reference_id: transfer.id,
    });
  }

  // Update transfer status
  const completedTransfer: LocalTransfer = {
    ...transfer,
    status: 'completed',
  };

  return {
    success: true,
    transfer: completedTransfer,
    stockState: newState,
    stockMovements: movements,
  };
}

/**
 * Approve a transfer locally (pure function for testing)
 */
export function approveTransferLocal(transfer: LocalTransfer): TransferResult {
  if (transfer.status !== 'pending') {
    return {
      success: false,
      error: 'Hanya transfer dengan status pending yang dapat disetujui',
    };
  }

  const approvedTransfer: LocalTransfer = {
    ...transfer,
    status: 'approved',
  };

  return {
    success: true,
    transfer: approvedTransfer,
  };
}

/**
 * Cancel a transfer locally (pure function for testing)
 */
export function cancelTransferLocal(transfer: LocalTransfer): TransferResult {
  if (transfer.status === 'completed') {
    return {
      success: false,
      error: 'Transfer yang sudah selesai tidak dapat dibatalkan',
    };
  }

  if (transfer.status === 'cancelled') {
    return {
      success: false,
      error: 'Transfer sudah dibatalkan',
    };
  }

  const cancelledTransfer: LocalTransfer = {
    ...transfer,
    status: 'cancelled',
  };

  return {
    success: true,
    transfer: cancelledTransfer,
  };
}

/**
 * Calculate total stock change for an outlet from a completed transfer
 */
export function calculateStockChange(
  transfer: LocalTransfer,
  outletId: string,
  productId: string
): number {
  if (transfer.status !== 'completed') {
    return 0;
  }

  const item = transfer.items.find(i => i.product_id === productId);
  if (!item) {
    return 0;
  }

  if (outletId === transfer.source_outlet_id) {
    return -item.quantity;
  }

  if (outletId === transfer.destination_outlet_id) {
    return item.quantity;
  }

  return 0;
}
