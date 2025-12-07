# Requirements Document

## Introduction

Fitur Laporan adalah modul untuk menampilkan dan menganalisis data penjualan dan stok pada aplikasi Point of Sale (POS). Fitur ini menyediakan berbagai jenis laporan seperti laporan penjualan harian/bulanan, laporan produk terlaris, laporan stok, dan laporan pergerakan stok. Tujuannya adalah memberikan insight bisnis kepada pemilik toko untuk pengambilan keputusan yang lebih baik.

## Glossary

- **Sistem_Laporan**: Modul aplikasi POS yang menangani pembuatan dan tampilan laporan
- **Laporan_Penjualan**: Ringkasan data transaksi penjualan dalam periode tertentu
- **Laporan_Stok**: Ringkasan kondisi persediaan produk saat ini
- **Periode_Laporan**: Rentang waktu yang dipilih untuk menghasilkan laporan (harian, mingguan, bulanan)
- **Produk_Terlaris**: Produk dengan jumlah penjualan tertinggi dalam periode tertentu

## Requirements

### Requirement 1

**User Story:** As a store owner, I want to view daily and monthly sales reports, so that I can monitor business performance over time.

#### Acceptance Criteria

1. WHEN a user selects a date range THEN the Sistem_Laporan SHALL display total sales amount, total transactions, and average transaction value for that period
2. WHEN viewing sales report THEN the Sistem_Laporan SHALL show a chart visualizing sales trend over the selected period
3. WHEN viewing daily report THEN the Sistem_Laporan SHALL break down sales by hour of the day
4. WHEN viewing monthly report THEN the Sistem_Laporan SHALL break down sales by day of the month
5. WHEN no transactions exist for selected period THEN the Sistem_Laporan SHALL display zero values with appropriate message

### Requirement 2

**User Story:** As a store owner, I want to see top selling products, so that I can understand which products drive the most revenue.

#### Acceptance Criteria

1. WHEN viewing sales report THEN the Sistem_Laporan SHALL display a list of top 10 products by quantity sold
2. WHEN viewing sales report THEN the Sistem_Laporan SHALL display a list of top 10 products by revenue generated
3. WHEN displaying top products THEN the Sistem_Laporan SHALL show product name, quantity sold, and total revenue for each product
4. WHEN a user clicks on a product THEN the Sistem_Laporan SHALL show detailed sales history for that product

### Requirement 3

**User Story:** As a store manager, I want to view current stock levels, so that I can identify products that need restocking.

#### Acceptance Criteria

1. WHEN viewing stock report THEN the Sistem_Laporan SHALL display all products with current stock quantity and minimum stock level
2. WHEN viewing stock report THEN the Sistem_Laporan SHALL highlight products where current stock is at or below minimum level
3. WHEN filtering stock report THEN the Sistem_Laporan SHALL allow filtering by category or stock status (low, normal, overstocked)
4. WHEN viewing stock report THEN the Sistem_Laporan SHALL show total inventory value calculated from stock quantity and product price

### Requirement 4

**User Story:** As a store manager, I want to track stock movements, so that I can audit inventory changes and identify discrepancies.

#### Acceptance Criteria

1. WHEN viewing stock movement report THEN the Sistem_Laporan SHALL display all stock movements with date, product, movement type, quantity, and reference
2. WHEN filtering stock movements THEN the Sistem_Laporan SHALL allow filtering by date range, product, and movement type (in, out, adjustment)
3. WHEN viewing stock movements THEN the Sistem_Laporan SHALL show running balance for each product after each movement
4. WHEN displaying movement reference THEN the Sistem_Laporan SHALL link to the source transaction or purchase order

### Requirement 5

**User Story:** As a store owner, I want to export reports to common formats, so that I can share data with accountants or for further analysis.

#### Acceptance Criteria

1. WHEN a user clicks export THEN the Sistem_Laporan SHALL generate a CSV file containing the current report data
2. WHEN exporting report THEN the Sistem_Laporan SHALL include all visible columns and rows in the export
3. WHEN export is complete THEN the Sistem_Laporan SHALL trigger browser download of the generated file
4. WHEN exporting THEN the Sistem_Laporan SHALL name the file with report type and date range

### Requirement 6

**User Story:** As a store owner, I want to see a dashboard summary, so that I can quickly understand current business status.

#### Acceptance Criteria

1. WHEN viewing the report dashboard THEN the Sistem_Laporan SHALL display today's sales total, transaction count, and comparison with yesterday
2. WHEN viewing the dashboard THEN the Sistem_Laporan SHALL display this week's sales with comparison to last week
3. WHEN viewing the dashboard THEN the Sistem_Laporan SHALL display count of low stock products requiring attention
4. WHEN viewing the dashboard THEN the Sistem_Laporan SHALL display recent transactions list (last 5 transactions)
