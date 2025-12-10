# Requirements Document

## Introduction

Fitur Retur/Refund adalah modul untuk mengelola pengembalian barang dari customer. Fitur ini memungkinkan kasir untuk memproses retur produk, mengembalikan uang ke customer (refund), dan mengembalikan stok ke inventory. Tujuannya adalah menyediakan proses pengembalian yang terstruktur dengan pencatatan yang akurat untuk keperluan akuntansi dan inventory.

## Glossary

- **Sistem_Retur**: Modul aplikasi POS yang menangani proses pengembalian barang
- **Retur**: Proses pengembalian barang dari customer ke toko
- **Refund**: Pengembalian uang kepada customer atas barang yang diretur
- **Transaksi_Asal**: Transaksi penjualan asli yang menjadi dasar retur
- **Item_Retur**: Produk yang dikembalikan beserta quantity dan alasan
- **Alasan_Retur**: Kategori alasan pengembalian (rusak, salah produk, tidak sesuai, dll)

## Requirements

### Requirement 1

**User Story:** As a kasir, I want to process product returns, so that customers can return items they purchased.

#### Acceptance Criteria

1. WHEN a kasir initiates a return THEN the Sistem_Retur SHALL require the original transaction number
2. WHEN a valid transaction is found THEN the Sistem_Retur SHALL display all items from that transaction
3. WHEN a kasir selects items for return THEN the Sistem_Retur SHALL allow specifying quantity and return reason for each item
4. WHEN return quantity is specified THEN the Sistem_Retur SHALL validate it does not exceed original purchased quantity minus already returned quantity
5. WHEN a return is processed THEN the Sistem_Retur SHALL generate a unique return number in format RTN-YYYYMMDD-XXXX

### Requirement 2

**User Story:** As a kasir, I want to process refunds for returned items, so that customers receive their money back.

#### Acceptance Criteria

1. WHEN a return is confirmed THEN the Sistem_Retur SHALL calculate the refund amount based on original item prices
2. WHEN calculating refund THEN the Sistem_Retur SHALL apply the same discounts that were applied in the original transaction
3. WHEN a refund is processed THEN the Sistem_Retur SHALL record the refund method (cash, card, e-wallet)
4. WHEN refund method is cash THEN the Sistem_Retur SHALL display the amount to be returned to customer
5. WHEN a refund is completed THEN the Sistem_Retur SHALL update the transaction records

### Requirement 3

**User Story:** As a manager, I want to set return policies, so that returns are processed according to store rules.

#### Acceptance Criteria

1. WHEN configuring return policy THEN the Sistem_Retur SHALL allow setting maximum days for return eligibility
2. WHEN a return is attempted after the policy period THEN the Sistem_Retur SHALL display warning and require manager approval
3. WHEN configuring return policy THEN the Sistem_Retur SHALL allow specifying non-returnable product categories
4. WHEN a non-returnable product is selected THEN the Sistem_Retur SHALL prevent return and display policy message

### Requirement 4

**User Story:** As a staff, I want returned items to update inventory, so that stock levels are accurate.

#### Acceptance Criteria

1. WHEN a return is completed THEN the Sistem_Retur SHALL increase stock quantity for each returned item
2. WHEN stock is updated THEN the Sistem_Retur SHALL create stock_movement records with type 'return'
3. WHEN an item is returned as damaged THEN the Sistem_Retur SHALL allow marking it as non-resellable
4. WHEN an item is marked non-resellable THEN the Sistem_Retur SHALL not add it back to sellable stock

### Requirement 5

**User Story:** As a manager, I want to view return reports, so that I can analyze return patterns and reasons.

#### Acceptance Criteria

1. WHEN viewing return report THEN the Sistem_Retur SHALL display total returns by date range
2. WHEN viewing return report THEN the Sistem_Retur SHALL show breakdown by return reason
3. WHEN viewing return report THEN the Sistem_Retur SHALL display total refund amount
4. WHEN viewing return report THEN the Sistem_Retur SHALL show top returned products

### Requirement 6

**User Story:** As a kasir, I want to print return receipts, so that customers have proof of their return.

#### Acceptance Criteria

1. WHEN a return is completed THEN the Sistem_Retur SHALL generate a return receipt
2. WHEN generating receipt THEN the Sistem_Retur SHALL include return number, original transaction number, returned items, and refund amount
3. WHEN generating receipt THEN the Sistem_Retur SHALL include return date and kasir name
4. WHEN receipt is ready THEN the Sistem_Retur SHALL allow printing or sending via email

### Requirement 7

**User Story:** As a manager, I want to approve returns that exceed policy limits, so that exceptions can be handled properly.

#### Acceptance Criteria

1. WHEN a return requires approval THEN the Sistem_Retur SHALL notify the manager
2. WHEN a manager approves a return THEN the Sistem_Retur SHALL record the approver and approval reason
3. WHEN a manager rejects a return THEN the Sistem_Retur SHALL record the rejection reason and notify the kasir
4. WHEN viewing pending approvals THEN the Sistem_Retur SHALL display all returns awaiting manager decision
