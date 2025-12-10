import { supabase } from '../lib/supabaseClient';

// ============================================
// Types for Report API
// ============================================

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Outlet filter for multi-outlet support
export interface OutletFilter {
  outletId?: string; // Specific outlet ID, or undefined for all outlets
}

// Stock Report Types
export type StockStatus = 'low' | 'normal' | 'overstocked';

export interface StockProductData {
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  stockStatus: StockStatus;
  stockValue: number;
  categoryId?: string;
  price: number;
}

export interface StockReportData {
  products: StockProductData[];
  totalInventoryValue: number;
  lowStockCount: number;
}

export interface StockFilters {
  category?: string;
  stockStatus?: StockStatus;
}

export interface SalesByPeriod {
  period: string;
  amount: number;
  count: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface SalesReportData {
  totalSales: number;
  totalTransactions: number;
  averageTransaction: number;
  salesByPeriod: SalesByPeriod[];
  topProductsByQuantity: TopProduct[];
  topProductsByRevenue: TopProduct[];
}

export interface ProductSalesHistory {
  productId: string;
  productName: string;
  salesHistory: Array<{
    date: string;
    quantity: number;
    revenue: number;
    transactionCount: number;
  }>;
  totalQuantity: number;
  totalRevenue: number;
}

// Dashboard Types
export interface RecentTransaction {
  id: string;
  transactionNumber: string;
  totalAmount: number;
  transactionDate: string;
  status: string;
}

export interface DashboardData {
  todaySales: number;
  todayTransactions: number;
  yesterdaySales: number;
  weekSales: number;
  lastWeekSales: number;
  lowStockCount: number;
  recentTransactions: RecentTransaction[];
}

// ============================================
// Sales Report Functions
// ============================================

/**
 * Get sales report for a date range with grouping by hour (daily) or day (monthly)
 * Supports outlet filtering for multi-outlet reports
 * **Feature: laporan, Property 1: Sales Aggregation Accuracy**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 1.1, 1.3, 1.4, 6.1, 6.2, 6.3**
 */
export async function getSalesReport(
  dateRange: DateRange,
  groupBy: 'hour' | 'day',
  outletFilter?: OutletFilter
): Promise<SalesReportData> {
  const { startDate, endDate } = dateRange;

  // Build query with optional outlet filter
  let query = supabase
    .from('transactions')
    .select('id, total_amount, transaction_date')
    .eq('status', 'completed')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  // Apply outlet filter if specified
  if (outletFilter?.outletId) {
    query = query.eq('outlet_id', outletFilter.outletId);
  }

  const { data: transactions, error: txError } = await query;

  if (txError) throw txError;

  const txList = transactions || [];

  // Calculate totals
  const totalSales = txList.reduce((sum, tx) => sum + Number(tx.total_amount), 0);
  const totalTransactions = txList.length;
  const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Group by period
  const salesByPeriod = groupSalesByPeriod(txList, groupBy);

  // Get top products with outlet filter
  const topProductsByQuantity = await getTopProductsByQuantity(startDate, endDate, outletFilter);
  const topProductsByRevenue = await getTopProductsByRevenue(startDate, endDate, outletFilter);

  return {
    totalSales,
    totalTransactions,
    averageTransaction,
    salesByPeriod,
    topProductsByQuantity,
    topProductsByRevenue,
  };
}

/**
 * Group transactions by hour or day
 */
function groupSalesByPeriod(
  transactions: Array<{ id: string; total_amount: number; transaction_date: string }>,
  groupBy: 'hour' | 'day'
): SalesByPeriod[] {
  const grouped = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    const date = new Date(tx.transaction_date);
    let period: string;

    if (groupBy === 'hour') {
      // Group by hour (0-23)
      period = date.getUTCHours().toString().padStart(2, '0');
    } else {
      // Group by day (1-31)
      period = date.getUTCDate().toString();
    }

    const existing = grouped.get(period) || { amount: 0, count: 0 };
    grouped.set(period, {
      amount: existing.amount + Number(tx.total_amount),
      count: existing.count + 1,
    });
  }

  // Convert to array and sort
  return Array.from(grouped.entries())
    .map(([period, data]) => ({
      period,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => parseInt(a.period) - parseInt(b.period));
}


/**
 * Get top 10 products by quantity sold
 * Supports outlet filtering for multi-outlet reports
 * **Feature: laporan, Property 2: Top Products Ranking**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 2.1, 2.2, 2.3, 6.2, 6.3**
 */
async function getTopProductsByQuantity(
  startDate: string,
  endDate: string,
  outletFilter?: OutletFilter
): Promise<TopProduct[]> {
  // Build query with optional outlet filter
  let query = supabase
    .from('transaction_items')
    .select(`
      quantity,
      total_price,
      product_id,
      products!inner(name),
      transactions!inner(status, transaction_date, outlet_id)
    `)
    .eq('transactions.status', 'completed')
    .gte('transactions.transaction_date', startDate)
    .lte('transactions.transaction_date', endDate);

  // Apply outlet filter if specified
  if (outletFilter?.outletId) {
    query = query.eq('transactions.outlet_id', outletFilter.outletId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Aggregate by product
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of data || []) {
    const productId = item.product_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productData = item.products as any;
    const productName = productData?.name || 'Unknown';
    const existing = productMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
    
    productMap.set(productId, {
      name: productName,
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + Number(item.total_price),
    });
  }

  // Sort by quantity and take top 10
  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
}

/**
 * Get top 10 products by revenue
 * Supports outlet filtering for multi-outlet reports
 * **Feature: laporan, Property 2: Top Products Ranking**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 2.1, 2.2, 2.3, 6.2, 6.3**
 */
async function getTopProductsByRevenue(
  startDate: string,
  endDate: string,
  outletFilter?: OutletFilter
): Promise<TopProduct[]> {
  // Build query with optional outlet filter
  let query = supabase
    .from('transaction_items')
    .select(`
      quantity,
      total_price,
      product_id,
      products!inner(name),
      transactions!inner(status, transaction_date, outlet_id)
    `)
    .eq('transactions.status', 'completed')
    .gte('transactions.transaction_date', startDate)
    .lte('transactions.transaction_date', endDate);

  // Apply outlet filter if specified
  if (outletFilter?.outletId) {
    query = query.eq('transactions.outlet_id', outletFilter.outletId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Aggregate by product
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of data || []) {
    const productId = item.product_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productData = item.products as any;
    const productName = productData?.name || 'Unknown';
    const existing = productMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
    
    productMap.set(productId, {
      name: productName,
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + Number(item.total_price),
    });
  }

  // Sort by revenue and take top 10
  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

/**
 * Get detailed sales history for a specific product
 * **Validates: Requirements 2.4**
 */
export async function getProductSalesHistory(
  productId: string,
  dateRange: DateRange
): Promise<ProductSalesHistory> {
  const { startDate, endDate } = dateRange;

  // Get product info
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .single();

  if (productError) throw productError;

  // Get transaction items for this product
  const { data: items, error: itemsError } = await supabase
    .from('transaction_items')
    .select(`
      quantity,
      total_price,
      transactions!inner(id, transaction_date, status)
    `)
    .eq('product_id', productId)
    .eq('transactions.status', 'completed')
    .gte('transactions.transaction_date', startDate)
    .lte('transactions.transaction_date', endDate);

  if (itemsError) throw itemsError;

  // Group by date
  const dailyMap = new Map<string, { quantity: number; revenue: number; txIds: Set<string> }>();

  for (const item of items || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = item.transactions as any;
    const dateKey = (tx.transaction_date as string).split('T')[0];
    const existing = dailyMap.get(dateKey) || { quantity: 0, revenue: 0, txIds: new Set<string>() };
    
    existing.quantity += item.quantity;
    existing.revenue += Number(item.total_price);
    existing.txIds.add(tx.id as string);
    dailyMap.set(dateKey, existing);
  }

  const salesHistory = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      quantity: data.quantity,
      revenue: data.revenue,
      transactionCount: data.txIds.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalQuantity = salesHistory.reduce((sum, d) => sum + d.quantity, 0);
  const totalRevenue = salesHistory.reduce((sum, d) => sum + d.revenue, 0);

  return {
    productId,
    productName: product?.name || 'Unknown',
    salesHistory,
    totalQuantity,
    totalRevenue,
  };
}

// ============================================
// Pure functions for testing
// ============================================

/**
 * Aggregate and rank products by quantity (pure function for testing)
 * **Feature: laporan, Property 2: Top Products Ranking**
 */
export function aggregateTopProductsByQuantity(
  items: Array<{ product_id: string; product_name: string; quantity: number; total_price: number }>
): TopProduct[] {
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of items) {
    const existing = productMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenue: 0 };
    productMap.set(item.product_id, {
      name: item.product_name,
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + item.total_price,
    });
  }

  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
}

/**
 * Aggregate and rank products by revenue (pure function for testing)
 * **Feature: laporan, Property 2: Top Products Ranking**
 */
export function aggregateTopProductsByRevenue(
  items: Array<{ product_id: string; product_name: string; quantity: number; total_price: number }>
): TopProduct[] {
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of items) {
    const existing = productMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenue: 0 };
    productMap.set(item.product_id, {
      name: item.product_name,
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + item.total_price,
    });
  }

  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

// ============================================
// Stock Report Functions
// ============================================

/**
 * Calculate stock status based on current stock and minimum stock level
 * **Feature: laporan, Property 3: Stock Report Data Integrity**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */
export function calculateStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock <= minStock) {
    return 'low';
  } else if (currentStock > minStock * 3) {
    return 'overstocked';
  }
  return 'normal';
}

/**
 * Process raw product data into stock report format (pure function for testing)
 * **Feature: laporan, Property 3: Stock Report Data Integrity**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */
export function processStockReportData(
  products: Array<{
    id: string;
    name: string;
    stock_quantity: number;
    min_stock: number;
    price: number;
    category_id?: string;
  }>
): StockReportData {
  const processedProducts: StockProductData[] = products.map(product => {
    const stockStatus = calculateStockStatus(product.stock_quantity, product.min_stock);
    const stockValue = product.stock_quantity * product.price;
    
    return {
      productId: product.id,
      productName: product.name,
      currentStock: product.stock_quantity,
      minStock: product.min_stock,
      stockStatus,
      stockValue,
      categoryId: product.category_id,
      price: product.price,
    };
  });

  const totalInventoryValue = processedProducts.reduce(
    (sum, product) => sum + product.stockValue,
    0
  );

  const lowStockCount = processedProducts.filter(
    product => product.stockStatus === 'low'
  ).length;

  return {
    products: processedProducts,
    totalInventoryValue,
    lowStockCount,
  };
}

/**
 * Filter stock report data by category and/or stock status (pure function for testing)
 * **Feature: laporan, Property 4: Stock Report Filtering**
 * **Validates: Requirements 3.3**
 */
export function filterStockReportData(
  reportData: StockReportData,
  filters: StockFilters
): StockReportData {
  let filteredProducts = reportData.products;

  if (filters.category) {
    filteredProducts = filteredProducts.filter(
      product => product.categoryId === filters.category
    );
  }

  if (filters.stockStatus) {
    filteredProducts = filteredProducts.filter(
      product => product.stockStatus === filters.stockStatus
    );
  }

  const totalInventoryValue = filteredProducts.reduce(
    (sum, product) => sum + product.stockValue,
    0
  );

  const lowStockCount = filteredProducts.filter(
    product => product.stockStatus === 'low'
  ).length;

  return {
    products: filteredProducts,
    totalInventoryValue,
    lowStockCount,
  };
}

/**
 * Get stock report for all active products with optional filtering
 * Supports outlet filtering for multi-outlet stock reports
 * **Feature: laporan, Property 3: Stock Report Data Integrity**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 6.2, 6.3**
 */
export async function getStockReport(
  filters?: StockFilters,
  outletFilter?: OutletFilter
): Promise<StockReportData> {
  if (outletFilter?.outletId) {
    // Get outlet-specific stock
    const { data: outletStock, error } = await supabase
      .from('outlet_stock')
      .select(`
        quantity,
        product_id,
        products!inner(id, name, min_stock, price, category_id, is_active)
      `)
      .eq('outlet_id', outletFilter.outletId)
      .eq('products.is_active', true);

    if (error) throw error;

    // Transform outlet stock to product format
    const products = (outletStock || []).map(os => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: (os.products as any).id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (os.products as any).name,
      stock_quantity: os.quantity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      min_stock: (os.products as any).min_stock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      price: (os.products as any).price,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category_id: (os.products as any).category_id,
    }));

    // Process raw data into stock report format
    const reportData = processStockReportData(products);

    // Apply filters if provided
    if (filters && (filters.category || filters.stockStatus)) {
      return filterStockReportData(reportData, filters);
    }

    return reportData;
  } else {
    // Get global stock (all outlets combined or legacy behavior)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, min_stock, price, category_id')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    // Process raw data into stock report format
    const reportData = processStockReportData(products || []);

    // Apply filters if provided
    if (filters && (filters.category || filters.stockStatus)) {
      return filterStockReportData(reportData, filters);
    }

    return reportData;
  }
}

// ============================================
// Stock Movement Report Functions
// ============================================

export type MovementType = 'in' | 'out' | 'adjustment';

export interface StockMovementItem {
  id: string;
  date: string;
  productId: string;
  productName: string;
  movementType: MovementType;
  quantity: number;
  runningBalance: number;
  referenceType?: string;
  referenceId?: string;
}

export interface StockMovementData {
  movements: StockMovementItem[];
}

export interface MovementFilters {
  startDate?: string;
  endDate?: string;
  productId?: string;
  movementType?: MovementType;
  outletId?: string; // Optional outlet filter for multi-outlet support
}

/**
 * Raw movement data from database
 */
interface RawMovement {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  movement_type: MovementType;
  quantity: number;
  reference_type?: string;
  reference_id?: string;
}

/**
 * Calculate running balance for stock movements (pure function for testing)
 * Running balance is calculated per product, with 'in' adding and 'out'/'adjustment' subtracting
 * **Feature: laporan, Property 5: Stock Movements with Running Balance**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
export function calculateRunningBalance(movements: RawMovement[]): StockMovementItem[] {
  // Sort by date ascending for correct running balance calculation
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Track running balance per product
  const productBalances = new Map<string, number>();

  const result: StockMovementItem[] = sortedMovements.map(movement => {
    const currentBalance = productBalances.get(movement.product_id) || 0;
    
    // Calculate new balance based on movement type
    let quantityChange: number;
    if (movement.movement_type === 'in') {
      quantityChange = movement.quantity;
    } else if (movement.movement_type === 'out') {
      quantityChange = -movement.quantity;
    } else {
      // adjustment - can be positive or negative, stored as-is
      quantityChange = movement.quantity;
    }
    
    const newBalance = currentBalance + quantityChange;
    productBalances.set(movement.product_id, newBalance);

    return {
      id: movement.id,
      date: movement.created_at,
      productId: movement.product_id,
      productName: movement.product_name,
      movementType: movement.movement_type,
      quantity: movement.quantity,
      runningBalance: newBalance,
      referenceType: movement.reference_type,
      referenceId: movement.reference_id,
    };
  });

  // Return in descending order (most recent first) for display
  return result.reverse();
}

/**
 * Filter stock movements by criteria (pure function for testing)
 * **Feature: laporan, Property 5: Stock Movements with Running Balance**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
export function filterMovements(
  movements: RawMovement[],
  filters: MovementFilters
): RawMovement[] {
  let filtered = [...movements];

  if (filters.startDate) {
    const startTime = new Date(filters.startDate).getTime();
    filtered = filtered.filter(m => new Date(m.created_at).getTime() >= startTime);
  }

  if (filters.endDate) {
    const endTime = new Date(filters.endDate).getTime();
    filtered = filtered.filter(m => new Date(m.created_at).getTime() <= endTime);
  }

  if (filters.productId) {
    filtered = filtered.filter(m => m.product_id === filters.productId);
  }

  if (filters.movementType) {
    filtered = filtered.filter(m => m.movement_type === filters.movementType);
  }

  return filtered;
}

/**
 * Process raw movements with filtering and running balance calculation (pure function for testing)
 * **Feature: laporan, Property 5: Stock Movements with Running Balance**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
export function processStockMovements(
  movements: RawMovement[],
  filters?: MovementFilters
): StockMovementData {
  // Apply filters first
  const filteredMovements = filters ? filterMovements(movements, filters) : movements;
  
  // Calculate running balance
  const processedMovements = calculateRunningBalance(filteredMovements);

  return {
    movements: processedMovements,
  };
}

/**
 * Get stock movements with optional filtering
 * Supports outlet filtering for multi-outlet reports
 * **Feature: laporan, Property 5: Stock Movements with Running Balance**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 4.1, 4.2, 4.3, 6.2, 6.3**
 */
export async function getStockMovements(filters?: MovementFilters): Promise<StockMovementData> {
  // Build query
  let query = supabase
    .from('stock_movements')
    .select(`
      id,
      created_at,
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      outlet_id,
      products!inner(name)
    `)
    .order('created_at', { ascending: false });

  // Apply date filters at query level for efficiency
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters?.movementType) {
    query = query.eq('movement_type', filters.movementType);
  }
  // Apply outlet filter if specified
  if (filters?.outletId) {
    query = query.eq('outlet_id', filters.outletId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Transform to raw movement format
  const rawMovements: RawMovement[] = (data || []).map(item => ({
    id: item.id,
    created_at: item.created_at,
    product_id: item.product_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product_name: (item.products as any)?.name || 'Unknown',
    movement_type: item.movement_type as MovementType,
    quantity: item.quantity,
    reference_type: item.reference_type || undefined,
    reference_id: item.reference_id || undefined,
  }));

  // Process with running balance calculation (no additional filtering needed as done at query level)
  return processStockMovements(rawMovements);
}

// ============================================
// Dashboard Summary Functions
// ============================================

/**
 * Get date boundaries for dashboard calculations
 */
export function getDashboardDateRanges(): {
  todayStart: string;
  todayEnd: string;
  yesterdayStart: string;
  yesterdayEnd: string;
  weekStart: string;
  weekEnd: string;
  lastWeekStart: string;
  lastWeekEnd: string;
} {
  const now = new Date();
  
  // Today: start of today to end of today
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  
  // Yesterday: start of yesterday to end of yesterday
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setUTCHours(23, 59, 59, 999);
  
  // This week: start of week (Monday) to today
  const weekStart = new Date(todayStart);
  const dayOfWeek = weekStart.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
  const weekEnd = new Date(todayEnd);
  
  // Last week: Monday to Sunday of previous week
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setUTCDate(lastWeekEnd.getUTCDate() + 6);
  lastWeekEnd.setUTCHours(23, 59, 59, 999);
  
  return {
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString(),
    yesterdayStart: yesterdayStart.toISOString(),
    yesterdayEnd: yesterdayEnd.toISOString(),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    lastWeekStart: lastWeekStart.toISOString(),
    lastWeekEnd: lastWeekEnd.toISOString(),
  };
}

/**
 * Calculate sales totals from transactions (pure function for testing)
 * **Feature: laporan, Property 7: Dashboard Summary Accuracy**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */
export function calculateSalesTotals(
  transactions: Array<{ total_amount: number; transaction_date: string; status: string }>,
  startDate: string,
  endDate: string
): { totalSales: number; transactionCount: number } {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  
  const filtered = transactions.filter(tx => {
    if (tx.status !== 'completed') return false;
    const txTime = new Date(tx.transaction_date).getTime();
    return txTime >= startTime && txTime <= endTime;
  });
  
  const totalSales = filtered.reduce((sum, tx) => sum + Number(tx.total_amount), 0);
  
  return {
    totalSales,
    transactionCount: filtered.length,
  };
}

/**
 * Calculate low stock count from products (pure function for testing)
 * **Feature: laporan, Property 7: Dashboard Summary Accuracy**
 * **Validates: Requirements 6.3**
 */
export function calculateLowStockCount(
  products: Array<{ stock_quantity: number; min_stock: number; is_active?: boolean }>
): number {
  return products.filter(p => {
    const isActive = p.is_active !== false; // default to true if not specified
    return isActive && p.stock_quantity <= p.min_stock;
  }).length;
}

/**
 * Get recent transactions (pure function for testing)
 * **Feature: laporan, Property 7: Dashboard Summary Accuracy**
 * **Validates: Requirements 6.4**
 */
export function getRecentTransactionsFromList(
  transactions: Array<{
    id: string;
    transaction_number: string;
    total_amount: number;
    transaction_date: string;
    status: string;
  }>,
  limit: number = 5
): RecentTransaction[] {
  return transactions
    .filter(tx => tx.status === 'completed')
    .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
    .slice(0, limit)
    .map(tx => ({
      id: tx.id,
      transactionNumber: tx.transaction_number,
      totalAmount: Number(tx.total_amount),
      transactionDate: tx.transaction_date,
      status: tx.status,
    }));
}

/**
 * Process dashboard data from raw inputs (pure function for testing)
 * **Feature: laporan, Property 7: Dashboard Summary Accuracy**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */
export function processDashboardData(
  transactions: Array<{
    id: string;
    transaction_number: string;
    total_amount: number;
    transaction_date: string;
    status: string;
  }>,
  products: Array<{ stock_quantity: number; min_stock: number; is_active?: boolean }>,
  dateRanges: {
    todayStart: string;
    todayEnd: string;
    yesterdayStart: string;
    yesterdayEnd: string;
    weekStart: string;
    weekEnd: string;
    lastWeekStart: string;
    lastWeekEnd: string;
  }
): DashboardData {
  // Calculate today's sales
  const todayData = calculateSalesTotals(
    transactions,
    dateRanges.todayStart,
    dateRanges.todayEnd
  );
  
  // Calculate yesterday's sales
  const yesterdayData = calculateSalesTotals(
    transactions,
    dateRanges.yesterdayStart,
    dateRanges.yesterdayEnd
  );
  
  // Calculate this week's sales
  const weekData = calculateSalesTotals(
    transactions,
    dateRanges.weekStart,
    dateRanges.weekEnd
  );
  
  // Calculate last week's sales
  const lastWeekData = calculateSalesTotals(
    transactions,
    dateRanges.lastWeekStart,
    dateRanges.lastWeekEnd
  );
  
  // Calculate low stock count
  const lowStockCount = calculateLowStockCount(products);
  
  // Get recent transactions
  const recentTransactions = getRecentTransactionsFromList(transactions, 5);
  
  return {
    todaySales: todayData.totalSales,
    todayTransactions: todayData.transactionCount,
    yesterdaySales: yesterdayData.totalSales,
    weekSales: weekData.totalSales,
    lastWeekSales: lastWeekData.totalSales,
    lowStockCount,
    recentTransactions,
  };
}

/**
 * Get dashboard summary with all metrics
 * Supports outlet filtering for multi-outlet dashboards
 * **Feature: laporan, Property 7: Dashboard Summary Accuracy**
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */
export async function getDashboardSummary(outletFilter?: OutletFilter): Promise<DashboardData> {
  const dateRanges = getDashboardDateRanges();
  
  // Build transaction query with optional outlet filter
  let txQuery = supabase
    .from('transactions')
    .select('id, transaction_number, total_amount, transaction_date, status')
    .gte('transaction_date', dateRanges.lastWeekStart)
    .order('transaction_date', { ascending: false });
  
  if (outletFilter?.outletId) {
    txQuery = txQuery.eq('outlet_id', outletFilter.outletId);
  }
  
  const { data: transactions, error: txError } = await txQuery;
  
  if (txError) throw txError;
  
  // Fetch stock data - either outlet-specific or global
  let products: Array<{ stock_quantity: number; min_stock: number; is_active?: boolean }> = [];
  
  if (outletFilter?.outletId) {
    // Get outlet-specific stock
    const { data: outletStock, error: stockError } = await supabase
      .from('outlet_stock')
      .select(`
        quantity,
        products!inner(min_stock, is_active)
      `)
      .eq('outlet_id', outletFilter.outletId)
      .eq('products.is_active', true);
    
    if (stockError) throw stockError;
    
    products = (outletStock || []).map(os => ({
      stock_quantity: os.quantity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      min_stock: (os.products as any).min_stock,
      is_active: true,
    }));
  } else {
    // Get global stock
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, min_stock, is_active')
      .eq('is_active', true);
    
    if (productError) throw productError;
    
    products = productData || [];
  }
  
  return processDashboardData(
    transactions || [],
    products,
    dateRanges
  );
}

// Export helper functions for testing
export { groupSalesByPeriod };
export { getTopProductsByQuantity, getTopProductsByRevenue };

// ============================================
// Pure functions for outlet filtering (testing)
// ============================================

/**
 * Filter transactions by outlet (pure function for testing)
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 6.2, 6.3**
 */
export function filterTransactionsByOutletForReport(
  transactions: Array<{ id: string; total_amount: number; transaction_date: string; outlet_id?: string }>,
  outletId?: string
): Array<{ id: string; total_amount: number; transaction_date: string; outlet_id?: string }> {
  if (!outletId) {
    // Return all transactions when no outlet filter
    return transactions;
  }
  return transactions.filter(tx => tx.outlet_id === outletId);
}

/**
 * Aggregate sales data with outlet filtering (pure function for testing)
 * **Feature: multi-outlet, Property 12: Report Outlet Filtering**
 * **Validates: Requirements 6.2, 6.3**
 */
export function aggregateSalesWithOutletFilter(
  transactions: Array<{ id: string; total_amount: number; transaction_date: string; outlet_id?: string }>,
  outletId?: string
): { totalSales: number; transactionCount: number } {
  const filtered = filterTransactionsByOutletForReport(transactions, outletId);
  
  const totalSales = filtered.reduce((sum, tx) => sum + Number(tx.total_amount), 0);
  const transactionCount = filtered.length;
  
  return { totalSales, transactionCount };
}
