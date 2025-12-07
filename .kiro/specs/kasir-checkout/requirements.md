# Requirements Document

## Introduction

Fitur Kasir Checkout adalah penyempurnaan dari halaman Kasir yang sudah ada pada aplikasi Point of Sale (POS). Fitur ini menambahkan kemampuan untuk menyimpan transaksi ke database Supabase, mengurangi stok produk secara otomatis, dan mencetak struk transaksi. Tujuannya adalah mengubah proses checkout dari simulasi menjadi transaksi nyata yang tercatat dalam sistem.

## Glossary

- **Sistem_Kasir**: Modul aplikasi POS yang menangani proses penjualan dan checkout
- **Transaksi**: Catatan penjualan yang berisi informasi pembayaran, item yang dibeli, dan metadata terkait
- **Struk**: Bukti transaksi yang dapat dicetak atau ditampilkan kepada pelanggan
- **Keranjang**: Kumpulan item produk yang akan dibeli dalam satu transaksi
- **Stok**: Jumlah persediaan produk yang tersedia untuk dijual

## Requirements

### Requirement 1

**User Story:** As a cashier, I want to save completed transactions to the database, so that all sales are recorded for reporting and inventory tracking.

#### Acceptance Criteria

1. WHEN a cashier completes a checkout THEN the Sistem_Kasir SHALL create a new transaction record with a unique transaction number, total amount, tax amount, discount amount, payment method, and timestamp
2. WHEN a transaction is saved THEN the Sistem_Kasir SHALL create transaction item records for each product in the cart with quantity, unit price, and total price
3. WHEN a transaction is successfully saved THEN the Sistem_Kasir SHALL display a success notification to the cashier
4. IF a transaction fails to save THEN the Sistem_Kasir SHALL display an error message and retain the cart contents for retry

### Requirement 2

**User Story:** As a cashier, I want the system to automatically update product stock after a sale, so that inventory levels are always accurate.

#### Acceptance Criteria

1. WHEN a transaction is completed THEN the Sistem_Kasir SHALL reduce the stock quantity of each sold product by the quantity purchased
2. WHEN a transaction is completed THEN the Sistem_Kasir SHALL create a stock movement record with type 'out' for each sold product
3. IF a product's stock would become negative THEN the Sistem_Kasir SHALL prevent the checkout and display a warning message
4. WHEN stock is updated THEN the Sistem_Kasir SHALL refresh the product list to show current stock levels

### Requirement 3

**User Story:** As a cashier, I want to print or view a receipt after completing a transaction, so that I can provide proof of purchase to customers.

#### Acceptance Criteria

1. WHEN a transaction is completed THEN the Sistem_Kasir SHALL generate a receipt containing store name, transaction number, date/time, list of items with prices, subtotal, discount, tax, total amount, payment method, and change amount
2. WHEN a receipt is generated THEN the Sistem_Kasir SHALL display a print preview modal with the receipt content
3. WHEN a cashier clicks print THEN the Sistem_Kasir SHALL send the receipt to the browser's print dialog
4. WHEN a receipt is displayed THEN the Sistem_Kasir SHALL provide an option to close the modal and start a new transaction

### Requirement 4

**User Story:** As a cashier, I want to validate payment before completing checkout, so that transactions are only processed when payment is sufficient.

#### Acceptance Criteria

1. WHEN payment method is cash AND cash received is less than total amount THEN the Sistem_Kasir SHALL disable the checkout button and display insufficient payment warning
2. WHEN payment method is card or e-wallet THEN the Sistem_Kasir SHALL enable checkout without requiring cash input
3. WHEN checkout is initiated THEN the Sistem_Kasir SHALL validate that the cart contains at least one item
4. WHEN checkout is processing THEN the Sistem_Kasir SHALL display a loading indicator and disable the checkout button to prevent double submission

### Requirement 5

**User Story:** As a store owner, I want transaction numbers to be unique and sequential, so that I can easily track and reference sales.

#### Acceptance Criteria

1. WHEN a new transaction is created THEN the Sistem_Kasir SHALL generate a transaction number in format TRX-YYYYMMDD-XXXX where XXXX is a sequential number
2. WHEN generating transaction numbers THEN the Sistem_Kasir SHALL ensure uniqueness by querying the latest transaction number for the current date
3. WHEN the date changes THEN the Sistem_Kasir SHALL reset the sequential counter to 0001
