import { supabase } from '@/lib/supabaseClient';
import { PurchaseOrder, PurchaseOrderItem } from '@/types';

// ============================================
// Types
// ============================================

export interface CreatePOItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePOInput {
  supplierId: string;
  expectedDate?: string;
  items: CreatePOItemInput[];
}

export interface POFilters {
  status?: PurchaseOrder['status'];
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
  supplier?: {
    id: string;
    name: string;
  };
}

// ============================================
// PO Number Generation
// ============================================

/**
 * Formats a date as YYYYMMDD string
 */
export function formatDateForPONumber(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generates a PO number in format PO-YYYYMMDD-XXXX
 * where XXXX is a sequential number for that date
 */
export async function generatePONumber(): Promise<string> {
  const today = new Date();
  const dateStr = formatDateForPONumber(today);
  const prefix = `PO-${dateStr}-`;

  // Query latest PO for current date to get next sequence
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to generate PO number: ${error.message}`);
  }

  let nextSequence = 1;

  if (data && data.length > 0) {
    const lastNumber = data[0].order_number;
    const lastSequence = parseInt(lastNumber.split('-')[2], 10);
    if (!isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

/**
 * Generates a PO number locally (for testing without database)
 * @param existingNumbers - Array of existing PO numbers to check against
 * @param date - Date to use for the PO number
 */
export function generatePONumberLocal(existingNumbers: string[], date: Date): string {
  const dateStr = formatDateForPONumber(date);
  const prefix = `PO-${dateStr}-`;

  // Filter numbers for current date and find max sequence
  const todayNumbers = existingNumbers.filter(n => n.startsWith(prefix));
  
  let nextSequence = 1;

  if (todayNumbers.length > 0) {
    const sequences = todayNumbers.map(n => {
      const parts = n.split('-');
      return parseInt(parts[2], 10);
    }).filter(n => !isNaN(n));

    if (sequences.length > 0) {
      nextSequence = Math.max(...sequences) + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

/**
 * Validates PO number format: PO-YYYYMMDD-XXXX
 */
export function isValidPONumberFormat(orderNumber: string): boolean {
  const regex = /^PO-\d{8}-\d{4}$/;
  return regex.test(orderNumber);
}


// ============================================
// PO Validation
// ============================================

export interface POValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates purchase order input before creation
 * - Supplier ID is required
 * - At least one item is required
 * - Each item must have valid quantity (> 0) and unit price (>= 0)
 */
export function validatePOInput(input: CreatePOInput): POValidationResult {
  const errors: string[] = [];

  // Supplier validation
  if (!input.supplierId || input.supplierId.trim().length === 0) {
    errors.push('Supplier is required');
  }

  // Items validation
  if (!input.items || input.items.length === 0) {
    errors.push('At least one item is required');
  } else {
    input.items.forEach((item, index) => {
      if (!item.productId || item.productId.trim().length === 0) {
        errors.push(`Item ${index + 1}: Product ID is required`);
      }
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${index + 1}: Unit price cannot be negative`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates total amount from PO items
 */
export function calculatePOTotal(items: CreatePOItemInput[]): number {
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
}

/**
 * Creates a PO object locally (for testing without database)
 */
export function createPOLocally(
  input: CreatePOInput,
  orderNumber: string,
  userId: string
): PurchaseOrder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    order_number: orderNumber,
    supplier_id: input.supplierId,
    user_id: userId,
    total_amount: calculatePOTotal(input.items),
    status: 'pending',
    order_date: now,
    expected_date: input.expectedDate,
    notes: undefined,
    created_at: now,
    updated_at: now,
  };
}

// ============================================
// PO Filtering Functions (Pure, for testing)
// ============================================

/**
 * Filters POs by status
 * Requirements: 2.2
 */
export function filterPOsByStatus(
  purchaseOrders: PurchaseOrderWithItems[],
  status: PurchaseOrder['status']
): PurchaseOrderWithItems[] {
  return purchaseOrders.filter(po => po.status === status);
}

/**
 * Filters POs by date range
 * Requirements: 2.3
 */
export function filterPOsByDateRange(
  purchaseOrders: PurchaseOrderWithItems[],
  startDate?: string,
  endDate?: string
): PurchaseOrderWithItems[] {
  return purchaseOrders.filter(po => {
    const orderDate = new Date(po.order_date);
    
    if (startDate) {
      const start = new Date(startDate);
      if (orderDate < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (orderDate > end) return false;
    }
    
    return true;
  });
}

/**
 * Searches POs by order number or supplier name
 * Requirements: 2.4
 */
export function searchPOs(
  purchaseOrders: PurchaseOrderWithItems[],
  searchTerm: string
): PurchaseOrderWithItems[] {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return purchaseOrders;
  }
  
  const searchLower = searchTerm.toLowerCase().trim();
  return purchaseOrders.filter(po =>
    po.order_number.toLowerCase().includes(searchLower) ||
    (po.supplier?.name?.toLowerCase().includes(searchLower) ?? false)
  );
}

/**
 * Applies all filters to POs (combined filter function)
 * Requirements: 2.2, 2.3, 2.4
 */
export function filterPOs(
  purchaseOrders: PurchaseOrderWithItems[],
  filters: POFilters
): PurchaseOrderWithItems[] {
  let result = [...purchaseOrders];
  
  if (filters.status) {
    result = filterPOsByStatus(result, filters.status);
  }
  
  if (filters.startDate || filters.endDate) {
    result = filterPOsByDateRange(result, filters.startDate, filters.endDate);
  }
  
  if (filters.search) {
    result = searchPOs(result, filters.search);
  }
  
  return result;
}


// ============================================
// Purchase Order CRUD Operations
// ============================================

/**
 * Create a new purchase order with items
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */
export async function createPurchaseOrder(input: CreatePOInput): Promise<PurchaseOrderWithItems> {
  // Validate input
  const validation = validatePOInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid PO input: ${validation.errors.join(', ')}`);
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Generate PO number
  const orderNumber = await generatePONumber();

  // Calculate total amount
  const totalAmount = calculatePOTotal(input.items);

  // Create purchase order
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      order_number: orderNumber,
      supplier_id: input.supplierId,
      user_id: user.id,
      total_amount: totalAmount,
      status: 'pending',
      expected_date: input.expectedDate,
    })
    .select()
    .single();

  if (poError) {
    throw new Error(`Failed to create purchase order: ${poError.message}`);
  }

  // Create purchase order items
  const itemsToInsert = input.items.map(item => ({
    purchase_order_id: po.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.quantity * item.unitPrice,
  }));

  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert)
    .select();

  if (itemsError) {
    // Rollback: delete the PO if items failed
    await supabase.from('purchase_orders').delete().eq('id', po.id);
    throw new Error(`Failed to create purchase order items: ${itemsError.message}`);
  }

  return {
    ...po,
    items: items as PurchaseOrderItem[],
  };
}

/**
 * Get all purchase orders with optional filters
 * Requirements: 2.1
 */
export async function getPurchaseOrders(filters?: POFilters): Promise<PurchaseOrderWithItems[]> {
  let query = supabase
    .from('purchase_orders')
    .select(`
      *,
      supplier:suppliers(id, name),
      items:purchase_order_items(*)
    `)
    .order('order_date', { ascending: false });

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('order_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('order_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch purchase orders: ${error.message}`);
  }

  // Apply search filter (client-side for order_number and supplier name)
  let results = data as PurchaseOrderWithItems[];
  
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter(po => 
      po.order_number.toLowerCase().includes(searchLower) ||
      (po.supplier?.name?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  return results;
}

/**
 * Get a single purchase order by ID
 */
export async function getPurchaseOrderById(id: string): Promise<PurchaseOrderWithItems | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      supplier:suppliers(id, name),
      items:purchase_order_items(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch purchase order: ${error.message}`);
  }

  return data as PurchaseOrderWithItems;
}

// ============================================
// Status Management
// ============================================

/**
 * Terminal states that cannot be changed
 * Requirements: 3.3
 */
export const TERMINAL_STATES: PurchaseOrder['status'][] = ['received', 'cancelled'];

/**
 * Checks if a PO status is a terminal state (cannot be changed)
 * Requirements: 3.3
 */
export function isTerminalState(status: PurchaseOrder['status']): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Validates if a status transition is allowed
 * Requirements: 3.1, 3.2, 3.3
 * 
 * Valid transitions:
 * - pending -> approved (approve)
 * - pending -> cancelled (cancel)
 * - approved -> cancelled (cancel)
 * - approved -> received (receive - handled separately)
 * 
 * Invalid transitions:
 * - received -> any (terminal state)
 * - cancelled -> any (terminal state)
 */
export interface StatusTransitionResult {
  valid: boolean;
  error?: string;
}

export function validateStatusTransition(
  currentStatus: PurchaseOrder['status'],
  newStatus: PurchaseOrder['status']
): StatusTransitionResult {
  // Check if current status is terminal
  if (isTerminalState(currentStatus)) {
    return {
      valid: false,
      error: `Cannot change status of ${currentStatus} purchase order`,
    };
  }

  // Define valid transitions
  const validTransitions: Record<PurchaseOrder['status'], PurchaseOrder['status'][]> = {
    pending: ['approved', 'cancelled'],
    approved: ['received', 'cancelled'],
    received: [], // Terminal state
    cancelled: [], // Terminal state
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Updates PO status locally (for testing without database)
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export interface StatusUpdateResult {
  success: boolean;
  purchaseOrder?: PurchaseOrder;
  error?: string;
}

export function updatePOStatusLocally(
  purchaseOrder: PurchaseOrder,
  newStatus: PurchaseOrder['status']
): StatusUpdateResult {
  const validation = validateStatusTransition(purchaseOrder.status, newStatus);
  
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const now = new Date().toISOString();
  const updatedPO: PurchaseOrder = {
    ...purchaseOrder,
    status: newStatus,
    updated_at: now,
  };

  return {
    success: true,
    purchaseOrder: updatedPO,
  };
}

/**
 * Approve a pending purchase order
 * Requirements: 3.1, 3.3, 3.4
 */
export async function approvePurchaseOrder(id: string): Promise<PurchaseOrderWithItems> {
  // Get current PO
  const currentPO = await getPurchaseOrderById(id);
  
  if (!currentPO) {
    throw new Error('Purchase order not found');
  }

  // Validate transition
  const validation = validateStatusTransition(currentPO.status, 'approved');
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Update status
  const { data, error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve purchase order: ${error.message}`);
  }

  return {
    ...data,
    items: currentPO.items,
    supplier: currentPO.supplier,
  } as PurchaseOrderWithItems;
}

/**
 * Cancel a purchase order
 * Requirements: 3.2, 3.3, 3.4
 */
export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrderWithItems> {
  // Get current PO
  const currentPO = await getPurchaseOrderById(id);
  
  if (!currentPO) {
    throw new Error('Purchase order not found');
  }

  // Validate transition
  const validation = validateStatusTransition(currentPO.status, 'cancelled');
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Update status
  const { data, error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel purchase order: ${error.message}`);
  }

  return {
    ...data,
    items: currentPO.items,
    supplier: currentPO.supplier,
  } as PurchaseOrderWithItems;
}

// ============================================
// Receive Purchase Order
// ============================================

export interface ReceivedItem {
  productId: string;
  receivedQuantity: number;
}

export interface ReceivePOInput {
  id: string;
  receivedItems: ReceivedItem[];
  notes?: string;
}

export interface ReceivePOResult {
  purchaseOrder: PurchaseOrderWithItems;
  stockMovements: Array<{
    productId: string;
    quantity: number;
    movementType: 'in';
  }>;
}

/**
 * Validates receive PO input
 * Requirements: 4.1, 4.4
 */
export interface ReceiveValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateReceiveInput(
  purchaseOrder: PurchaseOrderWithItems,
  receivedItems: ReceivedItem[]
): ReceiveValidationResult {
  const errors: string[] = [];

  // Check if PO is in approved status
  if (purchaseOrder.status !== 'approved') {
    errors.push(`Cannot receive PO with status '${purchaseOrder.status}'. Only approved POs can be received.`);
  }

  // Check if received items are provided
  if (!receivedItems || receivedItems.length === 0) {
    errors.push('At least one received item is required');
  }

  // Validate each received item
  if (receivedItems && receivedItems.length > 0) {
    const poItemProductIds = new Set(purchaseOrder.items.map(item => item.product_id));
    
    receivedItems.forEach((item, index) => {
      if (!item.productId || item.productId.trim().length === 0) {
        errors.push(`Received item ${index + 1}: Product ID is required`);
      } else if (!poItemProductIds.has(item.productId)) {
        errors.push(`Received item ${index + 1}: Product not found in purchase order`);
      }
      
      if (item.receivedQuantity < 0) {
        errors.push(`Received item ${index + 1}: Received quantity cannot be negative`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if there's a discrepancy between ordered and received quantities
 * Requirements: 4.4, 4.5
 */
export interface DiscrepancyInfo {
  hasDiscrepancy: boolean;
  discrepancies: Array<{
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    difference: number;
  }>;
}

export function checkReceiptDiscrepancy(
  poItems: PurchaseOrderItem[],
  receivedItems: ReceivedItem[]
): DiscrepancyInfo {
  const discrepancies: DiscrepancyInfo['discrepancies'] = [];
  
  const receivedMap = new Map(receivedItems.map(item => [item.productId, item.receivedQuantity]));
  
  for (const poItem of poItems) {
    const receivedQty = receivedMap.get(poItem.product_id) ?? 0;
    const orderedQty = poItem.quantity;
    
    if (receivedQty !== orderedQty) {
      discrepancies.push({
        productId: poItem.product_id,
        orderedQuantity: orderedQty,
        receivedQuantity: receivedQty,
        difference: receivedQty - orderedQty,
      });
    }
  }

  return {
    hasDiscrepancy: discrepancies.length > 0,
    discrepancies,
  };
}

/**
 * Generates discrepancy notes for partial receipt
 * Requirements: 4.5
 */
export function generateDiscrepancyNotes(discrepancyInfo: DiscrepancyInfo): string {
  if (!discrepancyInfo.hasDiscrepancy) {
    return '';
  }

  const lines = discrepancyInfo.discrepancies.map(d => {
    const diff = d.difference;
    const status = diff > 0 ? 'lebih' : 'kurang';
    return `Product ${d.productId}: dipesan ${d.orderedQuantity}, diterima ${d.receivedQuantity} (${status} ${Math.abs(diff)})`;
  });

  return `Discrepancy: ${lines.join('; ')}`;
}

/**
 * Simulates receiving a purchase order locally (for testing without database)
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export interface LocalReceiveResult {
  success: boolean;
  purchaseOrder?: PurchaseOrder;
  stockUpdates?: Array<{
    productId: string;
    quantityChange: number;
  }>;
  stockMovements?: Array<{
    productId: string;
    quantity: number;
    movementType: 'in';
    referenceType: 'purchase_order';
    referenceId: string;
  }>;
  notes?: string;
  error?: string;
}

export function receivePOLocally(
  purchaseOrder: PurchaseOrderWithItems,
  receivedItems: ReceivedItem[]
): LocalReceiveResult {
  // Validate input
  const validation = validateReceiveInput(purchaseOrder, receivedItems);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(', '),
    };
  }

  // Check for discrepancies
  const discrepancyInfo = checkReceiptDiscrepancy(purchaseOrder.items, receivedItems);
  const discrepancyNotes = generateDiscrepancyNotes(discrepancyInfo);

  // Calculate stock updates
  const stockUpdates = receivedItems
    .filter(item => item.receivedQuantity > 0)
    .map(item => ({
      productId: item.productId,
      quantityChange: item.receivedQuantity,
    }));

  // Create stock movements
  const stockMovements = receivedItems
    .filter(item => item.receivedQuantity > 0)
    .map(item => ({
      productId: item.productId,
      quantity: item.receivedQuantity,
      movementType: 'in' as const,
      referenceType: 'purchase_order' as const,
      referenceId: purchaseOrder.id,
    }));

  // Update PO
  const now = new Date().toISOString();
  const existingNotes = purchaseOrder.notes || '';
  const combinedNotes = discrepancyNotes 
    ? (existingNotes ? `${existingNotes}; ${discrepancyNotes}` : discrepancyNotes)
    : existingNotes;

  const updatedPO: PurchaseOrder = {
    ...purchaseOrder,
    status: 'received',
    received_date: now,
    updated_at: now,
    notes: combinedNotes || undefined,
  };

  return {
    success: true,
    purchaseOrder: updatedPO,
    stockUpdates,
    stockMovements,
    notes: combinedNotes || undefined,
  };
}

/**
 * Receive a purchase order and update stock
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export async function receivePurchaseOrder(
  id: string,
  receivedItems: ReceivedItem[],
  notes?: string
): Promise<ReceivePOResult> {
  // Get current PO
  const currentPO = await getPurchaseOrderById(id);
  
  if (!currentPO) {
    throw new Error('Purchase order not found');
  }

  // Validate input
  const validation = validateReceiveInput(currentPO, receivedItems);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Check for discrepancies
  const discrepancyInfo = checkReceiptDiscrepancy(currentPO.items, receivedItems);
  const discrepancyNotes = generateDiscrepancyNotes(discrepancyInfo);

  // Combine notes
  const existingNotes = currentPO.notes || '';
  const userNotes = notes || '';
  const allNotes = [existingNotes, userNotes, discrepancyNotes]
    .filter(n => n.length > 0)
    .join('; ');

  const now = new Date().toISOString();

  // Update PO status to received
  const { data: updatedPO, error: poError } = await supabase
    .from('purchase_orders')
    .update({
      status: 'received',
      received_date: now,
      updated_at: now,
      notes: allNotes || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (poError) {
    throw new Error(`Failed to update purchase order status: ${poError.message}`);
  }

  // Update received quantities for each PO item
  for (const receivedItem of receivedItems) {
    const { error: itemError } = await supabase
      .from('purchase_order_items')
      .update({
        received_quantity: receivedItem.receivedQuantity,
      })
      .eq('purchase_order_id', id)
      .eq('product_id', receivedItem.productId);

    if (itemError) {
      throw new Error(`Failed to update PO item received quantity: ${itemError.message}`);
    }
  }

  // Update stock for each product and create stock movements
  const stockMovements: ReceivePOResult['stockMovements'] = [];

  for (const receivedItem of receivedItems) {
    if (receivedItem.receivedQuantity > 0) {
      // Get current stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', receivedItem.productId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch product stock: ${fetchError.message}`);
      }

      const newStock = product.stock_quantity + receivedItem.receivedQuantity;

      // Update product stock
      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: newStock, 
          updated_at: now 
        })
        .eq('id', receivedItem.productId);

      if (stockError) {
        throw new Error(`Failed to update product stock: ${stockError.message}`);
      }

      // Create stock movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: receivedItem.productId,
          movement_type: 'in',
          quantity: receivedItem.receivedQuantity,
          reference_type: 'purchase_order',
          reference_id: id,
          notes: `Penerimaan PO ${currentPO.order_number}`,
        });

      if (movementError) {
        throw new Error(`Failed to create stock movement: ${movementError.message}`);
      }

      stockMovements.push({
        productId: receivedItem.productId,
        quantity: receivedItem.receivedQuantity,
        movementType: 'in',
      });
    }
  }

  // Fetch updated items
  const { data: updatedItems, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', id);

  if (itemsError) {
    throw new Error(`Failed to fetch updated PO items: ${itemsError.message}`);
  }

  return {
    purchaseOrder: {
      ...updatedPO,
      items: updatedItems as PurchaseOrderItem[],
      supplier: currentPO.supplier,
    },
    stockMovements,
  };
}
