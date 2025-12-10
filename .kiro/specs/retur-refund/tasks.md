# Implementation Plan

- [x] 1. Setup database schema for returns






  - [x] 1.1 Create SQL migration file

    - Add return_policies, returns, return_items tables
    - Add returned_quantity column to transaction_items
    - Add RLS policies
    - _Requirements: 1.1, 3.1, 4.1_

  - [x] 1.2 Run migration on Supabase

    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [x] 2. Implement Return Policy API






  - [x] 2.1 Create return policy functions

    - Implement `getReturnPolicy()`
    - Implement `updateReturnPolicy()`
    - _Requirements: 3.1, 3.3_

  - [x] 2.2 Create policy check functions
    - Implement `checkReturnEligibility()` with date check
    - Implement `isProductReturnable()` with category check
    - _Requirements: 3.2, 3.4_
  - [x] 2.3 Write property test for policy enforcement


    - **Property 5: Return Policy Enforcement**
    - **Validates: Requirements 3.2, 3.4**

- [x] 3. Implement Retur API



  - [x] 3.1 Create return number generator


    - Implement `generateReturnNumber()` with format RTN-YYYYMMDD-XXXX
    - _Requirements: 1.5_

  - [x] 3.2 Write property test for return number

    - **Property 3: Return Number Format and Uniqueness**
    - **Validates: Requirements 1.5**

  - [x] 3.3 Create return validation functions
    - Implement transaction lookup
    - Implement quantity validation against already returned
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 3.4 Write property tests for return validation

    - **Property 1: Return Requires Valid Transaction**
    - **Property 2: Return Quantity Validation**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [x] 3.5 Create return CRUD functions
    - Implement `createReturn()` with policy check
    - Implement `getReturns()` with filters
    - Implement `getReturnById()`
    - Implement `getReturnsByTransaction()`
    - _Requirements: 1.1, 1.3_
  - [x] 3.6 Create return completion functions
    - Implement `completeReturn()` with stock update
    - Implement `cancelReturn()`
    - _Requirements: 4.1, 4.2_
  - [x] 3.7 Write property test for stock update

    - **Property 6: Stock Update on Return Completion**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [x] 4. Implement Refund API






  - [x] 4.1 Create refund calculation function

    - Implement `calculateRefund()` preserving original discounts
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Write property test for refund calculation

    - **Property 4: Refund Calculation with Discounts**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 4.3 Create refund processing function


    - Implement `processRefund()` with method recording
    - Update transaction records
    - _Requirements: 2.3, 2.5_

- [x] 5. Implement Approval API






  - [x] 5.1 Create approval functions

    - Implement `getPendingApprovals()`
    - Implement `approveReturn()` with reason recording
    - Implement `rejectReturn()` with reason recording
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 5.2 Write property tests for approval

    - **Property 9: Approval Workflow**
    - **Property 10: Pending Approvals List**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 6. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Return Report API






  - [x] 7.1 Create return report functions

    - Implement `getReturnReportSummary()` with date range
    - Include breakdown by reason
    - Include top returned products
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.2 Write property test for report

    - **Property 7: Return Report Accuracy**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 8. Implement Return Receipt Generator






  - [x] 8.1 Create receipt generation function

    - Implement `generateReturnReceipt()`
    - Include all required fields
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Write property test for receipt

    - **Property 8: Return Receipt Content**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 9. Update Types






  - [x] 9.1 Add return types to index.ts

    - Add Return interface
    - Add ReturnItem interface
    - Add ReturnPolicy interface
    - Add ReturnReason and ReturnStatus types
    - Update TransactionItem with returned_quantity
    - _Requirements: 1.1, 3.1_

- [x] 10. Build Retur UI Components






  - [x] 10.1 Create Transaction Lookup component

    - Input for transaction number
    - Display transaction details when found
    - _Requirements: 1.1, 1.2_


  - [x] 10.2 Create Return Item Selector component
    - Display transaction items
    - Allow selecting items with quantity and reason
    - Show already returned quantities
    - Validate against available quantity
    - _Requirements: 1.3, 1.4_
  - [x] 10.3 Create Retur Form component

    - Integrate lookup and item selector
    - Calculate refund preview
    - Submit return
    - _Requirements: 1.1, 2.1_
  - [x] 10.4 Create Retur List component


    - Display returns with status
    - Filter by status and date
    - _Requirements: 1.5_
  - [x] 10.5 Create Retur Detail component


    - Display return info and items
    - Show refund calculation
    - Complete/cancel buttons
    - _Requirements: 2.1, 2.4_

- [x] 11. Build Approval UI Components





  - [x] 11.1 Create Pending Approval List component


    - Display returns awaiting approval
    - Show return details and reason for approval
    - _Requirements: 7.4_

  - [x] 11.2 Create Approval Modal component

    - Approve/reject buttons
    - Reason input field
    - _Requirements: 7.2, 7.3_

- [x] 12. Build Return Policy Settings






  - [x] 12.1 Create Return Policy Form component

    - Max return days input
    - Non-returnable categories multi-select
    - _Requirements: 3.1, 3.3_

  - [x] 12.2 Add to Settings page

    - Integrate policy form
    - _Requirements: 3.1_

- [x] 13. Build Retur Page

















  - [x] 13.1 Create main Retur page

    - Integrate all retur components
    - Add state management
    - _Requirements: 1.1_


  - [x] 13.2 Update App.tsx routing


    - Add Retur page route
    - Update navigation menu
    - _Requirements: 1.1_

- [x] 14. Build Return Report






  - [x] 14.1 Create Return Report component

    - Display summary metrics
    - Show breakdown by reason chart
    - Show top returned products
    - Date range filter
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 14.2 Add to Laporan page

    - Add Return Report tab
    - _Requirements: 5.1_

- [x] 15. Update Receipt Modal






  - [x] 15.1 Create Return Receipt component

    - Display return receipt format
    - Print functionality
    - _Requirements: 6.1, 6.4_

  - [x] 15.2 Integrate with Retur Detail

    - Show receipt after completion
    - _Requirements: 6.1_

- [x] 16. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
