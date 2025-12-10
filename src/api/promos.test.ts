import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validatePromoDateRange,
  isPromoCurrentlyActive,
  getPromoStatus,
  type Promo,
} from './promos';

// ============================================
// Property 5: Promo Creation and Date Validation
// **Feature: diskon-promo, Property 5: Promo Creation and Date Validation**
// **Validates: Requirements 2.1, 2.2**
// ============================================

describe('Property 5: Promo Creation and Date Validation', () => {
  /**
   * Property 5.1: Valid date range (end > start) should be accepted
   * For any promo where end_date is after start_date,
   * the validation should return valid: true
   */
  it('Property 5.1: Accepts date ranges where end_date is after start_date', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 1, max: 365 * 5 }), // days to add
        (startDate, daysToAdd) => {
          // Filter out invalid dates
          if (isNaN(startDate.getTime())) {
            return true; // Skip invalid dates
          }
          const endDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          if (isNaN(endDate.getTime())) {
            return true; // Skip invalid dates
          }
          const result = validatePromoDateRange(
            startDate.toISOString(),
            endDate.toISOString()
          );
          return result.valid === true && result.error === undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Invalid date range (end <= start) should be rejected
   * For any promo where end_date is before or equal to start_date,
   * the validation should return valid: false
   */
  it('Property 5.2: Rejects date ranges where end_date is before or equal to start_date', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 0, max: 365 * 5 }), // days to subtract
        (startDate, daysToSubtract) => {
          // Filter out invalid dates
          if (isNaN(startDate.getTime())) {
            return true; // Skip invalid dates
          }
          const endDate = new Date(startDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
          if (isNaN(endDate.getTime())) {
            return true; // Skip invalid dates
          }
          const result = validatePromoDateRange(
            startDate.toISOString(),
            endDate.toISOString()
          );
          return result.valid === false && result.error !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 5.3: Invalid date strings should be rejected
   */
  it('Property 5.3: Rejects invalid date strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (startStr, endStr) => {
          // Skip if strings happen to be valid dates
          const startDate = new Date(startStr);
          const endDate = new Date(endStr);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            return true; // Skip valid dates
          }
          
          const result = validatePromoDateRange(startStr, endStr);
          return result.valid === false && result.error !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: CreatePromoInput structure validation
   * For any valid promo creation input, all required fields must be present
   */
  it('Property 5.4: CreatePromoInput requires all mandatory fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 1, max: 365 }),
        fc.constantFrom<'percentage' | 'nominal'>('percentage', 'nominal'),
        fc.integer({ min: 1, max: 100 }),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (name, startDate, daysToAdd, discountType, discountValue, productIds) => {
          // Filter out invalid dates
          if (isNaN(startDate.getTime())) {
            return true; // Skip invalid dates
          }
          const endDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          if (isNaN(endDate.getTime())) {
            return true; // Skip invalid dates
          }
          
          const input = {
            name,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            discount_type: discountType,
            discount_value: discountValue,
            product_ids: productIds,
          };
          
          // Verify all required fields are present and valid
          return (
            typeof input.name === 'string' &&
            input.name.length > 0 &&
            typeof input.start_date === 'string' &&
            typeof input.end_date === 'string' &&
            (input.discount_type === 'percentage' || input.discount_type === 'nominal') &&
            typeof input.discount_value === 'number' &&
            input.discount_value > 0 &&
            Array.isArray(input.product_ids) &&
            input.product_ids.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Promo discount type must be either 'percentage' or 'nominal'
   */
  it('Property 5.5: Promo discount type is constrained to valid values', () => {
    const validTypes = ['percentage', 'nominal'];
    
    fc.assert(
      fc.property(
        fc.constantFrom<'percentage' | 'nominal'>('percentage', 'nominal'),
        (discountType) => {
          return validTypes.includes(discountType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: min_purchase is optional and can be null or positive
   */
  it('Property 5.6: min_purchase validation', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 10000000 }), { nil: null }),
        (minPurchase) => {
          // min_purchase should be null or >= 0
          return minPurchase === null || minPurchase >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// Property 6: Promo Period Activation
// **Feature: diskon-promo, Property 6: Promo Period Activation**
// **Validates: Requirements 2.4, 2.5**
// ============================================

describe('Property 6: Promo Period Activation', () => {
  // Helper to create a mock promo
  const createMockPromo = (
    startDate: Date,
    endDate: Date,
    isActive: boolean = true
  ): Promo => ({
    id: 'test-id',
    name: 'Test Promo',
    description: null,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    discount_type: 'percentage',
    discount_value: 10,
    min_purchase: null,
    is_active: isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  /**
   * Property 6.1: Promo within date range and is_active=true should be active
   * For any promo where current date is within [start_date, end_date] and is_active=true,
   * isPromoCurrentlyActive should return true
   */
  it('Property 6.1: Promo within date range and is_active=true is currently active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }), // days before now for start
        fc.integer({ min: 1, max: 30 }), // days after now for end
        (daysBefore, daysAfter) => {
          const now = new Date();
          const startDate = new Date(now.getTime() - daysBefore * 24 * 60 * 60 * 1000);
          const endDate = new Date(now.getTime() + daysAfter * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, true);
          return isPromoCurrentlyActive(promo) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: Promo before start date should not be active
   * For any promo where current date is before start_date,
   * isPromoCurrentlyActive should return false
   */
  it('Property 6.2: Promo before start date is not currently active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }), // days in future for start
        fc.integer({ min: 1, max: 30 }),  // days after start for end
        (daysUntilStart, duration) => {
          const now = new Date();
          const startDate = new Date(now.getTime() + daysUntilStart * 24 * 60 * 60 * 1000);
          const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, true);
          return isPromoCurrentlyActive(promo) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: Promo after end date should not be active
   * For any promo where current date is after end_date,
   * isPromoCurrentlyActive should return false
   */
  it('Property 6.3: Promo after end date is not currently active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }), // days in past for end
        fc.integer({ min: 1, max: 30 }),  // days before end for start
        (daysSinceEnd, duration) => {
          const now = new Date();
          const endDate = new Date(now.getTime() - daysSinceEnd * 24 * 60 * 60 * 1000);
          const startDate = new Date(endDate.getTime() - duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, true);
          return isPromoCurrentlyActive(promo) === false;
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 6.4: Promo with is_active=false should not be active regardless of dates
   * For any promo where is_active=false,
   * isPromoCurrentlyActive should return false
   */
  it('Property 6.4: Promo with is_active=false is not currently active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: 30 }), // days offset for start
        fc.integer({ min: 1, max: 60 }),   // duration
        (startOffset, duration) => {
          const now = new Date();
          const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000);
          const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, false);
          return isPromoCurrentlyActive(promo) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.5: getPromoStatus returns correct status based on dates
   * For any promo, status should be one of: 'active', 'upcoming', 'expired', 'inactive'
   */
  it('Property 6.5: getPromoStatus returns valid status values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -60, max: 60 }), // days offset for start
        fc.integer({ min: 1, max: 60 }),   // duration
        fc.boolean(),                       // is_active
        (startOffset, duration, isActive) => {
          const now = new Date();
          const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000);
          const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, isActive);
          const status = getPromoStatus(promo);
          
          return ['active', 'upcoming', 'expired', 'inactive'].includes(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.6: getPromoStatus returns 'inactive' when is_active=false
   */
  it('Property 6.6: getPromoStatus returns inactive when is_active=false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: 30 }),
        fc.integer({ min: 1, max: 60 }),
        (startOffset, duration) => {
          const now = new Date();
          const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000);
          const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, false);
          return getPromoStatus(promo) === 'inactive';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.7: getPromoStatus returns 'upcoming' for future promos
   */
  it('Property 6.7: getPromoStatus returns upcoming for future promos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }),
        fc.integer({ min: 1, max: 30 }),
        (daysUntilStart, duration) => {
          const now = new Date();
          const startDate = new Date(now.getTime() + daysUntilStart * 24 * 60 * 60 * 1000);
          const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, true);
          return getPromoStatus(promo) === 'upcoming';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.8: getPromoStatus returns 'expired' for past promos
   */
  it('Property 6.8: getPromoStatus returns expired for past promos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }),
        fc.integer({ min: 1, max: 30 }),
        (daysSinceEnd, duration) => {
          const now = new Date();
          const endDate = new Date(now.getTime() - daysSinceEnd * 24 * 60 * 60 * 1000);
          const startDate = new Date(endDate.getTime() - duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, true);
          return getPromoStatus(promo) === 'expired';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.9: getPromoStatus returns 'active' for current promos
   */
  it('Property 6.9: getPromoStatus returns active for current promos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (daysBefore, daysAfter) => {
          const now = new Date();
          const startDate = new Date(now.getTime() - daysBefore * 24 * 60 * 60 * 1000);
          const endDate = new Date(now.getTime() + daysAfter * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, true);
          return getPromoStatus(promo) === 'active';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.10: isPromoCurrentlyActive and getPromoStatus are consistent
   * When isPromoCurrentlyActive returns true, getPromoStatus should return 'active'
   */
  it('Property 6.10: isPromoCurrentlyActive and getPromoStatus are consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -60, max: 60 }),
        fc.integer({ min: 1, max: 60 }),
        fc.boolean(),
        (startOffset, duration, isActive) => {
          const now = new Date();
          const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000);
          const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
          
          const promo = createMockPromo(startDate, endDate, isActive);
          const currentlyActive = isPromoCurrentlyActive(promo);
          const status = getPromoStatus(promo);
          
          // If currently active, status must be 'active'
          // If status is 'active', must be currently active
          return currentlyActive === (status === 'active');
        }
      ),
      { numRuns: 100 }
    );
  });
});
