# Implementation Plan

- [x] 1. Setup database schema for discounts and promos






  - [x] 1.1 Create SQL migration file for discounts, promos, and promo_products tables

    - Add tables with proper constraints and foreign keys
    - Add RLS policies for role-based access
    - Alter transaction_items to include discount columns
    - _Requirements: 1.1, 2.1, 4.5_


  - [x] 1.2 Run migration on Supabase





    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [x] 2. Implement Discount Calculation Utilities






  - [x] 2.1 Create discount calculation functions

    - Implement `calculatePercentageDiscount()` function
    - Implement `calculateNominalDiscount()` function
    - Implement `calculateDiscountedPrice()` function
    - _Requirements: 4.3, 4.4_

  - [x] 2.2 Write property test for discount calculation

    - **Property 7: Discount Calculation Accuracy**
    - **Validates: Requirements 4.3, 4.4**

  - [x] 2.3 Create cart discount functions

    - Implement `getApplicableDiscount()` function
    - Implement `calculateCartWithDiscounts()` function
    - _Requirements: 4.1, 4.2_

  - [x] 2.4 Write property test for cart total

    - **Property 8: Cart Total with Discounts**
    - **Validates: Requirements 4.2**

  - [x] 2.5 Create minimum purchase functions

    - Implement `checkMinimumPurchase()` function
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.6 Write property tests for minimum purchase

    - **Property 9: Minimum Purchase Requirement**
    - **Property 10: Remaining Amount Calculation**
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 3. Implement Discount API





  - [x] 3.1 Create discount validation functions


    - Implement percentage validation (1-100)
    - Implement nominal validation (> 0 and < product price)
    - _Requirements: 1.2, 1.3_

  - [x] 3.2 Write property tests for discount validation

    - **Property 2: Percentage Discount Validation**
    - **Property 3: Nominal Discount Validation**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 3.3 Create discount CRUD functions


    - Implement `createDiscount()` with uniqueness check
    - Implement `getDiscounts()` with filters
    - Implement `getActiveDiscountByProductId()`
    - Implement `updateDiscount()`, `deactivateDiscount()`, `deleteDiscount()`
    - _Requirements: 1.1, 1.4, 1.5, 3.1, 3.3, 3.4_

  - [x] 3.4 Write property tests for discount CRUD

    - **Property 1: Discount Creation Data Persistence**
    - **Property 4: Discount Uniqueness Per Product**
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 4. Implement Promo API





  - [x] 4.1 Create promo CRUD functions


    - Implement `createPromo()` with date validation
    - Implement `getPromos()` with filters
    - Implement `getActivePromos()` based on current date
    - Implement `updatePromo()`, `deletePromo()`
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.2, 3.5_

  - [x] 4.2 Write property tests for promo

    - **Property 5: Promo Creation and Date Validation**
    - **Property 6: Promo Period Activation**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**


  - [x] 4.3 Create promo product functions





    - Implement `addProductsToPromo()`
    - Implement `removeProductFromPromo()`
    - _Requirements: 2.3_

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Discount Report API






  - [x] 6.1 Create discount report functions

    - Implement `getDiscountReportSummary()` with date range
    - Implement `getPromoPerformance()`
    - Implement `getDiscountedTransactions()`
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 6.2 Write property test for discount report

    - **Property 11: Discount Report Accuracy**
    - **Validates: Requirements 5.1, 5.2**

- [x] 7. Update Types






  - [x] 7.1 Add Discount and Promo types to index.ts

    - Add Discount interface
    - Add Promo interface
    - Add PromoProduct interface
    - Update TransactionItem with discount fields
    - _Requirements: 1.1, 2.1_

- [x] 8. Build Discount & Promo UI Components





  - [x] 8.1 Create Discount List component


    - Display discounts table with product name, type, value, status
    - Add filter by status
    - Add activate/deactivate toggle
    - _Requirements: 3.1, 3.4_

  - [x] 8.2 Create Discount Form Modal

    - Build form for create/edit discount
    - Include product selection, discount type, value
    - Add validation feedback
    - _Requirements: 1.1, 1.2, 1.3, 3.3_

  - [x] 8.3 Create Promo List component

    - Display promos table with name, period, product count, status
    - Show active/upcoming/expired status
    - _Requirements: 3.2_

  - [x] 8.4 Create Promo Form Modal

    - Build form for create/edit promo
    - Include name, description, dates, discount details
    - Include product multi-select
    - Include optional minimum purchase
    - _Requirements: 2.1, 2.2, 2.3, 6.1_

- [x] 9. Build Diskon & Promo Page











  - [x] 9.1 Create main Diskon page with tabs


    - Create tab navigation for Discounts and Promos
    - Integrate all components
    - Add state management
    - _Requirements: 3.1, 3.2_


  - [x] 9.2 Update App.tsx routing

    - Add Diskon page route
    - Update navigation menu
    - _Requirements: 3.1_

- [x] 10. Update Kasir Page for Discounts



  - [x] 10.1 Integrate discount display in cart


    - Show original price and discounted price
    - Show discount badge on discounted items
    - _Requirements: 4.1_

  - [x] 10.2 Update cart total calculation
    - Apply active discounts to eligible products
    - Show total savings

    - _Requirements: 4.2_
  - [x] 10.3 Add minimum purchase indicator
    - Show promo eligibility status

    - Show remaining amount for promo
    - _Requirements: 6.2, 6.3, 6.4_
  - [x] 10.4 Update receipt with discount info


    - Show original price, discount, final price per item
    - Show total discount amount
    - _Requirements: 4.5_

- [x] 11. Update Checkout Flow






  - [x] 11.1 Update transaction creation with discounts

    - Save discount_id and promo_id in transaction_items
    - Save original_price and discount_amount
    - _Requirements: 4.5, 5.1_

- [x] 12. Add Discount Report to Laporan





  - [x] 12.1 Create Discount Report component


    - Display total sales with discounts
    - Display total discount amount given
    - Add date range filter
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 12.2 Update Laporan page

    - Add Discount Report tab
    - _Requirements: 5.1_

- [x] 13. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
