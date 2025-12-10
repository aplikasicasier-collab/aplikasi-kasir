/**
 * Permission Utilities for User Management
 * 
 * Provides role-based access control (RBAC) functionality including:
 * - Permission type definitions
 * - Role-to-permission mappings
 * - Permission check functions
 * - Route access control
 */

// All available permissions in the system
export type Permission =
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'inventory.view'
  | 'inventory.edit'
  | 'kasir.access'
  | 'pemesanan.view'
  | 'pemesanan.create'
  | 'pemesanan.edit'
  | 'laporan.view'
  | 'kategori.view'
  | 'kategori.edit'
  | 'supplier.view'
  | 'supplier.edit'
  | 'diskon.view'
  | 'diskon.edit'
  | 'retur.view'
  | 'retur.edit'
  | 'settings.view'
  | 'settings.edit'
  | 'dashboard.view'
  | 'outlet.view'
  | 'outlet.edit'
  | 'stock-transfer.view'
  | 'stock-transfer.edit'
  | 'stock-opname.view'
  | 'stock-opname.edit'
  | 'audit-log.view';

// Valid roles in the system
export type Role = 'admin' | 'manager' | 'kasir';

// All permissions for reference
export const ALL_PERMISSIONS: Permission[] = [
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'inventory.view',
  'inventory.edit',
  'kasir.access',
  'pemesanan.view',
  'pemesanan.create',
  'pemesanan.edit',
  'laporan.view',
  'kategori.view',
  'kategori.edit',
  'supplier.view',
  'supplier.edit',
  'diskon.view',
  'diskon.edit',
  'retur.view',
  'retur.edit',
  'settings.view',
  'settings.edit',
  'dashboard.view',
  'outlet.view',
  'outlet.edit',
  'stock-transfer.view',
  'stock-transfer.edit',
  'stock-opname.view',
  'stock-opname.edit',
  'audit-log.view',
];

// Role to permissions mapping
// Requirements 5.1, 5.2, 5.3
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Admin has all permissions (Requirement 5.1)
  admin: [...ALL_PERMISSIONS],
  
  // Manager has inventory, pemesanan, laporan, kategori, supplier, diskon, retur, stock-transfer, stock-opname access (Requirement 5.2)
  manager: [
    'inventory.view',
    'inventory.edit',
    'pemesanan.view',
    'pemesanan.create',
    'pemesanan.edit',
    'laporan.view',
    'kategori.view',
    'kategori.edit',
    'supplier.view',
    'supplier.edit',
    'diskon.view',
    'diskon.edit',
    'retur.view',
    'retur.edit',
    'dashboard.view',
    'stock-transfer.view',
    'stock-transfer.edit',
    'stock-opname.view',
    'stock-opname.edit',
  ],
  
  // Kasir has kasir, dashboard, retur, and stock-opname access (Requirement 5.3, Barcode-scanner 5.1, Retur-Refund 1.1)
  kasir: [
    'kasir.access',
    'laporan.view', // Dashboard only
    'dashboard.view',
    'retur.view',
    'retur.edit',
    'stock-opname.view',
    'stock-opname.edit',
  ],
};

// Route to permission mapping
const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/': 'dashboard.view',
  '/dashboard': 'dashboard.view',
  '/kasir': 'kasir.access',
  '/inventory': 'inventory.view',
  '/inventori': 'inventory.view', // Indonesian route alias
  '/pemesanan': 'pemesanan.view',
  '/laporan': 'laporan.view',
  '/kategori': 'kategori.view',
  '/supplier': 'supplier.view',
  '/diskon': 'diskon.view',
  '/retur': 'retur.view', // Retur & Refund (kasir, manager, admin)
  '/settings': 'settings.view',
  '/pengaturan': 'settings.view', // Indonesian route alias
  '/users': 'users.view',
  '/user-management': 'users.view', // Alias for user management
  '/profile': 'dashboard.view', // All users can access their profile
  '/outlet': 'outlet.view', // Outlet management (admin only)
  '/stock-transfer': 'stock-transfer.view', // Stock transfer (manager and admin)
  '/stock-opname': 'stock-opname.view', // Stock opname (all staff)
  '/audit-log': 'audit-log.view', // Audit log (admin only)
};

// All routes in the system
export const ALL_ROUTES = Object.keys(ROUTE_PERMISSIONS);

/**
 * Check if a role has a specific permission
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns true if the role has the permission
 */
export function hasPermission(role: string, permission: Permission): boolean {
  if (!isValidRole(role)) {
    return false;
  }
  
  const permissions = ROLE_PERMISSIONS[role as Role];
  return permissions.includes(permission);
}

/**
 * Get all routes accessible by a role
 * @param role - The user's role
 * @returns Array of route paths the role can access
 */
export function getAccessibleRoutes(role: string): string[] {
  if (!isValidRole(role)) {
    return [];
  }
  
  const permissions = ROLE_PERMISSIONS[role as Role];
  
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([_, permission]) => permissions.includes(permission))
    .map(([route]) => route);
}

/**
 * Check if a role can access a specific route
 * @param role - The user's role
 * @param route - The route path to check
 * @returns true if the role can access the route
 */
export function canAccessRoute(role: string, route: string): boolean {
  if (!isValidRole(role)) {
    return false;
  }
  
  const requiredPermission = ROUTE_PERMISSIONS[route];
  
  // If route is not in the mapping, deny access
  if (!requiredPermission) {
    return false;
  }
  
  return hasPermission(role, requiredPermission);
}

/**
 * Check if a string is a valid role
 * @param role - The role string to validate
 * @returns true if the role is valid
 */
export function isValidRole(role: string): role is Role {
  return role === 'admin' || role === 'manager' || role === 'kasir';
}

/**
 * Get all permissions for a role
 * @param role - The user's role
 * @returns Array of permissions for the role, or empty array if invalid role
 */
export function getPermissionsForRole(role: string): Permission[] {
  if (!isValidRole(role)) {
    return [];
  }
  return [...ROLE_PERMISSIONS[role]];
}
