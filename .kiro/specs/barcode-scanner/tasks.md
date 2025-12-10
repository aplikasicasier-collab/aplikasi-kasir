# Implementation Plan

- [x] 1. Setup database schema for barcode and stock opname






  - [x] 1.1 Create SQL migration file

    - Add barcode column to products table
    - Add stock_opnames, stock_opname_items, stock_adjustments tables
    - Add RLS policies
    - _Requirements: 3.1, 5.1, 5.4_


  - [x] 1.2 Run migration on Supabase





    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 3.1_

- [x] 2. Implement Barcode Utilities






  - [x] 2.1 Create barcode format detection functions

    - Implement `detectBarcodeFormat()` for EAN-13, EAN-8, UPC-A, Code 128
    - Implement validation functions for each format
    - Implement `calculateCheckDigit()` for EAN/UPC
    - _Requirements: 2.3, 3.3_
  - [x] 2.2 Write property tests for barcode format


    - **Property 2: Barcode Format Support**
    - **Property 4: Barcode Format Validation**
    - **Validates: Requirements 2.3, 3.3**

  - [x] 2.3 Create internal barcode generator

    - Implement `generateInternalBarcode()` with store prefix
    - Ensure uniqueness
    - _Requirements: 3.4, 3.5_
  - [x] 2.4 Write property test for internal barcode


    - **Property 5: Internal Barcode Generation**
    - **Validates: Requirements 3.4, 3.5**

- [x] 3. Implement Barcode API





  - [x] 3.1 Create barcode lookup function


    - Implement `lookupProductByBarcode()`
    - Return product or not found error
    - _Requirements: 1.3, 4.2_

  - [x] 3.2 Write property test for barcode lookup

    - **Property 6: Unknown Barcode Handling**
    - **Validates: Requirements 4.2**
  - [x] 3.3 Create barcode assignment functions


    - Implement `assignBarcodeToProduct()`
    - Implement `checkBarcodeUniqueness()`
    - _Requirements: 3.1, 3.2_

  - [x] 3.4 Write property test for barcode uniqueness

    - **Property 3: Barcode Uniqueness Validation**
    - **Validates: Requirements 3.2**

- [x] 4. Implement Cart Barcode Integration






  - [x] 4.1 Create cart barcode functions

    - Implement `addToCartByBarcode()` in cart store
    - Handle quantity increment for existing items
    - Check stock availability
    - _Requirements: 1.3, 1.4, 4.3_

  - [x] 4.2 Write property tests for cart barcode

    - **Property 1: Cart Addition on Barcode Scan**
    - **Property 7: Out of Stock Prevention**
    - **Validates: Requirements 1.3, 1.4, 4.3**

- [x] 5. Checkpoint - Ensure all tests pass








  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Stock Opname API





  - [x] 6.1 Create stock opname CRUD functions


    - Implement `createStockOpname()`
    - Implement `getStockOpnames()` with filters
    - Implement `getStockOpnameById()`
    - _Requirements: 5.1, 5.5_

  - [x] 6.2 Create opname item functions
    - Implement `addOpnameItem()` with discrepancy calculation
    - Implement `updateOpnameItem()`
    - _Requirements: 5.2, 5.3_
  - [x] 6.3 Write property test for discrepancy


    - **Property 8: Stock Opname Discrepancy Calculation**
    - **Validates: Requirements 5.3**
  - [x] 6.4 Create opname completion function

    - Implement `completeStockOpname()` with stock updates
    - Create stock_adjustment records
    - _Requirements: 5.4_

  - [x] 6.5 Write property test for opname completion

    - **Property 9: Stock Opname Completion**
    - **Validates: Requirements 5.4**

- [x] 7. Implement Label Generator






  - [x] 7.1 Create label generation functions

    - Implement `generateLabelSVG()` with barcode, name, price
    - Implement `generateLabelPDF()` for batch printing
    - Support 38x25mm and 50x30mm sizes
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.2 Write property test for label content

    - **Property 10: Label Generation Content**
    - **Validates: Requirements 6.1, 6.2**

- [x] 8. Update Types






  - [x] 8.1 Add barcode types to index.ts

    - Update Product interface with barcode field
    - Add StockOpname interface
    - Add StockOpnameItem interface
    - Add StockAdjustment interface
    - _Requirements: 3.1, 5.1_

- [x] 9. Install Barcode Scanner Library






  - [x] 9.1 Install @zxing/browser and @zxing/library

    - Add dependencies for camera barcode scanning
    - _Requirements: 1.1, 1.2_

- [x] 10. Build Scanner UI Components





  - [x] 10.1 Create Camera Scanner component


    - Implement camera viewfinder with ZXing
    - Add barcode detection overlay
    - Support continuous scanning mode
    - _Requirements: 1.1, 1.2, 5.1_

  - [x] 10.2 Create Barcode Input component

    - Text input for external scanner
    - Auto-submit on Enter key
    - _Requirements: 2.1, 2.4_

  - [x] 10.3 Create Scan Result Toast component

    - Show success/error/warning feedback
    - Display product info on success
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.4 Create Audio Feedback utility

    - Play beep sound on successful scan
    - _Requirements: 1.5_

- [x] 11. Build Stock Opname UI Components






  - [x] 11.1 Create Stock Opname List component

    - Display opname history with status
    - Filter by date and status
    - _Requirements: 5.5_

  - [x] 11.2 Create Stock Opname Scanner component

    - Continuous scanning mode
    - Display current stock and input for actual count
    - Highlight discrepancies
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 11.3 Create Stock Opname Summary component

    - Display all scanned items with discrepancies
    - Complete/cancel buttons
    - _Requirements: 5.4_

- [x] 12. Build Label Print UI Components






  - [x] 12.1 Create Product Selection component

    - Multi-select products for printing
    - Set quantity per product
    - _Requirements: 6.4_

  - [x] 12.2 Create Label Preview component

    - Show label preview with barcode
    - Size selection (38x25, 50x30)
    - _Requirements: 6.2, 6.3_

  - [x] 12.3 Create Print Button with PDF generation

    - Generate and download/print PDF
    - _Requirements: 6.1_

- [x] 13. Update Kasir Page






  - [x] 13.1 Add Camera Scanner button

    - Toggle camera scanner modal
    - _Requirements: 1.1_

  - [x] 13.2 Add Barcode Input field







    - Always visible for external scanner
    - Auto-focus option

    - _Requirements: 2.1, 2.4_

  - [x] 13.3 Integrate scan feedback





    - Show toast on scan result
    - Play audio feedback
    - _Requirements: 1.5, 4.1, 4.2, 4.3_




- [x] 14. Update Inventory Page



  - [x] 14.1 Add barcode field to product form

    - Input or scan barcode
    - Generate internal barcode button
    - _Requirements: 3.1, 3.4_

  - [x] 14.2 Add barcode column to product list

    - Display barcode if assigned
    - _Requirements: 3.1_


- [x] 15. Build Stock Opname Page







  - [x] 15.1 Create Stock Opname page

    - Integrate all opname components
    - Add state management
    - _Requirements: 5.1_

  - [x] 15.2 Update App.tsx routing


    - Add Stock Opname page route
    - _Requirements: 5.1_

- [x] 16. Build Label Print Page







  - [x] 16.1 Create Label Print page

    - Integrate product selection and preview
    - _Requirements: 6.1_

  - [x] 16.2 Update App.tsx routing

    - Add Label Print page route (under Inventory)
    - _Requirements: 6.1_

- [x] 17. Final Checkpoint - Ensure all tests pass





















  - Ensure all tests pass, ask the user if questions arise.
