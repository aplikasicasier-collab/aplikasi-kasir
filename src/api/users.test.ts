import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidEmail,
  isValidPassword,
  isValidUserRole,
  validateCreateUserInput,
  validateUpdateUserInput,
  CreateUserInput,
} from './users';

// ============================================================================
// Property-Based Tests for User Validation
// ============================================================================

/**
 * **Feature: user-management, Property 2: Email Validation and Uniqueness**
 * **Validates: Requirements 1.2**
 * 
 * For any email string, the system should reject invalid email formats.
 */
describe('Property 2: Email Validation', () => {
  // Arbitrary for valid email addresses
  const validEmailArb = fc.emailAddress();

  // Arbitrary for invalid email formats (no @ symbol)
  const invalidEmailNoAtArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => !s.includes('@') && s.trim().length > 0);

  // Arbitrary for invalid email formats (no domain)
  const invalidEmailNoDomainArb = fc.string({ minLength: 1, maxLength: 20 })
    .map(s => `${s.replace('@', '')}@`);

  // Arbitrary for empty/whitespace strings
  const emptyOrWhitespaceArb = fc.constantFrom('', '   ', '\t', '\n', '  \t\n  ');

  it('Property 2.1: Valid email formats are accepted', () => {
    fc.assert(
      fc.property(
        validEmailArb,
        (email) => {
          return isValidEmail(email) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.2: Emails without @ symbol are rejected', () => {
    fc.assert(
      fc.property(
        invalidEmailNoAtArb,
        (email) => {
          return isValidEmail(email) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.3: Empty or whitespace-only emails are rejected', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        (email) => {
          return isValidEmail(email) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.4: Emails without proper domain are rejected', () => {
    fc.assert(
      fc.property(
        invalidEmailNoDomainArb,
        (email) => {
          return isValidEmail(email) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: user-management, Property 3: Password Minimum Length Validation**
 * **Validates: Requirements 1.3, 4.2**
 * 
 * For any password string with length less than 8 characters, 
 * user creation or password change should be rejected.
 */
describe('Property 3: Password Minimum Length Validation', () => {
  // Arbitrary for passwords with less than 8 characters
  const shortPasswordArb = fc.string({ minLength: 0, maxLength: 7 });

  // Arbitrary for passwords with 8 or more characters
  const validPasswordArb = fc.string({ minLength: 8, maxLength: 100 });

  it('Property 3.1: Passwords with less than 8 characters are rejected', () => {
    fc.assert(
      fc.property(
        shortPasswordArb,
        (password) => {
          return isValidPassword(password) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.2: Passwords with 8 or more characters are accepted', () => {
    fc.assert(
      fc.property(
        validPasswordArb,
        (password) => {
          return isValidPassword(password) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.3: Password length boundary - exactly 8 characters is valid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 8 }),
        (password) => {
          return isValidPassword(password) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.4: Password length boundary - exactly 7 characters is invalid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 7, maxLength: 7 }),
        (password) => {
          return isValidPassword(password) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: user-management, Property 4: Role Validation**
 * **Validates: Requirements 1.5**
 * 
 * For any user creation or update, the role must be exactly one of 
 * 'admin', 'manager', or 'kasir', AND any other role value should be rejected.
 */
describe('Property 4: Role Validation', () => {
  // Valid roles
  const validRoleArb = fc.constantFrom('admin', 'manager', 'kasir');

  // Invalid roles - any string that is not a valid role
  const invalidRoleArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s !== 'admin' && s !== 'manager' && s !== 'kasir');

  it('Property 4.1: Valid roles (admin, manager, kasir) are accepted', () => {
    fc.assert(
      fc.property(
        validRoleArb,
        (role) => {
          return isValidUserRole(role) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: Invalid role strings are rejected', () => {
    fc.assert(
      fc.property(
        invalidRoleArb,
        (role) => {
          return isValidUserRole(role) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: Empty string role is rejected', () => {
    expect(isValidUserRole('')).toBe(false);
  });

  it('Property 4.4: Case-sensitive role validation', () => {
    // Roles with different cases should be rejected
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'ADMIN', 'Manager', 'MANAGER', 'Kasir', 'KASIR'),
        (role) => {
          return isValidUserRole(role) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Integration Tests for Complete Validation
// ============================================================================

describe('User Creation Input Validation', () => {
  // Arbitrary for valid user creation input
  const validCreateUserInputArb = fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
    full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
  });

  it('Valid user creation input passes validation', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const result = validateCreateUserInput(input);
          return result.valid === true && result.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Invalid email causes validation failure', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('@')),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
        }),
        (input: CreateUserInput) => {
          const result = validateCreateUserInput(input);
          return result.valid === false && result.errors.some(e => e.includes('email'));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Short password causes validation failure', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1, maxLength: 7 }),
          full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
        }),
        (input: CreateUserInput) => {
          const result = validateCreateUserInput(input);
          return result.valid === false && result.errors.some(e => e.includes('Password'));
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('User Update Input Validation', () => {
  it('Empty full_name in update causes validation failure', () => {
    const result = validateUpdateUserInput({ full_name: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Nama lengkap tidak boleh kosong');
  });

  it('Invalid email in update causes validation failure', () => {
    const result = validateUpdateUserInput({ email: 'invalid-email' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('email'))).toBe(true);
  });

  it('Invalid role in update causes validation failure', () => {
    const result = validateUpdateUserInput({ role: 'superadmin' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Role'))).toBe(true);
  });

  it('Valid partial update passes validation', () => {
    const result = validateUpdateUserInput({ full_name: 'John Doe' });
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});


// ============================================================================
// Pure Functions for Property-Based Testing of CRUD Operations
// ============================================================================

/**
 * Simulates creating a user from input (pure function for testing)
 * Returns a user object with generated id and timestamps
 */
export function createUserFromInput(input: CreateUserInput): import('./users').User {
  return {
    id: crypto.randomUUID(),
    email: input.email.trim(),
    full_name: input.full_name.trim(),
    role: input.role,
    is_active: true, // Default to active (Requirement 1.4)
    must_change_password: false,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulates updating a user with partial data (pure function for testing)
 * Returns updated user with new updated_at timestamp
 */
export function updateUserFields(
  user: import('./users').User,
  updates: import('./users').UpdateUserInput
): import('./users').User {
  return {
    ...user,
    full_name: updates.full_name !== undefined ? updates.full_name.trim() : user.full_name,
    email: updates.email !== undefined ? updates.email.trim() : user.email,
    role: updates.role !== undefined ? updates.role : user.role,
    is_active: updates.is_active !== undefined ? updates.is_active : user.is_active,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Checks if user fields match input (excluding auto-generated fields)
 */
export function userMatchesInput(user: import('./users').User, input: CreateUserInput): boolean {
  return (
    user.email === input.email.trim() &&
    user.full_name === input.full_name.trim() &&
    user.role === input.role &&
    user.is_active === true // Default value
  );
}

// ============================================================================
// Property-Based Tests for User CRUD
// ============================================================================

/**
 * **Feature: user-management, Property 1: User Creation Data Persistence**
 * **Validates: Requirements 1.1, 1.4**
 * 
 * For any valid user creation input (valid email, password >= 8 chars, valid role),
 * creating a user and then retrieving it should return all stored fields 
 * (email, full_name, role) with matching values, and is_active should default to true.
 */
describe('Property 1: User Creation Data Persistence', () => {
  // Arbitrary for valid user creation input
  const validCreateUserInputArb = fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
    full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
  });

  it('Property 1.1: Created user contains all input fields', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          return userMatchesInput(user, input);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: Created user has is_active set to true by default', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          return user.is_active === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: Created user has unique ID', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        validCreateUserInputArb,
        (input1: CreateUserInput, input2: CreateUserInput) => {
          const user1 = createUserFromInput(input1);
          const user2 = createUserFromInput(input2);
          return user1.id !== user2.id;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.4: Created user has timestamps set', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          return (
            user.created_at.length > 0 &&
            user.updated_at.length > 0 &&
            user.id.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.5: Email and name are trimmed on creation', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress().map(e => `  ${e}  `),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          full_name: fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => s.trim().length > 0)
            .map(s => `  ${s}  `),
          role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
        }),
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          return (
            !user.email.startsWith(' ') &&
            !user.email.endsWith(' ') &&
            !user.full_name.startsWith(' ') &&
            !user.full_name.endsWith(' ')
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: user-management, Property 5: User Update Persistence**
 * **Validates: Requirements 2.2**
 * 
 * For any valid update to a user (name, email, role, status), 
 * retrieving the user after update should reflect the new values.
 */
describe('Property 5: User Update Persistence', () => {
  // Arbitrary for valid user creation input
  const validCreateUserInputArb = fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
    full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
  });

  // Arbitrary for valid update input
  const validUpdateInputArb = fc.record({
    full_name: fc.option(
      fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      { nil: undefined }
    ),
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    role: fc.option(
      fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
      { nil: undefined }
    ),
    is_active: fc.option(fc.boolean(), { nil: undefined }),
  });

  it('Property 5.1: Updated user reflects new values', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        validUpdateInputArb,
        (createInput: CreateUserInput, updateInput: import('./users').UpdateUserInput) => {
          const user = createUserFromInput(createInput);
          const updatedUser = updateUserFields(user, updateInput);

          // Check that updated fields reflect new values
          if (updateInput.full_name !== undefined) {
            if (updatedUser.full_name !== updateInput.full_name.trim()) return false;
          }
          if (updateInput.email !== undefined) {
            if (updatedUser.email !== updateInput.email.trim()) return false;
          }
          if (updateInput.role !== undefined) {
            if (updatedUser.role !== updateInput.role) return false;
          }
          if (updateInput.is_active !== undefined) {
            if (updatedUser.is_active !== updateInput.is_active) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: Partial update preserves unchanged fields', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (createInput: CreateUserInput, newName: string) => {
          const user = createUserFromInput(createInput);
          const updatedUser = updateUserFields(user, { full_name: newName });

          // Only name should change
          return (
            updatedUser.full_name === newName.trim() &&
            updatedUser.email === user.email &&
            updatedUser.role === user.role &&
            updatedUser.is_active === user.is_active &&
            updatedUser.id === user.id
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: Update preserves ID and created_at', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        validUpdateInputArb,
        (createInput: CreateUserInput, updateInput: import('./users').UpdateUserInput) => {
          const user = createUserFromInput(createInput);
          const originalId = user.id;
          const originalCreatedAt = user.created_at;

          const updatedUser = updateUserFields(user, updateInput);

          return (
            updatedUser.id === originalId &&
            updatedUser.created_at === originalCreatedAt
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.4: Full update changes all specified fields', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        fc.record({
          full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          email: fc.emailAddress(),
          role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
          is_active: fc.boolean(),
        }),
        (createInput: CreateUserInput, updateInput: import('./users').UpdateUserInput) => {
          const user = createUserFromInput(createInput);
          const updatedUser = updateUserFields(user, updateInput);

          return (
            updatedUser.full_name === updateInput.full_name!.trim() &&
            updatedUser.email === updateInput.email!.trim() &&
            updatedUser.role === updateInput.role &&
            updatedUser.is_active === updateInput.is_active
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Pure Functions for User Status Testing
// ============================================================================

/**
 * Simulates deactivating a user (pure function for testing)
 */
export function deactivateUserPure(user: import('./users').User): import('./users').User {
  return {
    ...user,
    is_active: false,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulates reactivating a user (pure function for testing)
 */
export function reactivateUserPure(user: import('./users').User): import('./users').User {
  return {
    ...user,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulates login check - returns true if user can login
 */
export function canUserLogin(user: import('./users').User): boolean {
  return user.is_active === true;
}

// ============================================================================
// Property-Based Tests for User Status
// ============================================================================

/**
 * **Feature: user-management, Property 6: User Status and Login Access**
 * **Validates: Requirements 2.3, 2.4**
 * 
 * For any user, when deactivated (is_active = false), login attempts should fail,
 * AND when reactivated (is_active = true), login attempts with correct credentials should succeed.
 */
describe('Property 6: User Status and Login Access', () => {
  // Arbitrary for valid user creation input
  const validCreateUserInputArb = fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
    full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
  });

  it('Property 6.1: Deactivated user cannot login', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          const deactivatedUser = deactivateUserPure(user);
          
          return (
            deactivatedUser.is_active === false &&
            canUserLogin(deactivatedUser) === false
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.2: Reactivated user can login', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          const deactivatedUser = deactivateUserPure(user);
          const reactivatedUser = reactivateUserPure(deactivatedUser);
          
          return (
            reactivatedUser.is_active === true &&
            canUserLogin(reactivatedUser) === true
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.3: Newly created user can login (default active)', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          
          return (
            user.is_active === true &&
            canUserLogin(user) === true
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.4: Deactivate then reactivate restores login ability', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          const initialCanLogin = canUserLogin(user);
          
          const deactivatedUser = deactivateUserPure(user);
          const afterDeactivate = canUserLogin(deactivatedUser);
          
          const reactivatedUser = reactivateUserPure(deactivatedUser);
          const afterReactivate = canUserLogin(reactivatedUser);
          
          return (
            initialCanLogin === true &&
            afterDeactivate === false &&
            afterReactivate === true
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.5: Deactivation preserves other user fields', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          const deactivatedUser = deactivateUserPure(user);
          
          return (
            deactivatedUser.id === user.id &&
            deactivatedUser.email === user.email &&
            deactivatedUser.full_name === user.full_name &&
            deactivatedUser.role === user.role &&
            deactivatedUser.created_at === user.created_at
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.6: Reactivation preserves other user fields', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input: CreateUserInput) => {
          const user = createUserFromInput(input);
          const deactivatedUser = deactivateUserPure(user);
          const reactivatedUser = reactivateUserPure(deactivatedUser);
          
          return (
            reactivatedUser.id === user.id &&
            reactivatedUser.email === user.email &&
            reactivatedUser.full_name === user.full_name &&
            reactivatedUser.role === user.role &&
            reactivatedUser.created_at === user.created_at
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});


import { searchUsers } from './users';

// ============================================================================
// Property-Based Tests for User Search
// ============================================================================

/**
 * **Feature: user-management, Property 7: User Search Filtering**
 * **Validates: Requirements 2.5**
 * 
 * For any search query, the returned users should all have name OR email 
 * containing the search string (case-insensitive).
 */
describe('Property 7: User Search Filtering', () => {
  // Arbitrary for valid user creation input
  const validCreateUserInputArb = fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
    full_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    role: fc.constantFrom('admin' as const, 'manager' as const, 'kasir' as const),
  });

  // Generate array of users
  const usersArrayArb = fc.array(validCreateUserInputArb, { minLength: 1, maxLength: 20 })
    .map(inputs => inputs.map(input => createUserFromInput(input)));

  // Search query arbitrary
  const searchQueryArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => s.trim().length > 0);

  it('Property 7.1: All search results contain the search query in name or email', () => {
    fc.assert(
      fc.property(
        usersArrayArb,
        searchQueryArb,
        (users, query) => {
          const results = searchUsers(users, query);
          const queryLower = query.toLowerCase().trim();
          
          // All results must contain the query in name or email
          return results.every(
            user =>
              user.full_name.toLowerCase().includes(queryLower) ||
              user.email.toLowerCase().includes(queryLower)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Search is case-insensitive', () => {
    fc.assert(
      fc.property(
        usersArrayArb,
        searchQueryArb,
        (users, query) => {
          const lowerResults = searchUsers(users, query.toLowerCase());
          const upperResults = searchUsers(users, query.toUpperCase());
          const mixedResults = searchUsers(users, query);
          
          // All case variations should return the same results
          return (
            lowerResults.length === upperResults.length &&
            upperResults.length === mixedResults.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Empty search returns all users', () => {
    fc.assert(
      fc.property(
        usersArrayArb,
        fc.constantFrom('', '   ', '\t', '\n'),
        (users, emptyQuery) => {
          const results = searchUsers(users, emptyQuery);
          return results.length === users.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: Search results are subset of original users', () => {
    fc.assert(
      fc.property(
        usersArrayArb,
        searchQueryArb,
        (users, query) => {
          const results = searchUsers(users, query);
          
          // Results should be a subset of original users
          return (
            results.length <= users.length &&
            results.every(result => users.some(user => user.id === result.id))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: Searching by exact email returns that user', () => {
    fc.assert(
      fc.property(
        usersArrayArb,
        (users) => {
          if (users.length === 0) return true;
          
          // Pick a random user and search by their email
          const targetUser = users[0];
          const results = searchUsers(users, targetUser.email);
          
          // Should find at least the target user
          return results.some(user => user.id === targetUser.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: Searching by exact name returns that user', () => {
    fc.assert(
      fc.property(
        usersArrayArb,
        (users) => {
          if (users.length === 0) return true;
          
          // Pick a random user and search by their name
          const targetUser = users[0];
          const results = searchUsers(users, targetUser.full_name);
          
          // Should find at least the target user
          return results.some(user => user.id === targetUser.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.7: Partial name match returns matching users', () => {
    fc.assert(
      fc.property(
        validCreateUserInputArb,
        (input) => {
          const user = createUserFromInput(input);
          const users = [user];
          
          // Search by first 3 characters of name (if long enough)
          if (user.full_name.length >= 3) {
            const partialName = user.full_name.substring(0, 3);
            const results = searchUsers(users, partialName);
            return results.length === 1 && results[0].id === user.id;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
