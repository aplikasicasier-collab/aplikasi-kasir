export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier';
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

export interface Transaction {
  id: string;
  transaction_number: string;
  user_id: string;
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
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
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