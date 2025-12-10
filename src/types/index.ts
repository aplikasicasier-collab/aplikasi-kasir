export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'kasir';
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  event_type: 'login_success' | 'login_failure' | 'logout' | 'password_change';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  description?: string;
  price: number;
  stock_quantity: number;
  min_stock: number;
  category_id?: string;
  supplier_id?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  transaction_number: string;
  user_id: string;
  outlet_id?: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: 'cash' | 'card' | 'e-wallet';
  cash_received?: number;
  change_amount?: number;
  transaction_date: string;
  status: 'completed' | 'pending' | 'cancelled';
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  original_price?: number;
  discount_amount?: number;
  discount_id?: string;
  promo_id?: string;
  returned_quantity?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'received' | 'cancelled';
  order_date: string;
  expected_date?: string;
  received_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface SalesReport {
  date: string;
  total_sales: number;
  total_transactions: number;
  average_transaction: number;
  top_products: Array<{
    product_id: string;
    product_name: string;
    quantity_sold: number;
    total_revenue: number;
  }>;
}

export interface StockReport {
  product_id: string;
  product_name: string;
  current_stock: number;
  min_stock: number;
  last_movement?: string;
  total_in: number;
  total_out: number;
}


export interface Outlet {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserOutlet {
  id: string;
  user_id: string;
  outlet_id: string;
  is_default: boolean;
  created_at: string;
}

export interface OutletStock {
  id: string;
  outlet_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  source_outlet_id: string;
  source_outlet?: Outlet;
  destination_outlet_id: string;
  destination_outlet?: Outlet;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
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

export type DiscountType = 'percentage' | 'nominal';

export interface Discount {
  id: string;
  product_id: string;
  product_name?: string;
  discount_type: DiscountType;
  discount_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promo {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase: number | null;
  is_active: boolean;
  product_count?: number;
  products?: Product[];
  created_at: string;
  updated_at: string;
}

export interface PromoProduct {
  id: string;
  promo_id: string;
  product_id: string;
  created_at: string;
}


// Stock Opname Types (Barcode Scanner Feature)
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
  previous_stock: number;
  new_stock: number;
  adjustment: number;
  reason: string;
  created_at: string;
}


// Return/Refund Types
export type ReturnReason = 'damaged' | 'wrong_product' | 'not_as_described' | 'changed_mind' | 'other';
export type ReturnStatus = 'pending_approval' | 'approved' | 'completed' | 'rejected' | 'cancelled';

export interface Return {
  id: string;
  return_number: string;
  transaction_id: string;
  transaction?: Transaction;
  outlet_id: string | null;
  status: ReturnStatus;
  total_refund: number;
  refund_method: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approval_reason: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  return_id: string;
  transaction_item_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  original_price: number;
  discount_amount: number;
  refund_amount: number;
  reason: ReturnReason;
  reason_detail: string | null;
  is_damaged: boolean;
  is_resellable: boolean;
  created_at: string;
}

export interface ReturnPolicy {
  id: string;
  max_return_days: number;
  non_returnable_categories: string[];
  require_receipt: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


// Audit Log Types
export type AuditEventType = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'transaction' | 'refund' | 'stock_adjustment' | 'price_change' | 'role_change';
export type AuditEntityType = 'product' | 'transaction' | 'user' | 'supplier' | 'category' | 'purchase_order' | 'return' | 'discount' | 'promo' | 'outlet';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'failed_login' | 'bulk_delete' | 'unusual_transaction' | 'unauthorized_access';

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  entity_type: AuditEntityType;
  entity_id: string | null;
  user_id: string | null;
  user?: User;
  outlet_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  summary: string | null;
  created_at: string;
}

export interface AuditAlert {
  id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  user_id: string | null;
  user?: User;
  description: string;
  metadata: Record<string, unknown> | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface AuditSettings {
  id: string;
  retention_days: number;
  archive_enabled: boolean;
  archive_location: string | null;
  last_cleanup_at: string | null;
  created_at: string;
  updated_at: string;
}
