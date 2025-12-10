# Requirements Document

## Introduction

Fitur Diskon & Promo adalah modul untuk mengelola diskon produk dan promosi periode tertentu. Fitur ini memungkinkan manager untuk membuat diskon per produk (persentase atau nominal), membuat promo dengan periode aktif, dan menerapkan diskon secara otomatis saat checkout. Tujuannya adalah meningkatkan penjualan melalui strategi harga yang fleksibel.

## Glossary

- **Sistem_Diskon**: Modul aplikasi POS yang menangani manajemen diskon dan promosi
- **Diskon_Produk**: Potongan harga yang diterapkan pada produk tertentu
- **Promo**: Kampanye promosi dengan periode aktif yang mencakup satu atau lebih produk
- **Diskon_Persentase**: Potongan harga berdasarkan persentase dari harga asli
- **Diskon_Nominal**: Potongan harga dengan nilai tetap dalam rupiah
- **Periode_Promo**: Rentang waktu dimana promo berlaku (tanggal mulai dan berakhir)

## Requirements

### Requirement 1

**User Story:** As a manager, I want to create product discounts, so that I can offer price reductions on specific items.

#### Acceptance Criteria

1. WHEN a manager creates a product discount THEN the Sistem_Diskon SHALL store product ID, discount type (percentage or nominal), and discount value
2. WHEN a manager creates a percentage discount THEN the Sistem_Diskon SHALL validate the value is between 1 and 100
3. WHEN a manager creates a nominal discount THEN the Sistem_Diskon SHALL validate the value is greater than 0 and less than product price
4. WHEN a discount is created THEN the Sistem_Diskon SHALL set the status to 'active' by default
5. WHEN a product already has an active discount THEN the Sistem_Diskon SHALL prevent creating another discount for the same product

### Requirement 2

**User Story:** As a manager, I want to create promotional campaigns, so that I can run time-limited sales events.

#### Acceptance Criteria

1. WHEN a manager creates a promo THEN the Sistem_Diskon SHALL store promo name, description, start date, end date, and discount details
2. WHEN a manager creates a promo THEN the Sistem_Diskon SHALL validate end date is after start date
3. WHEN a manager adds products to a promo THEN the Sistem_Diskon SHALL associate multiple products with the promo
4. WHEN a promo period starts THEN the Sistem_Diskon SHALL automatically activate the promo discounts
5. WHEN a promo period ends THEN the Sistem_Diskon SHALL automatically deactivate the promo discounts

### Requirement 3

**User Story:** As a manager, I want to view and manage existing discounts and promos, so that I can track and modify pricing strategies.

#### Acceptance Criteria

1. WHEN a manager opens the discount list THEN the Sistem_Diskon SHALL display all discounts with product name, discount type, value, and status
2. WHEN a manager opens the promo list THEN the Sistem_Diskon SHALL display all promos with name, period, product count, and status
3. WHEN a manager edits a discount THEN the Sistem_Diskon SHALL allow updating discount type, value, and status
4. WHEN a manager deactivates a discount THEN the Sistem_Diskon SHALL set status to 'inactive' and stop applying the discount
5. WHEN a manager deletes a promo THEN the Sistem_Diskon SHALL remove the promo and all associated product discounts

### Requirement 4

**User Story:** As a kasir, I want discounts to be applied automatically at checkout, so that customers receive correct pricing without manual calculation.

#### Acceptance Criteria

1. WHEN a product with active discount is added to cart THEN the Sistem_Diskon SHALL display both original price and discounted price
2. WHEN calculating cart total THEN the Sistem_Diskon SHALL apply all active discounts to eligible products
3. WHEN a percentage discount is applied THEN the Sistem_Diskon SHALL calculate discounted price as original_price × (1 - percentage/100)
4. WHEN a nominal discount is applied THEN the Sistem_Diskon SHALL calculate discounted price as original_price - nominal_value
5. WHEN displaying receipt THEN the Sistem_Diskon SHALL show original price, discount amount, and final price for each discounted item

### Requirement 5

**User Story:** As a manager, I want to see discount performance reports, so that I can evaluate the effectiveness of pricing strategies.

#### Acceptance Criteria

1. WHEN viewing discount report THEN the Sistem_Diskon SHALL display total sales with discounts applied
2. WHEN viewing discount report THEN the Sistem_Diskon SHALL show total discount amount given
3. WHEN viewing promo report THEN the Sistem_Diskon SHALL display sales during promo period compared to normal period
4. WHEN filtering discount report THEN the Sistem_Diskon SHALL allow filtering by date range and promo

### Requirement 6

**User Story:** As a manager, I want to set minimum purchase requirements for promos, so that I can encourage larger transactions.

#### Acceptance Criteria

1. WHEN a manager creates a promo THEN the Sistem_Diskon SHALL allow setting optional minimum purchase amount
2. WHEN cart total is below minimum purchase THEN the Sistem_Diskon SHALL not apply the promo discount
3. WHEN cart total meets minimum purchase THEN the Sistem_Diskon SHALL apply the promo discount
4. WHEN displaying promo in cart THEN the Sistem_Diskon SHALL show remaining amount needed to qualify for promo
