# Requirements Document

## Introduction

Fitur Multi-outlet adalah modul untuk mengelola beberapa toko atau cabang dalam satu sistem POS. Fitur ini memungkinkan admin untuk membuat dan mengelola outlet, mengatur stok per outlet, melihat laporan per outlet atau gabungan, dan mengatur akses user ke outlet tertentu. Tujuannya adalah menyediakan sistem terpusat untuk mengelola operasional multi-cabang.

## Glossary

- **Sistem_Outlet**: Modul aplikasi POS yang menangani manajemen multi-outlet
- **Outlet**: Toko atau cabang fisik yang memiliki stok dan transaksi sendiri
- **Outlet_Utama**: Outlet pusat yang dapat melihat data semua outlet
- **Stok_Outlet**: Jumlah stok produk yang tersedia di outlet tertentu
- **Transfer_Stok**: Perpindahan stok dari satu outlet ke outlet lain
- **User_Outlet**: Asosiasi antara user dengan outlet yang dapat diakses

## Requirements

### Requirement 1

**User Story:** As an admin, I want to create and manage outlets, so that I can set up multiple store locations in the system.

#### Acceptance Criteria

1. WHEN an admin creates an outlet THEN the Sistem_Outlet SHALL store outlet name, address, phone, and email
2. WHEN an admin creates an outlet THEN the Sistem_Outlet SHALL generate a unique outlet code
3. WHEN an admin edits an outlet THEN the Sistem_Outlet SHALL allow updating name, address, phone, email, and status
4. WHEN an admin deactivates an outlet THEN the Sistem_Outlet SHALL set status to 'inactive' and hide from active outlet list
5. WHEN listing outlets THEN the Sistem_Outlet SHALL display outlet name, code, address, and status

### Requirement 2

**User Story:** As an admin, I want to assign users to specific outlets, so that staff can only access their assigned locations.

#### Acceptance Criteria

1. WHEN an admin assigns a user to outlets THEN the Sistem_Outlet SHALL store the user-outlet associations
2. WHEN an admin assigns a user THEN the Sistem_Outlet SHALL allow assigning to one or multiple outlets
3. WHEN a user logs in THEN the Sistem_Outlet SHALL show only assigned outlets for selection
4. WHEN a user has multiple outlets THEN the Sistem_Outlet SHALL require outlet selection before accessing features
5. WHEN a user is admin THEN the Sistem_Outlet SHALL grant access to all outlets without assignment

### Requirement 3

**User Story:** As a manager, I want to manage stock per outlet, so that each location has accurate inventory records.

#### Acceptance Criteria

1. WHEN viewing inventory THEN the Sistem_Outlet SHALL display stock quantities for the selected outlet only
2. WHEN adding stock THEN the Sistem_Outlet SHALL update stock for the selected outlet only
3. WHEN a product is created THEN the Sistem_Outlet SHALL initialize stock to zero for all active outlets
4. WHEN viewing product details THEN the Sistem_Outlet SHALL show stock breakdown by outlet
5. WHEN stock is updated THEN the Sistem_Outlet SHALL create stock_movement record with outlet reference

### Requirement 4

**User Story:** As a manager, I want to transfer stock between outlets, so that I can balance inventory across locations.

#### Acceptance Criteria

1. WHEN a manager creates a stock transfer THEN the Sistem_Outlet SHALL record source outlet, destination outlet, products, and quantities
2. WHEN a stock transfer is created THEN the Sistem_Outlet SHALL validate source outlet has sufficient stock
3. WHEN a stock transfer is approved THEN the Sistem_Outlet SHALL decrease stock at source and increase at destination
4. WHEN a stock transfer is completed THEN the Sistem_Outlet SHALL create stock_movement records for both outlets
5. WHEN viewing transfers THEN the Sistem_Outlet SHALL display transfer history with status and timestamps

### Requirement 5

**User Story:** As a kasir, I want transactions to be recorded for my current outlet, so that sales are tracked per location.

#### Acceptance Criteria

1. WHEN a transaction is created THEN the Sistem_Outlet SHALL record the current outlet ID
2. WHEN checkout is processed THEN the Sistem_Outlet SHALL deduct stock from the current outlet only
3. WHEN viewing transaction history THEN the Sistem_Outlet SHALL show only transactions from the current outlet
4. WHEN generating receipt THEN the Sistem_Outlet SHALL include outlet name and address

### Requirement 6

**User Story:** As a manager, I want to view reports per outlet or combined, so that I can analyze performance across locations.

#### Acceptance Criteria

1. WHEN viewing reports THEN the Sistem_Outlet SHALL provide outlet filter to select specific outlet or all outlets
2. WHEN filtering by specific outlet THEN the Sistem_Outlet SHALL show data for that outlet only
3. WHEN selecting all outlets THEN the Sistem_Outlet SHALL show combined data from all outlets
4. WHEN viewing dashboard THEN the Sistem_Outlet SHALL show summary for current outlet with option to view all

### Requirement 7

**User Story:** As an admin, I want to set a default outlet for users, so that they start with their primary location.

#### Acceptance Criteria

1. WHEN an admin assigns outlets to user THEN the Sistem_Outlet SHALL allow setting one outlet as default
2. WHEN a user logs in with default outlet THEN the Sistem_Outlet SHALL automatically select the default outlet
3. WHEN a user has no default THEN the Sistem_Outlet SHALL require manual outlet selection on login
