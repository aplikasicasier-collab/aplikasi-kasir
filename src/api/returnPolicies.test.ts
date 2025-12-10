import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ReturnPolicy,
  PolicyCheckResult,
  checkReturnEligibility,
  isProductReturnable,
  checkFullReturnEligibility,
  calculateDaysBetween,
} from './returnPolicies';
import { Transaction } from '@/types';

// ============================================
// Helpers
// ============================================

function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'test-transaction-id',
    transaction_number: 'TRX-20251208-0001',
    user_id: 'test-user-id',
    total_amount: 100000,
    tax_amount: 10000,
    discount_amount: 0,
    payment_method: 'cash',
    transaction_date: new Date().toISOString(),
    status: 'completed',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockReturnPolicy(overrides: Partial<ReturnPolicy> = {}): ReturnPolicy {
  return {
    id: 'test-policy-id',
    max_return_days: 7,
    non_returnable_categories: [],
    require_receipt: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a date that is N days before today
 */
function createDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// ============================================
// Property 5: Return Policy Enforcement
// **Feature: retur-refund, Property 5: Return Policy Enforcement**
// **Validates: Requirements 3.2, 3.4**
// ============================================

describe('Property 5: Return Policy Enforcement', () => {
  /**
   * Property 5.1: Transaction beyond max_return_days requires approval
   * For any transaction date beyond the policy period, requires_approval = true
   */
  it('Property 5.1: Transaction beyond max_return_days requires approval', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),  // max_return_days
        fc.integer({ min: 1, max: 100 }), // extra days beyond limit
        (maxReturnDays, extraDays) => {
          const daysAgo = maxReturnDays + extraDays;
          const transactionDate = createDateDaysAgo(daysAgo);
          
          const transaction = createMockTransaction({
            transaction_date: transactionDate.toISOString(),
          });
          
          const policy = createMockReturnPolicy({
            max_return_days: maxReturnDays,
          });
          
          const result = checkReturnEligibility(transaction, policy);
          
          // Transaction beyond policy period should require approval
          return result.requires_approval === true && result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Transaction within max_return_days does not require approval
   * For any transaction date within the policy period, requires_approval = false
   */
  it('Property 5.2: Transaction within max_return_days does not require approval', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),  // max_return_days
        fc.integer({ min: 0, max: 29 }),  // days ago (within limit)
        (maxReturnDays, daysWithinLimit) => {
          // Ensure daysAgo is within the limit
          const daysAgo = Math.min(daysWithinLimit, maxReturnDays);
          const transactionDate = createDateDaysAgo(daysAgo);
          
          const transaction = createMockTransaction({
            transaction_date: transactionDate.toISOString(),
          });
          
          const policy = createMockReturnPolicy({
            max_return_days: maxReturnDays,
          });
          
          const result = checkReturnEligibility(transaction, policy);
          
          // Transaction within policy period should not require approval
          return result.requires_approval === false && result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Non-returnable category products are rejected
   * For any product in a non-returnable category, allowed = false
   */
  it('Property 5.3: Non-returnable category products are rejected', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                                    // categoryId
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // non-returnable categories
        (categoryId, nonReturnableCategories) => {
          // Include the categoryId in non-returnable list
          const allNonReturnable = [...nonReturnableCategories, categoryId];
          
          const policy = createMockReturnPolicy({
            non_returnable_categories: allNonReturnable,
          });
          
          const result = isProductReturnable(categoryId, policy);
          
          // Product in non-returnable category should be rejected
          return result.allowed === false && result.requires_approval === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Returnable category products are allowed
   * For any product NOT in a non-returnable category, allowed = true
   */
  it('Property 5.4: Returnable category products are allowed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                                    // categoryId
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }), // non-returnable categories
        (categoryId, nonReturnableCategories) => {
          // Ensure categoryId is NOT in the non-returnable list
          const filteredNonReturnable = nonReturnableCategories.filter(id => id !== categoryId);
          
          const policy = createMockReturnPolicy({
            non_returnable_categories: filteredNonReturnable,
          });
          
          const result = isProductReturnable(categoryId, policy);
          
          // Product not in non-returnable category should be allowed
          return result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Products without category are always returnable
   * For any product with null/undefined category, allowed = true
   */
  it('Property 5.5: Products without category are always returnable', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }), // non-returnable categories
        fc.constantFrom(null, undefined),                     // null or undefined category
        (nonReturnableCategories, categoryId) => {
          const policy = createMockReturnPolicy({
            non_returnable_categories: nonReturnableCategories,
          });
          
          const result = isProductReturnable(categoryId, policy);
          
          // Product without category should always be allowed
          return result.allowed === true && result.requires_approval === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: Combined check - non-returnable category takes precedence
   * For any product in non-returnable category, regardless of date, return is rejected
   */
  it('Property 5.6: Non-returnable category rejection takes precedence over date check', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                                    // categoryId
        fc.integer({ min: 0, max: 100 }),             // days ago
        fc.integer({ min: 1, max: 30 }),              // max_return_days
        (categoryId, daysAgo, maxReturnDays) => {
          const transactionDate = createDateDaysAgo(daysAgo);
          
          const transaction = createMockTransaction({
            transaction_date: transactionDate.toISOString(),
          });
          
          const policy = createMockReturnPolicy({
            max_return_days: maxReturnDays,
            non_returnable_categories: [categoryId],
          });
          
          const result = checkFullReturnEligibility(transaction, categoryId, policy);
          
          // Non-returnable category should always result in rejection
          return result.allowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: Combined check - returnable product with expired date requires approval
   */
  it('Property 5.7: Returnable product with expired date requires approval', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                        // categoryId (returnable)
        fc.integer({ min: 1, max: 30 }),  // max_return_days
        fc.integer({ min: 1, max: 100 }), // extra days beyond limit
        (categoryId, maxReturnDays, extraDays) => {
          const daysAgo = maxReturnDays + extraDays;
          const transactionDate = createDateDaysAgo(daysAgo);
          
          const transaction = createMockTransaction({
            transaction_date: transactionDate.toISOString(),
          });
          
          // Policy with empty non-returnable categories (all products returnable)
          const policy = createMockReturnPolicy({
            max_return_days: maxReturnDays,
            non_returnable_categories: [],
          });
          
          const result = checkFullReturnEligibility(transaction, categoryId, policy);
          
          // Returnable product beyond date should require approval
          return result.allowed === true && result.requires_approval === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Unit Tests for Helper Functions
// ============================================

describe('calculateDaysBetween', () => {
  it('should return 0 for same day', () => {
    const today = new Date();
    expect(calculateDaysBetween(today, today)).toBe(0);
  });

  it('should return correct days difference', () => {
    const date1 = new Date('2025-12-01');
    const date2 = new Date('2025-12-08');
    expect(calculateDaysBetween(date1, date2)).toBe(7);
  });

  it('should handle dates in reverse order', () => {
    const date1 = new Date('2025-12-08');
    const date2 = new Date('2025-12-01');
    expect(calculateDaysBetween(date1, date2)).toBe(7);
  });
});
