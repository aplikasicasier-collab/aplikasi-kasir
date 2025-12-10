import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Supplier } from '@/types';

/**
 * Pure functions for supplier validation and transformation
 * These are extracted for property-based testing
 */

// Validate supplier input data
export interface SupplierInput {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates supplier input data
 * - Name is required and must be non-empty
 * - Email must be valid format if provided
 * - Phone must contain only valid characters if provided
 */
export function validateSupplierInput(input: SupplierInput): ValidationResult {
  const errors: string[] = [];

  // Name validation - required and non-empty
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Supplier name is required');
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
 * Simulates creating a supplier from input
 * Returns a supplier object with generated id and timestamps
 */
export function createSupplierFromInput(input: SupplierInput): Supplier {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    contact_person: input.contact_person?.trim(),
    phone: input.phone?.trim(),
    email: input.email?.trim(),
    address: input.address?.trim(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulates updating a supplier with partial data
 * Returns updated supplier with new updated_at timestamp
 */
export function updateSupplierFields(
  supplier: Supplier,
  updates: Partial<SupplierInput>
): Supplier {
  return {
    ...supplier,
    name: updates.name !== undefined ? updates.name.trim() : supplier.name,
    contact_person: updates.contact_person !== undefined 
      ? updates.contact_person?.trim() 
      : supplier.contact_person,
    phone: updates.phone !== undefined ? updates.phone?.trim() : supplier.phone,
    email: updates.email !== undefined ? updates.email?.trim() : supplier.email,
    address: updates.address !== undefined ? updates.address?.trim() : supplier.address,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Checks if two suppliers have the same field values (excluding timestamps)
 */
export function suppliersFieldsEqual(a: Supplier, b: Supplier): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.contact_person === b.contact_person &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.address === b.address &&
    a.is_active === b.is_active
  );
}

/**
 * **Feature: purchase-order, Property 7: Supplier CRUD Operations**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * For any supplier creation or update, all provided fields (name, contact_person, 
 * phone, email, address) should be stored correctly, AND the supplier record 
 * should reflect the latest values after update.
 */
describe('Supplier CRUD Operations', () => {
  // Arbitrary for generating valid supplier names
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

  // Arbitrary for generating valid supplier input
  const validSupplierInputArb = fc.record({
    name: validNameArb,
    contact_person: optionalStringArb,
    phone: fc.option(validPhoneArb, { nil: undefined }),
    email: fc.option(validEmailArb, { nil: undefined }),
    address: optionalStringArb,
  });

  it('Property 7.1: All provided fields are stored correctly on creation', () => {
    fc.assert(
      fc.property(
        validSupplierInputArb,
        (input) => {
          const supplier = createSupplierFromInput(input);

          // Verify all fields are stored correctly
          return (
            supplier.name === input.name.trim() &&
            supplier.contact_person === input.contact_person?.trim() &&
            supplier.phone === input.phone?.trim() &&
            supplier.email === input.email?.trim() &&
            supplier.address === input.address?.trim() &&
            supplier.is_active === true &&
            supplier.id.length > 0 &&
            supplier.created_at.length > 0 &&
            supplier.updated_at.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Supplier record reflects latest values after full update', () => {
    // Arbitrary for generating complete supplier input (all fields defined)
    const completeSupplierInputArb = fc.record({
      name: validNameArb,
      contact_person: fc.string({ minLength: 1, maxLength: 100 }),
      phone: validPhoneArb,
      email: validEmailArb,
      address: fc.string({ minLength: 1, maxLength: 200 }),
    });

    fc.assert(
      fc.property(
        completeSupplierInputArb,
        completeSupplierInputArb,
        (initialInput, updateInput) => {
          // Create initial supplier
          const supplier = createSupplierFromInput(initialInput);
          
          // Update with all new values (full update)
          const updatedSupplier = updateSupplierFields(supplier, updateInput);

          // Verify all updated fields reflect new values
          return (
            updatedSupplier.name === updateInput.name.trim() &&
            updatedSupplier.contact_person === updateInput.contact_person.trim() &&
            updatedSupplier.phone === updateInput.phone.trim() &&
            updatedSupplier.email === updateInput.email.trim() &&
            updatedSupplier.address === updateInput.address.trim() &&
            // ID should remain unchanged
            updatedSupplier.id === supplier.id &&
            // is_active should remain unchanged
            updatedSupplier.is_active === supplier.is_active
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Partial updates only modify specified fields', () => {
    fc.assert(
      fc.property(
        validSupplierInputArb,
        validNameArb,
        (initialInput, newName) => {
          // Create initial supplier
          const supplier = createSupplierFromInput(initialInput);
          
          // Update only the name
          const updatedSupplier = updateSupplierFields(supplier, { name: newName });

          // Verify only name changed, other fields remain the same
          return (
            updatedSupplier.name === newName.trim() &&
            updatedSupplier.contact_person === supplier.contact_person &&
            updatedSupplier.phone === supplier.phone &&
            updatedSupplier.email === supplier.email &&
            updatedSupplier.address === supplier.address &&
            updatedSupplier.id === supplier.id
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: Validation rejects empty supplier name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '),
        optionalStringArb,
        optionalStringArb,
        (emptyName, contactPerson, address) => {
          const input: SupplierInput = {
            name: emptyName,
            contact_person: contactPerson,
            address: address,
          };

          const result = validateSupplierInput(input);

          return !result.valid && result.errors.includes('Supplier name is required');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: Validation accepts valid supplier input', () => {
    fc.assert(
      fc.property(
        validSupplierInputArb,
        (input) => {
          const result = validateSupplierInput(input);
          return result.valid && result.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: Created supplier has unique ID', () => {
    fc.assert(
      fc.property(
        validSupplierInputArb,
        validSupplierInputArb,
        (input1, input2) => {
          const supplier1 = createSupplierFromInput(input1);
          const supplier2 = createSupplierFromInput(input2);

          // Each created supplier should have a unique ID
          return supplier1.id !== supplier2.id;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.7: Update preserves original ID and created_at', () => {
    fc.assert(
      fc.property(
        validSupplierInputArb,
        validSupplierInputArb,
        (initialInput, updateInput) => {
          const supplier = createSupplierFromInput(initialInput);
          const originalId = supplier.id;
          const originalCreatedAt = supplier.created_at;
          
          const updatedSupplier = updateSupplierFields(supplier, updateInput);

          return (
            updatedSupplier.id === originalId &&
            updatedSupplier.created_at === originalCreatedAt
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for edge cases
describe('Supplier Validation Unit Tests', () => {
  it('validates email format correctly', () => {
    expect(validateSupplierInput({ name: 'Test', email: 'invalid' }).valid).toBe(false);
    expect(validateSupplierInput({ name: 'Test', email: 'valid@email.com' }).valid).toBe(true);
    expect(validateSupplierInput({ name: 'Test', email: '' }).valid).toBe(true); // Empty is allowed
  });

  it('validates phone format correctly', () => {
    expect(validateSupplierInput({ name: 'Test', phone: 'abc' }).valid).toBe(false);
    expect(validateSupplierInput({ name: 'Test', phone: '+62-812-3456-7890' }).valid).toBe(true);
    expect(validateSupplierInput({ name: 'Test', phone: '(021) 123-4567' }).valid).toBe(true);
  });

  it('trims whitespace from all fields', () => {
    const input: SupplierInput = {
      name: '  Test Supplier  ',
      contact_person: '  John Doe  ',
      phone: '  +62812345  ',
      email: '  test@email.com  ',
      address: '  123 Street  ',
    };

    const supplier = createSupplierFromInput(input);

    expect(supplier.name).toBe('Test Supplier');
    expect(supplier.contact_person).toBe('John Doe');
    expect(supplier.phone).toBe('+62812345');
    expect(supplier.email).toBe('test@email.com');
    expect(supplier.address).toBe('123 Street');
  });
});
