# Requirements Document

## Introduction

Fitur Pemesanan (Purchase Order) adalah modul untuk mengelola pemesanan barang dari supplier. Fitur ini memungkinkan pengguna untuk membuat pesanan pembelian, melacak status pesanan, dan menerima barang yang dipesan untuk menambah stok inventory. Tujuannya adalah menyediakan sistem yang terstruktur untuk pengadaan barang dan menjaga ketersediaan stok produk.

## Glossary

- **Sistem_Pemesanan**: Modul aplikasi POS yang menangani proses pemesanan barang ke supplier
- **Purchase_Order**: Dokumen pesanan pembelian yang berisi daftar produk yang dipesan dari supplier
- **Supplier**: Pihak ketiga yang menyediakan barang untuk dijual kembali
- **PO_Item**: Item individual dalam purchase order yang mencakup produk, quantity, dan harga
- **Status_PO**: Status pesanan yang meliputi pending, approved, received, atau cancelled

## Requirements

### Requirement 1

**User Story:** As a store manager, I want to create purchase orders for products, so that I can replenish inventory from suppliers.

#### Acceptance Criteria

1. WHEN a manager creates a new purchase order THEN the Sistem_Pemesanan SHALL generate a unique order number in format PO-YYYYMMDD-XXXX
2. WHEN a manager adds products to a purchase order THEN the Sistem_Pemesanan SHALL record product ID, quantity, and unit price for each item
3. WHEN a manager saves a purchase order THEN the Sistem_Pemesanan SHALL calculate and store the total amount from all items
4. WHEN a purchase order is created THEN the Sistem_Pemesanan SHALL set the initial status to 'pending'
5. WHEN creating a purchase order THEN the Sistem_Pemesanan SHALL require selection of a supplier

### Requirement 2

**User Story:** As a store manager, I want to view and manage existing purchase orders, so that I can track order status and history.

#### Acceptance Criteria

1. WHEN a manager opens the purchase order list THEN the Sistem_Pemesanan SHALL display all orders with order number, supplier name, total amount, status, and order date
2. WHEN a manager filters purchase orders by status THEN the Sistem_Pemesanan SHALL show only orders matching the selected status
3. WHEN a manager filters purchase orders by date range THEN the Sistem_Pemesanan SHALL show only orders within the specified period
4. WHEN a manager searches purchase orders THEN the Sistem_Pemesanan SHALL filter by order number or supplier name

### Requirement 3

**User Story:** As a store manager, I want to approve or cancel pending purchase orders, so that I can control which orders proceed to fulfillment.

#### Acceptance Criteria

1. WHEN a manager approves a pending purchase order THEN the Sistem_Pemesanan SHALL change the status to 'approved'
2. WHEN a manager cancels a purchase order THEN the Sistem_Pemesanan SHALL change the status to 'cancelled'
3. WHILE a purchase order status is 'received' or 'cancelled' THEN the Sistem_Pemesanan SHALL prevent status changes
4. WHEN a status change occurs THEN the Sistem_Pemesanan SHALL record the timestamp of the change

### Requirement 4

**User Story:** As a store staff, I want to receive goods from approved purchase orders, so that inventory stock is updated accurately.

#### Acceptance Criteria

1. WHEN staff marks a purchase order as received THEN the Sistem_Pemesanan SHALL change the status to 'received'
2. WHEN a purchase order is received THEN the Sistem_Pemesanan SHALL increase stock quantity for each product by the ordered quantity
3. WHEN a purchase order is received THEN the Sistem_Pemesanan SHALL create stock movement records with type 'in' for each product
4. WHEN receiving goods THEN the Sistem_Pemesanan SHALL allow partial receipt by specifying actual received quantities
5. IF received quantity differs from ordered quantity THEN the Sistem_Pemesanan SHALL record the discrepancy in notes

### Requirement 5

**User Story:** As a store manager, I want to manage supplier information, so that I can maintain accurate supplier records for ordering.

#### Acceptance Criteria

1. WHEN a manager adds a new supplier THEN the Sistem_Pemesanan SHALL store supplier name, contact person, phone, email, and address
2. WHEN a manager edits supplier information THEN the Sistem_Pemesanan SHALL update the supplier record
3. WHEN a manager views supplier details THEN the Sistem_Pemesanan SHALL display all supplier information and associated purchase orders
4. WHEN listing suppliers THEN the Sistem_Pemesanan SHALL show supplier name, contact person, and phone number

### Requirement 6

**User Story:** As a store manager, I want to see products with low stock, so that I can quickly create purchase orders for restocking.

#### Acceptance Criteria

1. WHEN viewing the purchase order page THEN the Sistem_Pemesanan SHALL display a list of products where current stock is at or below minimum stock level
2. WHEN a manager selects low stock products THEN the Sistem_Pemesanan SHALL allow quick addition to a new purchase order
3. WHEN displaying low stock products THEN the Sistem_Pemesanan SHALL show product name, current stock, minimum stock, and suggested order quantity
