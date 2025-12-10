# Requirements Document

## Introduction

Fitur User Management adalah modul untuk mengelola pengguna aplikasi POS beserta role dan permission-nya. Fitur ini memungkinkan admin untuk membuat, mengedit, dan menghapus user, serta mengatur akses berdasarkan role (admin, manager, kasir). Tujuannya adalah menyediakan sistem kontrol akses yang aman dan terstruktur untuk operasional toko.

## Glossary

- **Sistem_User**: Modul aplikasi POS yang menangani manajemen pengguna dan akses
- **User**: Pengguna aplikasi yang memiliki kredensial login dan role tertentu
- **Role**: Tingkat akses pengguna yang menentukan fitur apa saja yang dapat diakses
- **Permission**: Hak akses spesifik untuk melakukan aksi tertentu dalam aplikasi
- **Admin**: Role dengan akses penuh ke semua fitur termasuk manajemen user
- **Manager**: Role dengan akses ke laporan, inventory, dan pemesanan, tanpa akses manajemen user
- **Kasir**: Role dengan akses terbatas hanya untuk transaksi kasir

## Requirements

### Requirement 1

**User Story:** As an admin, I want to create new user accounts, so that staff can access the POS system with appropriate permissions.

#### Acceptance Criteria

1. WHEN an admin creates a new user THEN the Sistem_User SHALL store email, password, full name, and assigned role
2. WHEN an admin creates a user THEN the Sistem_User SHALL validate email format and uniqueness
3. WHEN an admin creates a user THEN the Sistem_User SHALL require password with minimum 8 characters
4. WHEN a user is created THEN the Sistem_User SHALL set the account status to 'active' by default
5. WHEN creating a user THEN the Sistem_User SHALL require selection of exactly one role (admin, manager, or kasir)

### Requirement 2

**User Story:** As an admin, I want to view and manage existing users, so that I can maintain accurate user records and access control.

#### Acceptance Criteria

1. WHEN an admin opens the user list THEN the Sistem_User SHALL display all users with name, email, role, status, and last login date
2. WHEN an admin edits a user THEN the Sistem_User SHALL allow updating name, email, role, and status
3. WHEN an admin deactivates a user THEN the Sistem_User SHALL set status to 'inactive' and prevent login
4. WHEN an admin reactivates a user THEN the Sistem_User SHALL set status to 'active' and allow login
5. WHEN an admin searches users THEN the Sistem_User SHALL filter by name or email

### Requirement 3

**User Story:** As an admin, I want to reset user passwords, so that I can help users who forgot their credentials.

#### Acceptance Criteria

1. WHEN an admin resets a user password THEN the Sistem_User SHALL generate a temporary password
2. WHEN a password is reset THEN the Sistem_User SHALL require the user to change password on next login
3. WHEN displaying reset password THEN the Sistem_User SHALL show the temporary password only once

### Requirement 4

**User Story:** As a user, I want to change my own password, so that I can maintain account security.

#### Acceptance Criteria

1. WHEN a user changes password THEN the Sistem_User SHALL require current password verification
2. WHEN a user changes password THEN the Sistem_User SHALL validate new password minimum 8 characters
3. WHEN a user changes password THEN the Sistem_User SHALL require new password confirmation match
4. WHEN password change succeeds THEN the Sistem_User SHALL update the password immediately

### Requirement 5

**User Story:** As a system, I want to enforce role-based access control, so that users can only access features appropriate to their role.

#### Acceptance Criteria

1. WHILE a user has role 'admin' THEN the Sistem_User SHALL grant access to all features including user management
2. WHILE a user has role 'manager' THEN the Sistem_User SHALL grant access to inventory, pemesanan, laporan, kategori, and supplier
3. WHILE a user has role 'kasir' THEN the Sistem_User SHALL grant access only to kasir and dashboard features
4. WHEN a user attempts to access unauthorized feature THEN the Sistem_User SHALL redirect to dashboard with access denied message
5. WHEN displaying navigation menu THEN the Sistem_User SHALL show only features accessible to user's role

### Requirement 6

**User Story:** As a user, I want to see my profile information, so that I can verify my account details.

#### Acceptance Criteria

1. WHEN a user views profile THEN the Sistem_User SHALL display name, email, role, and last login date
2. WHEN a user views profile THEN the Sistem_User SHALL provide option to change password
3. WHEN displaying profile THEN the Sistem_User SHALL show account creation date

### Requirement 7

**User Story:** As an admin, I want to view user activity logs, so that I can monitor system usage and security.

#### Acceptance Criteria

1. WHEN an admin views user activity THEN the Sistem_User SHALL display login history with timestamp and IP address
2. WHEN an admin views user activity THEN the Sistem_User SHALL show last 30 days of activity
3. WHEN displaying activity log THEN the Sistem_User SHALL include login success and failure events
