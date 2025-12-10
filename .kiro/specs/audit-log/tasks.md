# Implementation Plan

- [x] 1. Setup database schema for audit logs






  - [x] 1.1 Create SQL migration file

    - Add audit_logs, audit_alerts, audit_settings tables
    - Add indexes for performance
    - Add RLS policies (admin only)
    - Create audit log function
    - _Requirements: 1.1, 7.1_

  - [x] 1.2 Run migration on Supabase

    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [x] 2. Implement Audit Logger Utility






  - [x] 2.1 Create AuditLogger class

    - Implement `setContext()` for user/outlet context
    - Implement `logCreate()`, `logUpdate()`, `logDelete()`
    - Implement `logEvent()` for business events
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Create helper functions
    - Implement `calculateChangedFields()` for diff detection
    - Implement `generateSummary()` for human-readable summary
    - _Requirements: 4.2_
  - [x] 2.3 Write property tests for logging


    - **Property 1: CRUD Event Logging**
    - **Property 2: Metadata Capture**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
  - [x] 2.4 Write property test for changed fields


    - **Property 5: Changed Fields Detection**
    - **Validates: Requirements 4.2**

- [x] 3. Implement Audit Log API






  - [x] 3.1 Create audit log query functions

    - Implement `getAuditLogs()` with filters and pagination
    - Implement `getAuditLogById()`
    - Implement `getAuditLogsByEntity()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Write property test for filtering

    - **Property 4: Log Filtering Accuracy**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

- [x] 4. Integrate Audit Logging into Existing APIs





  - [x] 4.1 Add logging to Product API


    - Log create, update, delete, price change
    - _Requirements: 1.1, 2.5_

  - [x] 4.2 Add logging to Transaction API

    - Log transaction completion
    - _Requirements: 2.1_

  - [x] 4.3 Add logging to Return API

    - Log refund processing
    - _Requirements: 2.2_
  - [x] 4.4 Add logging to Stock API


    - Log stock adjustments
    - _Requirements: 2.3_

  - [x] 4.5 Add logging to User API

    - Log role changes
    - _Requirements: 2.4_

  - [x] 4.6 Write property test for business events

    - **Property 3: Business Event Logging**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Alert API





  - [x] 6.1 Create alert functions


    - Implement `getAlerts()` with filters
    - Implement `getUnresolvedAlerts()`
    - Implement `resolveAlert()`
    - Implement `createAlert()`
    - _Requirements: 7.4_

  - [x] 6.2 Create suspicious activity detection

    - Implement `checkFailedLoginThreshold()`
    - Implement `checkBulkDeleteThreshold()`
    - _Requirements: 7.1, 7.2_

  - [x] 6.3 Write property tests for alerts

    - **Property 8: Suspicious Activity Detection**
    - **Property 9: Alert Severity Assignment**
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [x] 7. Implement Export API






  - [x] 7.1 Create export functions

    - Implement `exportAuditLogs()` for CSV and JSON
    - Implement `generateExportFilename()` with timestamp
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.2 Write property test for export

    - **Property 6: Export Content Accuracy**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 8. Implement Retention API






  - [x] 8.1 Create retention functions

    - Implement `getRetentionSettings()`
    - Implement `updateRetentionSettings()`
    - Implement `getStorageStats()`
    - Implement `runRetentionCleanup()`
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 8.2 Write property test for retention

    - **Property 7: Retention Cleanup**
    - **Validates: Requirements 6.1, 6.2**

- [x] 9. Update Types






  - [x] 9.1 Add audit types to index.ts

    - Add AuditLog interface
    - Add AuditAlert interface
    - Add AuditSettings interface
    - Add AuditEventType and AuditEntityType types
    - Add AlertSeverity and AlertType types
    - _Requirements: 1.1, 7.1_

- [x] 10. Build Audit Log UI Components






  - [x] 10.1 Create Log List component

    - Display logs with event type, entity, user, timestamp
    - Add filter controls (date, user, entity, event type)
    - Add search input
    - Pagination
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 10.2 Create Log Detail component

    - Display full log information
    - Show before/after snapshots
    - Highlight changed fields
    - Show user info with role
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 10.3 Create Alert List component

    - Display alerts with severity badges
    - Filter by resolved/unresolved
    - Resolve button with notes
    - _Requirements: 7.4_

  - [x] 10.4 Create Export Modal component

    - Format selection (CSV/JSON)
    - Column selection
    - Export button
    - _Requirements: 5.1_

- [x] 11. Build Audit Log Page






  - [x] 11.1 Create main Audit Log page

    - Integrate Log List and Detail components
    - Add tabs for Logs and Alerts
    - Add state management
    - _Requirements: 3.1_

  - [x] 11.2 Update App.tsx routing

    - Add Audit Log page route (admin only)
    - Update navigation menu
    - _Requirements: 3.1_

- [x] 12. Build Retention Settings






  - [x] 12.1 Create Retention Settings component

    - Retention days input
    - Archive toggle
    - Storage stats display
    - Manual cleanup button
    - _Requirements: 6.1, 6.4_

  - [x] 12.2 Add to Settings page

    - Integrate retention settings (admin only)
    - _Requirements: 6.1_

- [x] 13. Integrate Alert Triggers






  - [x] 13.1 Add failed login alert trigger

    - Check threshold after failed login
    - Create alert if exceeded
    - _Requirements: 7.1_

  - [x] 13.2 Add bulk delete alert trigger

    - Check threshold after delete operations
    - Create alert if exceeded
    - _Requirements: 7.2_

- [x] 14. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
