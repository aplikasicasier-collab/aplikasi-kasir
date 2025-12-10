import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Outlet, UserOutlet } from '@/types';
import { generateOutletCodeSync } from './outlets';

/**
 * Pure functions for user outlet validation and transformation
 * These are extracted for property-based testing without database dependencies
 */

export interface UserOutletState {
  userId: string;
  userRole: 'admin' | 'manager' | 'kasir';
  assignments: UserOutlet[];
}

export interface OutletAccessResult {
  canAccess: boolean;
  reason: string;
}

/**
 * Creates a mock outlet for testing
 */
export function createMockOutlet(overrides?: Partial<Outlet>): Outlet {
  return {
    id: crypto.randomUUID(),
    code: generateOutletCodeSync(),
    name: 'Test Outlet',
    address: null,
    phone: null,
    email: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock user outlet assignment
 */
export function createMockUserOutlet(
  userId: string,
  outletId: string,
  isDefault: boolean = false
): UserOutlet {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    outlet_id: outletId,
    is_default: isDefault,
    created_at: new Date().toISOString(),
  };
}


/**
 * Checks if a user can access a specific outlet based on their assignments and role
 * Admin users can access all outlets regardless of assignment
 * Requirements: 2.3, 2.5
 */
export function checkOutletAccess(
  state: UserOutletState,
  outletId: string
): OutletAccessResult {
  // Admin users have access to all outlets
  if (state.userRole === 'admin') {
    return { canAccess: true, reason: 'Admin has access to all outlets' };
  }

  // Check if user is assigned to this outlet
  const isAssigned = state.assignments.some(a => a.outlet_id === outletId);
  
  if (isAssigned) {
    return { canAccess: true, reason: 'User is assigned to this outlet' };
  }

  return { canAccess: false, reason: 'User is not assigned to this outlet' };
}

/**
 * Gets all outlets a user can access based on their assignments and role
 * Admin users can access all outlets
 * Requirements: 2.3, 2.5
 */
export function getAccessibleOutlets(
  state: UserOutletState,
  allOutlets: Outlet[]
): Outlet[] {
  // Admin users can access all outlets
  if (state.userRole === 'admin') {
    return allOutlets;
  }

  // Non-admin users can only access assigned outlets
  const assignedOutletIds = new Set(state.assignments.map(a => a.outlet_id));
  return allOutlets.filter(o => assignedOutletIds.has(o.id));
}

/**
 * Gets the default outlet for a user
 * Returns null if no default is set
 * Requirements: 7.2
 */
export function getDefaultOutletFromState(
  state: UserOutletState,
  allOutlets: Outlet[]
): Outlet | null {
  const defaultAssignment = state.assignments.find(a => a.is_default);
  
  if (!defaultAssignment) {
    return null;
  }

  return allOutlets.find(o => o.id === defaultAssignment.outlet_id) || null;
}

/**
 * Validates that a default outlet is one of the assigned outlets
 * Requirements: 7.1
 */
export function validateDefaultOutlet(
  assignments: UserOutlet[],
  defaultOutletId: string
): boolean {
  return assignments.some(a => a.outlet_id === defaultOutletId);
}

/**
 * Simulates assigning a user to outlets with optional default
 * Returns the new assignments
 * Requirements: 2.1, 2.2, 7.1
 */
export function assignUserToOutletsPure(
  userId: string,
  outletIds: string[],
  defaultOutletId?: string
): { success: boolean; assignments: UserOutlet[]; error?: string } {
  // Validate inputs
  if (!userId) {
    return { success: false, assignments: [], error: 'User ID is required' };
  }

  if (!outletIds || outletIds.length === 0) {
    return { success: false, assignments: [], error: 'At least one outlet must be assigned' };
  }

  // Validate default outlet is in the assigned outlets
  if (defaultOutletId && !outletIds.includes(defaultOutletId)) {
    return { 
      success: false, 
      assignments: [], 
      error: 'Default outlet must be one of the assigned outlets' 
    };
  }

  // Create assignments
  const assignments = outletIds.map(outletId => 
    createMockUserOutlet(userId, outletId, outletId === defaultOutletId)
  );

  return { success: true, assignments };
}

/**
 * Simulates setting a default outlet for a user
 * The outlet must already be assigned
 * Requirements: 7.1
 */
export function setDefaultOutletPure(
  assignments: UserOutlet[],
  outletId: string
): { success: boolean; assignments: UserOutlet[]; error?: string } {
  // Check if outlet is assigned
  const isAssigned = assignments.some(a => a.outlet_id === outletId);
  
  if (!isAssigned) {
    return { 
      success: false, 
      assignments, 
      error: 'User is not assigned to this outlet' 
    };
  }

  // Update assignments - clear existing default and set new one
  const updatedAssignments = assignments.map(a => ({
    ...a,
    is_default: a.outlet_id === outletId,
  }));

  return { success: true, assignments: updatedAssignments };
}

/**
 * Ensures only one default outlet exists per user
 * Requirements: 7.1
 */
export function ensureSingleDefault(assignments: UserOutlet[]): UserOutlet[] {
  const defaultCount = assignments.filter(a => a.is_default).length;
  
  if (defaultCount <= 1) {
    return assignments;
  }

  // Keep only the first default, clear others
  let foundDefault = false;
  return assignments.map(a => {
    if (a.is_default) {
      if (foundDefault) {
        return { ...a, is_default: false };
      }
      foundDefault = true;
    }
    return a;
  });
}


/**
 * **Feature: multi-outlet, Property 4: User Outlet Assignment**
 * **Validates: Requirements 2.1, 2.3, 2.5**
 * 
 * For any user-outlet assignment, the user should be able to access only their 
 * assigned outlets, AND admin users should be able to access all outlets 
 * regardless of assignment.
 */
describe('User Outlet Assignment', () => {
  // Arbitrary for generating user IDs
  const userIdArb = fc.uuid();

  // Arbitrary for generating outlet IDs
  const outletIdArb = fc.uuid();

  // Arbitrary for generating user roles
  const userRoleArb = fc.constantFrom('admin', 'manager', 'kasir') as fc.Arbitrary<'admin' | 'manager' | 'kasir'>;

  // Arbitrary for generating a list of outlets
  const outletsArb = fc.array(
    fc.record({
      id: outletIdArb,
      code: fc.constant(generateOutletCodeSync()),
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      address: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
      phone: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
      email: fc.option(fc.emailAddress(), { nil: null }),
      is_active: fc.constant(true),
      created_at: fc.constant(new Date().toISOString()),
      updated_at: fc.constant(new Date().toISOString()),
    }),
    { minLength: 1, maxLength: 10 }
  ) as fc.Arbitrary<Outlet[]>;

  it('Property 4.1: Non-admin users can only access their assigned outlets', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.constantFrom('manager', 'kasir') as fc.Arbitrary<'manager' | 'kasir'>,
        outletsArb,
        fc.integer({ min: 1, max: 10 }),
        (userId, role, outlets, assignCount) => {
          if (outlets.length === 0) return true;

          // Assign user to a subset of outlets
          const numToAssign = Math.min(assignCount, outlets.length);
          const assignedOutlets = outlets.slice(0, numToAssign);
          const unassignedOutlets = outlets.slice(numToAssign);

          // Create assignments
          const assignments = assignedOutlets.map(o => 
            createMockUserOutlet(userId, o.id, false)
          );

          const state: UserOutletState = { userId, userRole: role, assignments };

          // User should be able to access assigned outlets
          const canAccessAssigned = assignedOutlets.every(o => 
            checkOutletAccess(state, o.id).canAccess
          );

          // User should NOT be able to access unassigned outlets
          const cannotAccessUnassigned = unassignedOutlets.every(o => 
            !checkOutletAccess(state, o.id).canAccess
          );

          return canAccessAssigned && cannotAccessUnassigned;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: Admin users can access all outlets regardless of assignment', () => {
    fc.assert(
      fc.property(
        userIdArb,
        outletsArb,
        (userId, outlets) => {
          if (outlets.length === 0) return true;

          // Admin with no assignments
          const stateNoAssignments: UserOutletState = {
            userId,
            userRole: 'admin',
            assignments: [],
          };

          // Admin should be able to access all outlets even without assignments
          const canAccessAll = outlets.every(o => 
            checkOutletAccess(stateNoAssignments, o.id).canAccess
          );

          return canAccessAll;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: getAccessibleOutlets returns correct outlets based on role', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userRoleArb,
        outletsArb,
        fc.integer({ min: 0, max: 10 }),
        (userId, role, outlets, assignCount) => {
          if (outlets.length === 0) return true;

          // Assign user to a subset of outlets
          const numToAssign = Math.min(assignCount, outlets.length);
          const assignedOutlets = outlets.slice(0, numToAssign);

          // Create assignments
          const assignments = assignedOutlets.map(o => 
            createMockUserOutlet(userId, o.id, false)
          );

          const state: UserOutletState = { userId, userRole: role, assignments };
          const accessibleOutlets = getAccessibleOutlets(state, outlets);

          if (role === 'admin') {
            // Admin should have access to all outlets
            return accessibleOutlets.length === outlets.length;
          } else {
            // Non-admin should only have access to assigned outlets
            return accessibleOutlets.length === assignedOutlets.length;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.4: User assignment creates correct number of assignments', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(outletIdArb, { minLength: 1, maxLength: 10 }),
        (userId, outletIds) => {
          // Remove duplicates
          const uniqueOutletIds = [...new Set(outletIds)];
          
          const result = assignUserToOutletsPure(userId, uniqueOutletIds);

          return (
            result.success &&
            result.assignments.length === uniqueOutletIds.length &&
            result.assignments.every(a => a.user_id === userId) &&
            result.assignments.every(a => uniqueOutletIds.includes(a.outlet_id))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.5: Empty outlet list assignment fails', () => {
    fc.assert(
      fc.property(
        userIdArb,
        (userId) => {
          const result = assignUserToOutletsPure(userId, []);
          return !result.success && result.error !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: multi-outlet, Property 5: Default Outlet Selection**
 * **Validates: Requirements 7.1, 7.2**
 * 
 * For any user with a default outlet set, logging in should automatically select 
 * that outlet, AND the default outlet must be one of the user's assigned outlets.
 */
describe('Default Outlet Selection', () => {
  // Arbitrary for generating user IDs
  const userIdArb = fc.uuid();

  // Arbitrary for generating outlet IDs
  const outletIdArb = fc.uuid();

  // Arbitrary for generating user roles
  const userRoleArb = fc.constantFrom('admin', 'manager', 'kasir') as fc.Arbitrary<'admin' | 'manager' | 'kasir'>;

  // Arbitrary for generating a list of outlets
  const outletsArb = fc.array(
    fc.record({
      id: outletIdArb,
      code: fc.constant(generateOutletCodeSync()),
      name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      address: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
      phone: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
      email: fc.option(fc.emailAddress(), { nil: null }),
      is_active: fc.constant(true),
      created_at: fc.constant(new Date().toISOString()),
      updated_at: fc.constant(new Date().toISOString()),
    }),
    { minLength: 1, maxLength: 10 }
  ) as fc.Arbitrary<Outlet[]>;

  it('Property 5.1: Default outlet must be one of the assigned outlets', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(outletIdArb, { minLength: 1, maxLength: 10 }),
        outletIdArb,
        (userId, outletIds, defaultOutletId) => {
          // Remove duplicates
          const uniqueOutletIds = [...new Set(outletIds)];
          
          const result = assignUserToOutletsPure(userId, uniqueOutletIds, defaultOutletId);

          if (uniqueOutletIds.includes(defaultOutletId)) {
            // If default is in assigned list, should succeed
            return (
              result.success &&
              result.assignments.some(a => a.outlet_id === defaultOutletId && a.is_default)
            );
          } else {
            // If default is NOT in assigned list, should fail
            return !result.success && result.error?.includes('Default outlet must be one of the assigned outlets');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: Setting default outlet updates only that outlet to default', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(outletIdArb, { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (userId, outletIds, defaultIndex) => {
          // Remove duplicates and ensure at least 2 outlets
          const uniqueOutletIds = [...new Set(outletIds)];
          if (uniqueOutletIds.length < 2) return true;

          // Create initial assignments without default
          const initialAssignments = uniqueOutletIds.map(outletId => 
            createMockUserOutlet(userId, outletId, false)
          );

          // Set default to one of the outlets
          const targetIndex = defaultIndex % uniqueOutletIds.length;
          const targetOutletId = uniqueOutletIds[targetIndex];
          
          const result = setDefaultOutletPure(initialAssignments, targetOutletId);

          // Should succeed
          if (!result.success) return false;

          // Only the target outlet should be default
          const defaultAssignments = result.assignments.filter(a => a.is_default);
          const nonDefaultAssignments = result.assignments.filter(a => !a.is_default);

          return (
            defaultAssignments.length === 1 &&
            defaultAssignments[0].outlet_id === targetOutletId &&
            nonDefaultAssignments.length === uniqueOutletIds.length - 1
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: Cannot set default to unassigned outlet', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(outletIdArb, { minLength: 1, maxLength: 5 }),
        outletIdArb,
        (userId, assignedOutletIds, unassignedOutletId) => {
          // Ensure unassigned outlet is not in assigned list
          const uniqueAssigned = [...new Set(assignedOutletIds)];
          if (uniqueAssigned.includes(unassignedOutletId)) return true;

          // Create assignments
          const assignments = uniqueAssigned.map(outletId => 
            createMockUserOutlet(userId, outletId, false)
          );

          // Try to set unassigned outlet as default
          const result = setDefaultOutletPure(assignments, unassignedOutletId);

          return !result.success && result.error?.includes('User is not assigned to this outlet');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.4: getDefaultOutletFromState returns correct default outlet', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userRoleArb,
        outletsArb,
        fc.integer({ min: 0, max: 9 }),
        (userId, role, outlets, defaultIndex) => {
          if (outlets.length === 0) return true;

          // Pick one outlet as default
          const targetIndex = defaultIndex % outlets.length;
          const defaultOutlet = outlets[targetIndex];

          // Create assignments with one default
          const assignments = outlets.map((o, i) => 
            createMockUserOutlet(userId, o.id, i === targetIndex)
          );

          const state: UserOutletState = { userId, userRole: role, assignments };
          const result = getDefaultOutletFromState(state, outlets);

          return result !== null && result.id === defaultOutlet.id;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.5: getDefaultOutletFromState returns null when no default set', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userRoleArb,
        outletsArb,
        (userId, role, outlets) => {
          if (outlets.length === 0) return true;

          // Create assignments without any default
          const assignments = outlets.map(o => 
            createMockUserOutlet(userId, o.id, false)
          );

          const state: UserOutletState = { userId, userRole: role, assignments };
          const result = getDefaultOutletFromState(state, outlets);

          return result === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.6: ensureSingleDefault keeps only one default', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(outletIdArb, { minLength: 2, maxLength: 10 }),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        (userId, outletIds, defaultFlags) => {
          // Remove duplicates
          const uniqueOutletIds = [...new Set(outletIds)];
          if (uniqueOutletIds.length < 2) return true;

          // Create assignments with potentially multiple defaults
          const assignments = uniqueOutletIds.map((outletId, i) => 
            createMockUserOutlet(userId, outletId, defaultFlags[i % defaultFlags.length])
          );

          const result = ensureSingleDefault(assignments);
          const defaultCount = result.filter(a => a.is_default).length;

          // Should have at most one default
          return defaultCount <= 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for validation
describe('User Outlet Validation Unit Tests', () => {
  it('validates user ID is required for assignment', () => {
    const result = assignUserToOutletsPure('', ['outlet-1']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('User ID is required');
  });

  it('validates at least one outlet is required', () => {
    const result = assignUserToOutletsPure('user-1', []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('At least one outlet must be assigned');
  });

  it('validates default outlet must be in assigned list', () => {
    const result = assignUserToOutletsPure('user-1', ['outlet-1', 'outlet-2'], 'outlet-3');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Default outlet must be one of the assigned outlets');
  });

  it('creates assignments with correct default flag', () => {
    const result = assignUserToOutletsPure('user-1', ['outlet-1', 'outlet-2'], 'outlet-2');
    expect(result.success).toBe(true);
    expect(result.assignments.length).toBe(2);
    
    const defaultAssignment = result.assignments.find(a => a.is_default);
    expect(defaultAssignment?.outlet_id).toBe('outlet-2');
    
    const nonDefaultAssignment = result.assignments.find(a => !a.is_default);
    expect(nonDefaultAssignment?.outlet_id).toBe('outlet-1');
  });

  it('admin can access any outlet', () => {
    const state: UserOutletState = {
      userId: 'user-1',
      userRole: 'admin',
      assignments: [],
    };

    const result = checkOutletAccess(state, 'any-outlet-id');
    expect(result.canAccess).toBe(true);
    expect(result.reason).toBe('Admin has access to all outlets');
  });

  it('non-admin cannot access unassigned outlet', () => {
    const state: UserOutletState = {
      userId: 'user-1',
      userRole: 'kasir',
      assignments: [createMockUserOutlet('user-1', 'outlet-1', false)],
    };

    const result = checkOutletAccess(state, 'outlet-2');
    expect(result.canAccess).toBe(false);
    expect(result.reason).toBe('User is not assigned to this outlet');
  });
});
