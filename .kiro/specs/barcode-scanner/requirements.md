# Requirements Document

## Introduction

Fitur Barcode Scanner adalah modul untuk memindai barcode produk menggunakan kamera perangkat atau scanner eksternal. Fitur ini memungkinkan kasir untuk menambahkan produk ke keranjang dengan cepat melalui scan barcode, serta memudahkan pengelolaan inventory dengan scan barcode saat stock opname. Tujuannya adalah mempercepat proses checkout dan meningkatkan akurasi input data.

## Glossary

- **Sistem_Barcode**: Modul aplikasi POS yang menangani pemindaian dan pengelolaan barcode
- **Barcode**: Kode batang unik yang mengidentifikasi produk
- **Scanner_Kamera**: Fitur pemindaian barcode menggunakan kamera perangkat
- **Scanner_Eksternal**: Perangkat scanner barcode fisik yang terhubung via USB/Bluetooth
- **Stock_Opname**: Proses penghitungan dan verifikasi stok fisik

## Requirements

### Requirement 1

**User Story:** As a kasir, I want to scan product barcodes using the device camera, so that I can quickly add items to the cart.

#### Acceptance Criteria

1. WHEN a kasir activates camera scanner THEN the Sistem_Barcode SHALL open camera viewfinder with barcode detection overlay
2. WHEN a barcode is detected THEN the Sistem_Barcode SHALL decode the barcode value within 500 milliseconds
3. WHEN a valid product barcode is scanned THEN the Sistem_Barcode SHALL add the product to cart with quantity 1
4. WHEN the same barcode is scanned again THEN the Sistem_Barcode SHALL increment the existing cart item quantity by 1
5. WHEN scanning is complete THEN the Sistem_Barcode SHALL provide audio feedback (beep sound)

### Requirement 2

**User Story:** As a kasir, I want to use an external barcode scanner, so that I can scan items faster at the checkout counter.

#### Acceptance Criteria

1. WHEN an external scanner sends barcode data THEN the Sistem_Barcode SHALL capture the input in the active barcode field
2. WHEN barcode input is received THEN the Sistem_Barcode SHALL process it within 100 milliseconds
3. WHEN using external scanner THEN the Sistem_Barcode SHALL support common barcode formats (EAN-13, EAN-8, UPC-A, Code 128)
4. WHEN external scanner input ends with Enter key THEN the Sistem_Barcode SHALL trigger product lookup automatically

### Requirement 3

**User Story:** As a manager, I want to assign barcodes to products, so that products can be identified by scanning.

#### Acceptance Criteria

1. WHEN a manager edits a product THEN the Sistem_Barcode SHALL allow entering or scanning a barcode value
2. WHEN a barcode is assigned THEN the Sistem_Barcode SHALL validate the barcode is unique across all products
3. WHEN a barcode format is invalid THEN the Sistem_Barcode SHALL display validation error with supported formats
4. WHEN a product has no barcode THEN the Sistem_Barcode SHALL allow generating a unique internal barcode
5. WHEN generating internal barcode THEN the Sistem_Barcode SHALL use format starting with store prefix

### Requirement 4

**User Story:** As a kasir, I want to see feedback when scanning, so that I know if the scan was successful or failed.

#### Acceptance Criteria

1. WHEN a barcode is successfully scanned THEN the Sistem_Barcode SHALL display product name and price briefly
2. WHEN a barcode is not found THEN the Sistem_Barcode SHALL display error message "Produk tidak ditemukan"
3. WHEN a product is out of stock THEN the Sistem_Barcode SHALL display warning "Stok habis" and prevent adding to cart
4. WHEN camera access is denied THEN the Sistem_Barcode SHALL display message to enable camera permission
5. WHEN scanning fails THEN the Sistem_Barcode SHALL allow manual barcode entry as fallback

### Requirement 5

**User Story:** As a staff, I want to use barcode scanning for stock opname, so that I can quickly verify and update inventory.

#### Acceptance Criteria

1. WHEN staff starts stock opname mode THEN the Sistem_Barcode SHALL enable continuous scanning
2. WHEN a product is scanned in opname mode THEN the Sistem_Barcode SHALL display current stock and allow entering actual count
3. WHEN actual count differs from system stock THEN the Sistem_Barcode SHALL highlight the discrepancy
4. WHEN stock opname is saved THEN the Sistem_Barcode SHALL update stock quantities and create adjustment records
5. WHEN viewing opname history THEN the Sistem_Barcode SHALL display date, products scanned, and adjustments made

### Requirement 6

**User Story:** As a manager, I want to print barcode labels, so that I can label products that don't have manufacturer barcodes.

#### Acceptance Criteria

1. WHEN a manager selects products for label printing THEN the Sistem_Barcode SHALL generate printable barcode labels
2. WHEN generating labels THEN the Sistem_Barcode SHALL include barcode, product name, and price
3. WHEN printing labels THEN the Sistem_Barcode SHALL support common label sizes (38x25mm, 50x30mm)
4. WHEN batch printing THEN the Sistem_Barcode SHALL allow selecting quantity per product
