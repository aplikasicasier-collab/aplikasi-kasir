# Implementation Plan

- [x] 1. Setup database schema for purchase orders
  - [x] 1.1 Create SQL migration file for suppliers, purchase_orders, and purchase_order_items tables
    - Add tables with proper constraints and foreign keys
    - Add RLS policies for authenticated users
    - _Requirements: 1.1, 1.2, 5.1_
  - [x] 1.2 Run migration on Supabase
    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [x] 2. Implement Supplier API
  - [x] 2.1 Create supplier API functions
    - Implement `createSupplier()`, `getSuppliers()`, `getSupplierById()`
    - Implement `updateSupplier()`, `deleteSupplier()`
    - _Requirements: 5.1, 5.2_
  - [x] 2.2 Write property test for supplier CRUD





    - **Property 7: Supplier CRUD Operations**
    - **Validates: Requirements 5.1, 5.2**

- [x] 3. Implement Purchase Order API














  - [x] 3.1 Create PO number generator function


    - Implement `generatePONumber()` with format PO-YYYYMMDD-XXXX
    - Query latest PO for current date to get next sequence
    - _Requirements: 1.1_


  - [x] 3.2 Write property test for PO creation validation


    - **Property 1: PO Creation Validation**
    - **Validates: Requirements 1.1, 1.4, 1.5**
  - [x] 3.3 Create purchase order CRUD functions


    - Implement `createPurchaseOrder()` with items and total calculation
    - Implement `getPurchaseOrders()` with filters
    - Implement `getPurchaseOrderById()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1_

  - [x] 3.4 Write property test for PO items and total
    - **Property 2: PO Items and Total Calculation**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 3.5 Implement PO filtering and search


    - Add status filter, date range filter, search by order number/supplier
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.6 Write property test for PO filtering

    - **Property 6: PO Filtering and Search**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 4. Implement Status Management






  - [x] 4.1 Create status update functions

    - Implement `approvePurchaseOrder()` for pending to approved
    - Implement `cancelPurchaseOrder()` for cancellation
    - Add validation for terminal states (received, cancelled)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write property test for status transitions

    - **Property 3: Status Transition Rules**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Receive PO and Stock Update





  - [x] 6.1 Create receive purchase order function


    - Implement `receivePurchaseOrder()` that updates status
    - Increase stock for each product by received quantity
    - Create stock_movement records with type 'in'
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Write property test for receive PO

    - **Property 4: Receive PO and Stock Update**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x] 6.3 Implement partial receipt handling


    - Allow specifying actual received quantities per item
    - Record discrepancy in notes when received != ordered
    - _Requirements: 4.4, 4.5_

  - [x] 6.4 Write property test for partial receipt

    - **Property 5: Partial Receipt Handling**
    - **Validates: Requirements 4.4, 4.5**

- [x] 7. Implement Low Stock Feature





  - [x] 7.1 Create low stock query function


    - Implement `getLowStockProducts()` returning products where stock <= min_stock
    - Include suggested order quantity calculation
    - _Requirements: 6.1, 6.3_

  - [x] 7.2 Write property test for low stock query

    - **Property 8: Low Stock Query**
    - **Validates: Requirements 6.1, 6.3**

- [x] 8. Build Purchase Order UI Components





  - [x] 8.1 Create Supplier Modal component


    - Build form for add/edit supplier
    - Include validation for required fields
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Create Low Stock Alert component

    - Display products below min_stock
    - Add checkbox selection for quick add to PO
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.3 Create PO Form component

    - Build form for creating new purchase order
    - Include supplier selection dropdown
    - Include product selection with quantity and price
    - Calculate and display total amount
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.4 Create PO List component

    - Display list of purchase orders with key info
    - Add filter controls for status and date range
    - Add search input for order number/supplier
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.5 Create PO Detail component

    - Display full PO information with items
    - Add approve/cancel buttons for pending POs
    - Add receive button for approved POs
    - Include partial receipt form
    - _Requirements: 3.1, 3.2, 4.1, 4.4_

- [x] 9. Build Purchase Order Page





  - [x] 9.1 Create main Pemesanan page


    - Integrate all PO components
    - Add state management for selected PO and modals
    - _Requirements: 2.1_


  - [x] 9.2 Update App.tsx routing





    - Replace placeholder with actual Pemesanan component
    - _Requirements: 2.1_

- [x] 10. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
