# Implementation Plan

- [-] 1. Setup database schema for transactions




  - [ ] 1.1 Create SQL migration file for transactions, transaction_items, and stock_movements tables
    - Add tables with proper constraints and foreign keys
    - Add RLS policies for authenticated users
    - _Requirements: 1.1, 1.2, 2.2_
  - [ ] 1.2 Run migration on Supabase
    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [ ] 2. Implement Transaction API
  - [ ] 2.1 Create transaction number generator function
    - Implement `generateTransactionNumber()` with format TRX-YYYYMMDD-XXXX
    - Query latest transaction for current date to get next sequence
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ] 2.2 Write property test for transaction number generation
    - **Property 7: Transaction Number Format and Uniqueness**
    - **Validates: Requirements 5.1, 5.2**
  - [ ] 2.3 Create transaction API functions
    - Implement `createTransaction()` that saves transaction and items
    - Implement `getTransactionById()` for receipt retrieval
    - _Requirements: 1.1, 1.2_
  - [ ] 2.4 Write property test for transaction creation
    - **Property 1: Transaction Creation Completeness**
    - **Validates: Requirements 1.1, 1.2**

- [ ] 3. Implement Stock API
  - [ ] 3.1 Create stock validation function
    - Implement `validateStockAvailability()` to check all cart items
    - Return detailed errors for insufficient stock
    - _Requirements: 2.3_
  - [ ] 3.2 Write property test for stock validation
    - **Property 3: Stock Validation Prevents Overselling**
    - **Validates: Requirements 2.3**
  - [ ] 3.3 Create stock update functions
    - Implement `updateStock()` for single product
    - Implement `bulkUpdateStock()` for transaction items
    - Create stock_movement records
    - _Requirements: 2.1, 2.2_
  - [ ] 3.4 Write property test for stock reduction
    - **Property 2: Stock Reduction Consistency**
    - **Validates: Requirements 2.1, 2.2**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Receipt Generation
  - [ ] 5.1 Create receipt formatter utility
    - Implement `formatReceipt()` function that generates receipt string
    - Include all required fields: store name, transaction number, items, totals
    - _Requirements: 3.1_
  - [ ] 5.2 Write property test for receipt generation
    - **Property 4: Receipt Contains All Required Information**
    - **Validates: Requirements 3.1**
  - [ ] 5.3 Create ReceiptModal component
    - Build modal with receipt preview
    - Add print button that triggers browser print
    - Add close button to dismiss modal
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Implement Payment Validation
  - [ ] 6.1 Create checkout validation functions
    - Implement `validateCheckout()` that checks cart and payment
    - Validate cash payment amount for cash method
    - Allow card/e-wallet without cash validation
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 6.2 Write property tests for payment validation
    - **Property 5: Payment Validation Logic**
    - **Property 6: Empty Cart Rejection**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 7. Update Kasir Page with Checkout Flow
  - [ ] 7.1 Add checkout state management
    - Add loading state for checkout process
    - Add completed transaction state for receipt
    - Add error state for failed transactions
    - _Requirements: 1.3, 1.4, 4.4_
  - [ ] 7.2 Implement checkout handler
    - Validate stock availability before checkout
    - Validate payment amount for cash
    - Create transaction and update stock
    - Show receipt modal on success
    - Handle errors with retry option
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_
  - [ ] 7.3 Update UI for payment validation
    - Disable checkout button when payment insufficient
    - Show warning message for insufficient cash
    - Show loading indicator during checkout
    - _Requirements: 4.1, 4.4_
  - [ ] 7.4 Integrate ReceiptModal
    - Show modal after successful transaction
    - Pass transaction data to modal
    - Clear cart and reset state after modal close
    - _Requirements: 3.2, 3.4_
  - [ ] 7.5 Refresh product list after checkout
    - Reload products to show updated stock
    - _Requirements: 2.4_

- [ ] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
