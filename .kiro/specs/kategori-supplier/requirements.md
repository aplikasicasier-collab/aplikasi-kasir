# Requirements Document

## Introduction

Fitur Manajemen Kategori dan Supplier adalah modul untuk mengelola data master kategori produk dan supplier pada aplikasi Point of Sale (POS). Fitur ini memungkinkan pengguna untuk membuat, membaca, mengupdate, dan menghapus data kategori dan supplier yang digunakan untuk mengorganisir produk dan melacak sumber pembelian.

## Glossary

- **Sistem_Master**: Modul aplikasi POS yang menangani pengelolaan data master
- **Kategori**: Pengelompokan produk berdasarkan jenis atau karakteristik tertentu
- **Supplier**: Pihak ketiga yang menyediakan produk untuk dijual di toko

## Requirements

### Requirement 1

**User Story:** As a store manager, I want to manage product categories, so that I can organize products and make them easier to find.

#### Acceptance Criteria

1. WHEN a user opens the category management page THEN the Sistem_Master SHALL display a list of all categories with name and description
2. WHEN a user creates a new category THEN the Sistem_Master SHALL save the category with name and optional description
3. WHEN a user edits a category THEN the Sistem_Master SHALL update the category name and description
4. WHEN a user deletes a category THEN the Sistem_Master SHALL remove the category if no products are assigned to it
5. IF a category has assigned products THEN the Sistem_Master SHALL prevent deletion and display a warning message

### Requirement 2

**User Story:** As a store manager, I want to manage suppliers, so that I can track where products come from and contact them for restocking.

#### Acceptance Criteria

1. WHEN a user opens the supplier management page THEN the Sistem_Master SHALL display a list of all suppliers with name, contact person, phone, and email
2. WHEN a user creates a new supplier THEN the Sistem_Master SHALL save the supplier with name and optional contact information
3. WHEN a user edits a supplier THEN the Sistem_Master SHALL update all supplier fields
4. WHEN a user deletes a supplier THEN the Sistem_Master SHALL remove the supplier if no products are assigned to it
5. IF a supplier has assigned products THEN the Sistem_Master SHALL prevent deletion and display a warning message

### Requirement 3

**User Story:** As a store manager, I want to assign categories and suppliers to products, so that I can organize inventory and track sources.

#### Acceptance Criteria

1. WHEN editing a product THEN the Sistem_Master SHALL display dropdown selectors for category and supplier
2. WHEN a category or supplier is selected THEN the Sistem_Master SHALL save the association to the product
3. WHEN filtering products THEN the Sistem_Master SHALL allow filtering by category
