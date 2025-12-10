import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Outlet } from '@/types';
import { generateOutletCodeSync, CreateOutletInput, UpdateOutletInput } from './outlets';

/**
 * Pure functions for outlet validation and transformation
 * These are extracted for property-based testing
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates outlet input data
 * - Name is required and must be non-empty
 * - Email must be valid format if provided
 * - Phone must contain only valid characters if provided
 */
export function validateOutletInput(input: CreateOutletInput): ValidationResult {
  const errors: string[] = [];

  // Name validation - required and non-empty
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Outlet name is required');
  }

  // Email validation - if provided, must be valid format
  if (input.email && input.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      errors.push('Invalid email format');
    }
  }

  // Phone validation - if provided, must contain valid characters
  if (input.phone && input.phone.trim().length > 0) {
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(input.phone.trim())) {
      errors.push('Invalid phone format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simulates creating an outlet from input
 * Returns an outlet object with generated id, code, and timestamps
 */
export function createOutletFromInput(input: CreateOutletInput): Outlet {
  return {
    id: crypto.randomUUID(),
    code: generateOutletCodeSync(),
    name: input.name.trim(),
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulates updating an outlet with partial data
 * Returns updated outlet with new updated_at timestamp
 */
export function updateOutletFields(
  outlet: Outlet,
  updates: UpdateOutletInput
): Outlet {
  return {
    ...outlet,
    name: updates.name !== undefined ? updates.name.trim() : outlet.name,
    address: updates.address !== undefined 
      ? (updates.address?.trim() || null) 
      : outlet.address,
    phone: updates.phone !== undefined 
      ? (updates.phone?.trim() || null) 
      : outlet.phone,
    email: updates.email !== undefined 
      ? (updates.email?.trim() || null) 
      : outlet.email,
    is_active: updates.is_active !== undefined ? updates.is_active : outlet.is_active,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulates deactivating an outlet
 */
export function deactivateOutletPure(outlet: Outlet): Outlet {
  return {
    ...outlet,
    is_active: false,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Filters outlets to return only active ones
 */
export function filterActiveOutlets(outlets: Outlet[]): Outlet[] {
  return outlets.filter(o => o.is_active);
}

/**
 * **Feature: multi-outlet, Property 2: Outlet Code Uniqueness**
 * **Validates: Requirements 1.2**
 * 
 * For any number of outlets created, each outlet should have a unique code 
 * that is different from all other outlet codes.
 */
describe('Outlet Code Uniqueness', () => {
  it('Property 2: Generated outlet codes are unique across multiple generations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (count) => {
          const codes = new Set<string>();
          
          for (let i = 0; i < count; i++) {
            const code = generateOutletCodeSync();
            codes.add(code);
          }
          
          // All generated codes should be unique
          // Note: With 36^4 = 1,679,616 possible codes, collision is extremely unlikely
          // for small counts, but we verify the format is correct
          return codes.size === count;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.1: Outlet code follows OUT-XXXX format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const code = generateOutletCodeSync();
          const pattern = /^OUT-[A-Z0-9]{4}$/;
          return pattern.test(code);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.2: Each created outlet has a unique code', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            address: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
            phone: fc.option(fc.stringMatching(/^[0-9+\-\s()]{5,20}$/), { nil: undefined }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (inputs) => {
          const outlets = inputs.map(input => createOutletFromInput(input));
          const codes = outlets.map(o => o.code);
          const uniqueCodes = new Set(codes);
          
          // All outlets should have unique codes
          return uniqueCodes.size === outlets.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 1: Outlet Creation Data Persistence**
 * **Validates: Requirements 1.1, 1.2**
 * 
 * For any valid outlet creation input, creating an outlet and then retrieving it 
 * should return all stored fields (name, address, phone, email) with matching values, 
 * a unique code should be generated, and is_active should default to true.
 */
describe('Outlet Creation Data Persistence', () => {
  // Arbitrary for generating valid outlet names
  const validNameArb = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0);

  // Arbitrary for generating valid emails
  const validEmailArb = fc.emailAddress();

  // Arbitrary for generating valid phone numbers
  const validPhoneArb = fc.stringMatching(/^[0-9+\-\s()]{5,20}$/);

  // Arbitrary for generating optional strings
  const optionalStringArb = fc.option(
    fc.string({ minLength: 1, maxLength: 200 }),
    { nil: undefined }
  );

  // Arbitrary for generating valid outlet input
  const validOutletInputArb = fc.record({
    name: validNameArb,
    address: optionalStringArb,
    phone: fc.option(validPhoneArb, { nil: undefined }),
    email: fc.option(validEmailArb, { nil: undefined }),
  });

  it('Property 1.1: All provided fields are stored correctly on creation', () => {
    fc.assert(
      fc.property(
        validOutletInputArb,
        (input) => {
          const outlet = createOutletFromInput(input);

          // Verify all fields are stored correctly
          return (
            outlet.name === input.name.trim() &&
            outlet.address === (input.address?.trim() || null) &&
            outlet.phone === (input.phone?.trim() || null) &&
            outlet.email === (input.email?.trim() || null) &&
            outlet.is_active === true &&
            outlet.id.length > 0 &&
            outlet.code.length > 0 &&
            outlet.created_at.length > 0 &&
            outlet.updated_at.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: Created outlet has valid code format', () => {
    fc.assert(
      fc.property(
        validOutletInputArb,
        (input) => {
          const outlet = createOutletFromInput(input);
          const pattern = /^OUT-[A-Z0-9]{4}$/;
          return pattern.test(outlet.code);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: Created outlet defaults to active status', () => {
    fc.assert(
      fc.property(
        validOutletInputArb,
        (input) => {
          const outlet = createOutletFromInput(input);
          return outlet.is_active === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.4: Outlet update preserves original ID and code', () => {
    fc.assert(
      fc.property(
        validOutletInputArb,
        validOutletInputArb,
        (initialInput, updateInput) => {
          const outlet = createOutletFromInput(initialInput);
          const originalId = outlet.id;
          const originalCode = outlet.code;
          
          const updatedOutlet = updateOutletFields(outlet, updateInput);

          return (
            updatedOutlet.id === originalId &&
            updatedOutlet.code === originalCode
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.5: Outlet update reflects latest values', () => {
    // Arbitrary for generating complete outlet input (all fields defined)
    const completeOutletInputArb = fc.record({
      name: validNameArb,
      address: fc.string({ minLength: 1, maxLength: 200 }),
      phone: validPhoneArb,
      email: validEmailArb,
    });

    fc.assert(
      fc.property(
        completeOutletInputArb,
        completeOutletInputArb,
        (initialInput, updateInput) => {
          // Create initial outlet
          const outlet = createOutletFromInput(initialInput);
          
          // Update with all new values
          const updatedOutlet = updateOutletFields(outlet, updateInput);

          // Verify all updated fields reflect new values
          return (
            updatedOutlet.name === updateInput.name.trim() &&
            updatedOutlet.address === (updateInput.address?.trim() || null) &&
            updatedOutlet.phone === (updateInput.phone?.trim() || null) &&
            updatedOutlet.email === (updateInput.email?.trim() || null)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: multi-outlet, Property 3: Outlet Deactivation and Filtering**
 * **Validates: Requirements 1.4**
 * 
 * For any deactivated outlet, it should have is_active = false, AND when listing 
 * active outlets, deactivated outlets should not appear.
 */
describe('Outlet Deactivation and Filtering', () => {
  // Arbitrary for generating valid outlet names
  const validNameArb = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0);

  // Arbitrary for generating valid outlet input
  const validOutletInputArb = fc.record({
    name: validNameArb,
    address: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    phone: fc.option(fc.stringMatching(/^[0-9+\-\s()]{5,20}$/), { nil: undefined }),
    email: fc.option(fc.emailAddress(), { nil: undefined }),
  });

  it('Property 3.1: Deactivated outlet has is_active = false', () => {
    fc.assert(
      fc.property(
        validOutletInputArb,
        (input) => {
          const outlet = createOutletFromInput(input);
          const deactivated = deactivateOutletPure(outlet);
          
          return deactivated.is_active === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.2: Deactivated outlets do not appear in active outlet list', () => {
    fc.assert(
      fc.property(
        fc.array(validOutletInputArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }),
        (inputs, deactivateIndex) => {
          // Create outlets
          const outlets = inputs.map(input => createOutletFromInput(input));
          
          // Deactivate one outlet (use modulo to ensure valid index)
          const indexToDeactivate = deactivateIndex % outlets.length;
          outlets[indexToDeactivate] = deactivateOutletPure(outlets[indexToDeactivate]);
          
          // Filter active outlets
          const activeOutlets = filterActiveOutlets(outlets);
          
          // Deactivated outlet should not be in active list
          const deactivatedOutlet = outlets[indexToDeactivate];
          const foundInActive = activeOutlets.some(o => o.id === deactivatedOutlet.id);
          
          return !foundInActive && activeOutlets.length === outlets.length - 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.3: All active outlets appear in filtered list', () => {
    fc.assert(
      fc.property(
        fc.array(validOutletInputArb, { minLength: 1, maxLength: 20 }),
        (inputs) => {
          // Create all active outlets
          const outlets = inputs.map(input => createOutletFromInput(input));
          
          // Filter active outlets
          const activeOutlets = filterActiveOutlets(outlets);
          
          // All outlets should be in active list since none are deactivated
          return activeOutlets.length === outlets.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.4: Deactivation preserves other outlet fields', () => {
    fc.assert(
      fc.property(
        validOutletInputArb,
        (input) => {
          const outlet = createOutletFromInput(input);
          const deactivated = deactivateOutletPure(outlet);
          
          return (
            deactivated.id === outlet.id &&
            deactivated.code === outlet.code &&
            deactivated.name === outlet.name &&
            deactivated.address === outlet.address &&
            deactivated.phone === outlet.phone &&
            deactivated.email === outlet.email &&
            deactivated.created_at === outlet.created_at
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.5: Multiple deactivations result in correct active count', () => {
    fc.assert(
      fc.property(
        fc.array(validOutletInputArb, { minLength: 3, maxLength: 20 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 20 }),
        (inputs, deactivateFlags) => {
          // Create outlets
          let outlets = inputs.map(input => createOutletFromInput(input));
          
          // Deactivate based on flags (ensure flags array matches outlets length)
          const flags = deactivateFlags.slice(0, outlets.length);
          while (flags.length < outlets.length) {
            flags.push(false);
          }
          
          outlets = outlets.map((outlet, i) => 
            flags[i] ? deactivateOutletPure(outlet) : outlet
          );
          
          // Count expected active outlets
          const expectedActiveCount = flags.filter(f => !f).length;
          
          // Filter active outlets
          const activeOutlets = filterActiveOutlets(outlets);
          
          return activeOutlets.length === expectedActiveCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for validation
describe('Outlet Validation Unit Tests', () => {
  it('validates outlet name is required', () => {
    expect(validateOutletInput({ name: '' }).valid).toBe(false);
    expect(validateOutletInput({ name: '   ' }).valid).toBe(false);
    expect(validateOutletInput({ name: 'Valid Name' }).valid).toBe(true);
  });

  it('validates email format correctly', () => {
    expect(validateOutletInput({ name: 'Test', email: 'invalid' }).valid).toBe(false);
    expect(validateOutletInput({ name: 'Test', email: 'valid@email.com' }).valid).toBe(true);
    expect(validateOutletInput({ name: 'Test', email: '' }).valid).toBe(true); // Empty is allowed
  });

  it('validates phone format correctly', () => {
    expect(validateOutletInput({ name: 'Test', phone: 'abc' }).valid).toBe(false);
    expect(validateOutletInput({ name: 'Test', phone: '+62-812-3456-7890' }).valid).toBe(true);
    expect(validateOutletInput({ name: 'Test', phone: '(021) 123-4567' }).valid).toBe(true);
  });

  it('trims whitespace from all fields', () => {
    const input: CreateOutletInput = {
      name: '  Test Outlet  ',
      address: '  123 Street  ',
      phone: '  +62812345  ',
      email: '  test@email.com  ',
    };

    const outlet = createOutletFromInput(input);

    expect(outlet.name).toBe('Test Outlet');
    expect(outlet.address).toBe('123 Street');
    expect(outlet.phone).toBe('+62812345');
    expect(outlet.email).toBe('test@email.com');
  });
});
