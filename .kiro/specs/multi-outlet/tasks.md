# Implementation Plan

- [x] 1. Setup database schema for multi-outlet






  - [x] 1.1 Create SQL migration file for outlets, user_outlets, outlet_stock, stock_transfers tables

    - Add tables with proper constraints and foreign keys
    - Add RLS policies for outlet-based access
    - Alter existing tables to add outlet_id column
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_


  - [x] 1.2 Run migration on Supabase





    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [x] 2. Implement Outlet API





  - [x] 2.1 Create outlet code generator function


    - Implement `generateOutletCode()` with format OUT-XXXX
    - Ensure uniqueness
    - _Requirements: 1.2_

  - [x] 2.2 Write property test for outlet code

    - **Property 2: Outlet Code Uniqueness**
    - **Validates: Requirements 1.2**
  - [x] 2.3 Create outlet CRUD functions


    - Implement `createOutlet()` with code generation
    - Implement `getOutlets()` with active filter
    - Implement `getOutletById()`
    - Implement `updateOutlet()`, `deactivateOutlet()`
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 2.4 Write property tests for outlet CRUD

    - **Property 1: Outlet Creation Data Persistence**
    - **Property 3: Outlet Deactivation and Filtering**
    - **Validates: Requirements 1.1, 1.4**

- [x] 3. Implement User Outlet API






  - [x] 3.1 Create user outlet assignment functions

    - Implement `assignUserToOutlets()`
    - Implement `getUserOutlets()`
    - Implement `setDefaultOutlet()`
    - Implement `removeUserFromOutlet()`
    - _Requirements: 2.1, 2.2, 7.1_

  - [x] 3.2 Write property tests for user outlet

    - **Property 4: User Outlet Assignment**
    - **Property 5: Default Outlet Selection**
    - **Validates: Requirements 2.1, 2.3, 2.5, 7.1, 7.2**

- [x] 4. Implement Outlet Stock API






  - [x] 4.1 Create outlet stock functions

    - Implement `getOutletStock()`
    - Implement `getProductStockByOutlet()`
    - Implement `updateOutletStock()`
    - Implement `initializeProductStock()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write property tests for outlet stock

    - **Property 6: Outlet-Scoped Stock**
    - **Property 7: Product Stock Initialization**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 5. Implement Stock Transfer API






  - [x] 5.1 Create stock transfer functions

    - Implement `createStockTransfer()` with validation
    - Implement `getStockTransfers()` with filters
    - Implement `approveStockTransfer()`
    - Implement `completeStockTransfer()` with stock updates
    - Implement `cancelStockTransfer()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.2 Write property tests for stock transfer

    - **Property 8: Stock Transfer Validation**
    - **Property 9: Stock Transfer Completion**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 6. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update Types






  - [x] 7.1 Add Outlet types to index.ts

    - Add Outlet interface
    - Add UserOutlet interface
    - Add OutletStock interface
    - Add StockTransfer and StockTransferItem interfaces
    - Update Transaction with outlet_id
    - _Requirements: 1.1, 4.1, 5.1_

- [x] 8. Create Outlet Context






  - [x] 8.1 Implement OutletContext provider

    - Create context with currentOutlet, availableOutlets
    - Implement setCurrentOutlet function
    - Load user outlets on mount
    - Handle default outlet auto-selection
    - _Requirements: 2.3, 2.4, 7.2_

  - [x] 8.2 Create useOutlet hook
    - Provide easy access to outlet context
    - _Requirements: 2.3_

- [x] 9. Update Existing APIs for Outlet Support





  - [x] 9.1 Update Stock API


    - Modify stock functions to use outlet context
    - Add outlet_id to stock_movement records
    - _Requirements: 3.2, 3.5_

  - [x] 9.2 Update Transaction API

    - Modify createTransaction to include outlet_id
    - Modify getTransactions to filter by outlet
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 9.3 Write property tests for outlet-scoped operations

    - **Property 10: Outlet-Scoped Transactions**
    - **Property 11: Outlet-Scoped Transaction History**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x] 9.4 Update Report API


    - Add outlet filter to all report functions
    - Support "all outlets" aggregation
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.5 Write property test for report filtering

    - **Property 12: Report Outlet Filtering**
    - **Validates: Requirements 6.2, 6.3**

- [x] 10. Build Outlet Management UI Components






  - [x] 10.1 Create Outlet Selector component

    - Dropdown in header/navbar
    - Show current outlet name
    - Allow switching outlets
    - _Requirements: 2.3, 2.4_

  - [x] 10.2 Create Outlet List component

    - Display outlets table with code, name, address, status
    - Add filter by status
    - _Requirements: 1.5_

  - [x] 10.3 Create Outlet Form Modal

    - Build form for create/edit outlet
    - Include name, address, phone, email
    - _Requirements: 1.1, 1.3_

  - [x] 10.4 Create User Outlet Assignment Modal

    - Multi-select outlets for user
    - Set default outlet option
    - _Requirements: 2.1, 2.2, 7.1_

- [x] 11. Build Stock Transfer UI Components








  - [x] 11.1 Create Stock Transfer List component


    - Display transfers with source, destination, status
    - Add filter by status
    - _Requirements: 4.5_

  - [x] 11.2 Create Stock Transfer Form

    - Select source and destination outlets
    - Add products with quantities
    - Show available stock at source
    - _Requirements: 4.1, 4.2_

  - [x] 11.3 Create Stock Transfer Detail component

    - Display transfer info and items
    - Add approve/complete/cancel buttons
    - _Requirements: 4.3_

- [x] 12. Build Outlet Management Page





  - [x] 12.1 Create main Outlet page


    - Integrate Outlet List and Form components
    - Add state management
    - _Requirements: 1.1_

  - [x] 12.2 Update App.tsx routing

    - Add Outlet page route
    - Update navigation menu
    - _Requirements: 1.1_

- [x] 13. Build Stock Transfer Page





  - [x] 13.1 Create Stock Transfer page


    - Integrate Transfer List, Form, Detail components
    - Add state management
    - _Requirements: 4.1_

  - [x] 13.2 Update App.tsx routing

    - Add Stock Transfer page route
    - _Requirements: 4.1_

- [x] 14. Update Existing Pages for Outlet Support





  - [x] 14.1 Update Inventory page


    - Show stock for current outlet
    - Show stock breakdown by outlet in product detail
    - _Requirements: 3.1, 3.4_

  - [x] 14.2 Update Kasir page

    - Use current outlet for stock check
    - Deduct stock from current outlet
    - _Requirements: 5.2_

  - [x] 14.3 Update Receipt

    - Include outlet name and address
    - _Requirements: 5.4_

  - [x] 14.4 Update Laporan page

    - Add outlet filter to all reports
    - Show current outlet data by default
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 15. Update Login Flow






  - [x] 15.1 Add outlet selection after login

    - Show outlet selector if user has multiple outlets
    - Auto-select default outlet if set
    - _Requirements: 2.3, 2.4, 7.2, 7.3_

- [x] 16. Update User Management






  - [x] 16.1 Add outlet assignment to user form

    - Integrate User Outlet Assignment Modal
    - _Requirements: 2.1, 2.2_

- [x] 17. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
