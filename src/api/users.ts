/**
 * User API for User Management
 * 
 * Provides CRUD operations for user management including:
 * - User creation with Supabase Auth integration
 * - User listing with filters
 * - User updates and status management
 * - Password reset functionality
 */

import { supabase } from '@/lib/supabaseClient';
import { isValidRole, Role } from '@/lib/permissions';
import { AuditLogger } from '@/lib/auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'kasir';
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'manager' | 'kasir';
}

export interface UpdateUserInput {
  full_name?: string;
  email?: string;
  role?: 'admin' | 'manager' | 'kasir';
  is_active?: boolean;
}

export interface UserFilters {
  search?: string;
  role?: string;
  is_active?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Validation Functions (Requirements 1.2, 1.3, 1.5)
// ============================================================================

/**
 * Validates email format
 * Requirements 1.2: Validate email format
 * 
 * @param email - Email string to validate
 * @returns true if email format is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Standard email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validates password minimum length
 * Requirements 1.3: Require password with minimum 8 characters
 * 
 * @param password - Password string to validate
 * @returns true if password meets minimum length requirement
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return password.length >= 8;
}

/**
 * Validates user role
 * Requirements 1.5: Require selection of exactly one role (admin, manager, or kasir)
 * 
 * @param role - Role string to validate
 * @returns true if role is valid
 */
export function isValidUserRole(role: string): role is Role {
  return isValidRole(role);
}

/**
 * Validates complete user creation input
 * Requirements 1.2, 1.3, 1.5
 * 
 * @param input - User creation input to validate
 * @returns ValidationResult with valid flag and error messages
 */
export function validateCreateUserInput(input: CreateUserInput): ValidationResult {
  const errors: string[] = [];

  // Email validation (Requirement 1.2)
  if (!isValidEmail(input.email)) {
    errors.push('Format email tidak valid');
  }

  // Password validation (Requirement 1.3)
  if (!isValidPassword(input.password)) {
    errors.push('Password minimal 8 karakter');
  }

  // Full name validation
  if (!input.full_name || input.full_name.trim().length === 0) {
    errors.push('Nama lengkap wajib diisi');
  }

  // Role validation (Requirement 1.5)
  if (!isValidUserRole(input.role)) {
    errors.push('Role harus admin, manager, atau kasir');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates user update input
 * 
 * @param input - User update input to validate
 * @returns ValidationResult with valid flag and error messages
 */
export function validateUpdateUserInput(input: UpdateUserInput): ValidationResult {
  const errors: string[] = [];

  // Email validation if provided
  if (input.email !== undefined && !isValidEmail(input.email)) {
    errors.push('Format email tidak valid');
  }

  // Full name validation if provided
  if (input.full_name !== undefined && input.full_name.trim().length === 0) {
    errors.push('Nama lengkap tidak boleh kosong');
  }

  // Role validation if provided
  if (input.role !== undefined && !isValidUserRole(input.role)) {
    errors.push('Role harus admin, manager, atau kasir');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


// ============================================================================
// CRUD Functions (Requirements 1.1, 1.4, 2.1, 2.2)
// ============================================================================

/**
 * Create a new user with Supabase Auth integration
 * Requirements 1.1: Store email, password, full name, and assigned role
 * Requirements 1.4: Set account status to 'active' by default
 * 
 * Note: Creating users requires Supabase service role key which is not available
 * on client-side for security reasons. Users should be created via:
 * 1. Supabase Dashboard
 * 2. Server-side API with service role key
 * 
 * @param input - User creation input
 * @returns Created user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  // Validate input
  const validation = validateCreateUserInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Note: supabase.auth.admin requires service role key
  // For client-side, we use signUp which sends confirmation email
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.full_name.trim(),
        role: input.role,
      },
    },
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      throw new Error('Email sudah terdaftar');
    }
    throw new Error(`Gagal membuat user: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('Gagal membuat user: tidak ada data user');
  }

  // Create user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      role: input.role,
      is_active: true,
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError) {
    throw new Error(`Gagal membuat profil user: ${profileError.message}`);
  }

  return {
    id: profile.id,
    email: profile.email || authData.user.email!,
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

/**
 * Get all users with optional filters
 * Requirements 2.1: Display all users with name, email, role, status, and last login date
 * 
 * @param filters - Optional filters for search, role, and status
 * @returns Array of users
 */
export async function getUsers(filters?: UserFilters): Promise<User[]> {
  // Get user profiles (email is now stored in user_profiles table)
  let query = supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply role filter
  if (filters?.role) {
    query = query.eq('role', filters.role);
  }

  // Apply status filter
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  // Apply search filter (server-side for better performance)
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    throw new Error(`Gagal mengambil data user: ${error.message}`);
  }

  // Map profiles to User type (email is now in user_profiles)
  const users: User[] = (profiles || []).map((profile) => ({
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }));

  return users;
}

/**
 * Get user by ID
 * 
 * @param id - User ID
 * @returns User or null if not found
 */
export async function getUserById(id: string): Promise<User | null> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

/**
 * Update user
 * Requirements 2.2: Allow updating name, email, role, and status
 * 
 * @param id - User ID
 * @param input - Update input
 * @returns Updated user
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  // Validate input
  const validation = validateUpdateUserInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Get old profile data for role change detection
  const { data: oldProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error(`Gagal mengambil data user: ${fetchError.message}`);
  }

  // Build profile update object
  const profileUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.full_name !== undefined) {
    profileUpdate.full_name = input.full_name.trim();
  }
  if (input.email !== undefined) {
    profileUpdate.email = input.email.trim();
  }
  if (input.role !== undefined) {
    profileUpdate.role = input.role;
  }
  if (input.is_active !== undefined) {
    profileUpdate.is_active = input.is_active;
  }

  // Update profile
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update(profileUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal update user: ${error.message}`);
  }

  // Log role change if role was updated
  // Requirements: 2.4 - Log role changes
  if (input.role !== undefined && oldProfile.role !== input.role) {
    await AuditLogger.logEvent('role_change', 'user', id, {
      old_role: oldProfile.role,
      new_role: input.role,
      user_name: profile.full_name,
    });
  }

  return {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}


// ============================================================================
// User Status Management (Requirements 2.3, 2.4)
// ============================================================================

/**
 * Deactivate a user
 * Requirements 2.3: Set status to 'inactive' and prevent login
 * 
 * @param id - User ID
 * @returns Updated user
 */
export async function deactivateUser(id: string): Promise<User> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal menonaktifkan user: ${error.message}`);
  }

  return {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

/**
 * Reactivate a user
 * Requirements 2.4: Set status to 'active' and allow login
 * 
 * @param id - User ID
 * @returns Updated user
 */
export async function reactivateUser(id: string): Promise<User> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal mengaktifkan user: ${error.message}`);
  }

  return {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}


// ============================================================================
// User Search (Requirements 2.5)
// ============================================================================

/**
 * Search users by name or email
 * Requirements 2.5: Filter by name or email
 * 
 * This is a pure function that can be used for client-side filtering
 * 
 * @param users - Array of users to search
 * @param searchQuery - Search string
 * @returns Filtered array of users
 */
export function searchUsers(users: User[], searchQuery: string): User[] {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return users;
  }
  
  const searchLower = searchQuery.toLowerCase().trim();
  
  return users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
  );
}
