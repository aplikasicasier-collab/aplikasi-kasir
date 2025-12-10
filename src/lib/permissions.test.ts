import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  hasPermission,
  getAccessibleRoutes,
  canAccessRoute,
  isValidRole,
  getPermissionsForRole,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  ALL_ROUTES,
  type Permission,
  type Role,
} from './permissions';

const USER_MGMT_PERMS: Permission[] = ['users.view', 'users.create', 'users.edit', 'users.delete'];
const MGR_PERMS: Permission[] = [
  'inventory.view', 'inventory.edit', 'pemesanan.view', 'pemesanan.create',
  'pemesanan.edit', 'laporan.view', 'kategori.view', 'kategori.edit',
  'supplier.view', 'supplier.edit', 'dashboard.view',
  'stock-transfer.view', 'stock-transfer.edit',
  'diskon.view', 'diskon.edit',
  'retur.view', 'retur.edit',
  'stock-opname.view', 'stock-opname.edit',
];
const KASIR_PERMS: Permission[] = [
  'kasir.access', 'laporan.view', 'dashboard.view',
  'retur.view', 'retur.edit',
  'stock-opname.view', 'stock-opname.edit',
];

const roleArb = fc.constantFrom<Role>('admin', 'manager', 'kasir');
const permArb = fc.constantFrom<Permission>(...ALL_PERMISSIONS);
const routeArb = fc.constantFrom(...ALL_ROUTES);
const badRoleArb = fc.string().filter((s) => !isValidRole(s));

describe('Permission Utilities - Property Tests', () => {
  it('Property 10.1: admin should have all permissions', () => {
    fc.assert(fc.property(permArb, (p) => hasPermission('admin', p) === true), { numRuns: 100 });
  });

  it('Property 10.2: manager has correct permissions', () => {
    fc.assert(fc.property(permArb, (p) => {
      const has = hasPermission('manager', p);
      if (USER_MGMT_PERMS.includes(p)) return has === false;
      if (MGR_PERMS.includes(p)) return has === true;
      return has === false;
    }), { numRuns: 100 });
  });

  it('Property 10.3: kasir has only kasir, dashboard, and stock-opname permissions', () => {
    fc.assert(fc.property(permArb, (p) => {
      const has = hasPermission('kasir', p);
      if (KASIR_PERMS.includes(p)) return has === true;
      return has === false;
    }), { numRuns: 100 });
  });

  it('Property 10.4: hasPermission consistent with ROLE_PERMISSIONS', () => {
    fc.assert(fc.property(roleArb, permArb, (r, p) => {
      return ROLE_PERMISSIONS[r].includes(p) === hasPermission(r, p);
    }), { numRuns: 100 });
  });

  it('Property 10.5: invalid roles have no permissions', () => {
    fc.assert(fc.property(badRoleArb, permArb, (r, p) => hasPermission(r, p) === false), { numRuns: 100 });
  });

  it('Property 10.6: getAccessibleRoutes returns accessible routes', () => {
    fc.assert(fc.property(roleArb, (r) => {
      return getAccessibleRoutes(r).every((rt) => canAccessRoute(r, rt));
    }), { numRuns: 100 });
  });

  it('Property 10.7: canAccessRoute consistent with getAccessibleRoutes', () => {
    fc.assert(fc.property(roleArb, routeArb, (r, rt) => {
      return canAccessRoute(r, rt) === getAccessibleRoutes(r).includes(rt);
    }), { numRuns: 100 });
  });

  it('Property 10.8: admin can access all routes', () => {
    fc.assert(fc.property(routeArb, (rt) => canAccessRoute('admin', rt) === true), { numRuns: 100 });
  });

  it('Property 10.9: invalid roles cannot access routes', () => {
    fc.assert(fc.property(badRoleArb, routeArb, (r, rt) => canAccessRoute(r, rt) === false), { numRuns: 100 });
  });
});

describe('Permission Utilities - Unit Tests', () => {
  describe('isValidRole', () => {
    it('returns true for valid roles', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('manager')).toBe(true);
      expect(isValidRole('kasir')).toBe(true);
    });
    it('returns false for invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('getPermissionsForRole', () => {
    it('returns all permissions for admin', () => {
      const perms = getPermissionsForRole('admin');
      expect(perms).toEqual(expect.arrayContaining(ALL_PERMISSIONS));
    });
    it('returns empty for invalid role', () => {
      expect(getPermissionsForRole('invalid')).toEqual([]);
    });
  });
});
