/**
 * Auth API for User Management
 * 
 * Provides authentication functionality including:
 * - Login with activity logging
 * - Logout with activity logging
 * - Password management (change and reset)
 * - Failed login alert triggers
 * 
 * Requirements: 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 7.1, 7.3
 */

import { supabase } from '@/lib/supabaseClient';
import { User } from './users';
import { 
  checkFailedLoginThreshold, 
  createFailedLoginAlert,
  ALERT_THRESHOLDS 
} from './auditAlerts';

// ============================================================================
// Types
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginResult {
  user: User;
  mustChangePassword: boolean;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  event_type: 'login_success' | 'login_failure' | 'logout' | 'password_change';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Activity Logging Helper
// ============================================================================

/**
 * Log user activity event
 * Requirements 7.3: Include login success and failure events
 * 
 * @param userId - User ID (can be null for failed login attempts)
 * @param eventType - Type of event
 * @param metadata - Additional metadata
 */
export async function logActivity(
  userId: string | null,
  eventType: 'login_success' | 'login_failure' | 'logout' | 'password_change',
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Get client info
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    
    await supabase.from('user_activity_logs').insert({
      user_id: userId,
      event_type: eventType,
      ip_address: null, // IP is typically captured server-side
      user_agent: userAgent,
      metadata: metadata || null,
    });

    // Check for failed login threshold and create alert if exceeded
    // Requirements 7.1: Flag suspicious activity for multiple failed login attempts
    if (eventType === 'login_failure' && userId) {
      await checkAndTriggerFailedLoginAlert(userId);
    }
  } catch (error) {
    // Log error but don't throw - activity logging should not break main flow
    console.error('Failed to log activity:', error);
  }
}

/**
 * Check failed login threshold and create alert if exceeded
 * Requirements 7.1: WHEN multiple failed login attempts occur THEN flag as suspicious
 * 
 * @param userId - User ID to check
 */
async function checkAndTriggerFailedLoginAlert(userId: string): Promise<void> {
  try {
    const thresholdExceeded = await checkFailedLoginThreshold(userId);
    
    if (thresholdExceeded) {
      // Get the count of failed attempts for the alert
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - ALERT_THRESHOLDS.FAILED_LOGIN_WINDOW_MINUTES);
      
      const { data } = await supabase
        .from('user_activity_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'login_failure')
        .gte('created_at', windowStart.toISOString());
      
      const attemptCount = data?.length || ALERT_THRESHOLDS.FAILED_LOGIN_COUNT;
      
      await createFailedLoginAlert(userId, attemptCount);
    }
  } catch (error) {
    // Log error but don't throw - alert creation should not break main flow
    console.error('Failed to check/create failed login alert:', error);
  }
}

/**
 * Look up user ID by email for tracking failed login attempts
 * This allows us to track failed logins even when auth fails
 * 
 * @param email - Email to look up
 * @returns User ID or null if not found
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.id;
  } catch {
    return null;
  }
}

// ============================================================================
// Login Function (Requirements 2.3, 7.3)
// ============================================================================

/**
 * Login user with Supabase Auth
 * Requirements 2.3: Deactivated users cannot login
 * Requirements 7.3: Log login success/failure events
 * 
 * @param input - Login credentials
 * @returns LoginResult with user and mustChangePassword flag
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  // Attempt authentication with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (authError) {
    // Try to get user ID by email for tracking failed login attempts
    // Requirements 7.1: Track failed login attempts for alert triggering
    const userId = await getUserIdByEmail(email);
    await logActivity(userId, 'login_failure', { email: email.trim(), reason: authError.message });
    throw new Error('Email atau password salah');
  }

  if (!authData.user) {
    const userId = await getUserIdByEmail(email);
    await logActivity(userId, 'login_failure', { email: email.trim(), reason: 'No user data returned' });
    throw new Error('Email atau password salah');
  }

  // Get user profile to check is_active status
  let { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  // If profile doesn't exist, create one automatically (for backward compatibility)
  if (profileError || !profile) {
    // Auto-create profile for existing Supabase Auth users
    const newProfile = {
      id: authData.user.id,
      email: authData.user.email!.toLowerCase(),
      full_name: authData.user.user_metadata?.full_name || authData.user.email!.split('@')[0],
      role: 'kasir' as const, // Default role for auto-created profiles
      is_active: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert(newProfile)
      .select()
      .single();

    if (createError) {
      // Sign out since we couldn't create profile
      await supabase.auth.signOut();
      await logActivity(authData.user.id, 'login_failure', { reason: 'Failed to create profile' });
      throw new Error('Gagal membuat profil pengguna. Hubungi administrator.');
    }

    profile = createdProfile;
  }

  // Check if user is active (Requirement 2.3)
  if (!profile.is_active) {
    // Sign out inactive user
    await supabase.auth.signOut();
    await logActivity(authData.user.id, 'login_failure', { reason: 'Account inactive' });
    throw new Error('Akun tidak aktif, hubungi admin');
  }

  // Update last_login_at
  await supabase
    .from('user_profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', authData.user.id);

  // Log successful login
  await logActivity(authData.user.id, 'login_success');

  const user: User = {
    id: profile.id,
    email: authData.user.email!,
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    must_change_password: profile.must_change_password,
    last_login_at: new Date().toISOString(),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  return {
    user,
    mustChangePassword: profile.must_change_password,
  };
}


// ============================================================================
// Logout Function (Requirements 7.3)
// ============================================================================

/**
 * Logout current user
 * Requirements 7.3: Log logout events
 * 
 * @returns void
 */
export async function logout(): Promise<void> {
  // Get current user before signing out
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Log logout event
    await logActivity(user.id, 'logout');
  }

  // Sign out from Supabase
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw new Error(`Gagal logout: ${error.message}`);
  }
}

// ============================================================================
// Get Current User
// ============================================================================

/**
 * Get currently authenticated user
 * 
 * @returns User or null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return {
    id: profile.id,
    email: authUser.email!,
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
// Password Validation Helpers
// ============================================================================

/**
 * Validate password minimum length
 * Requirements 4.2: Validate new password minimum 8 characters
 * 
 * @param password - Password to validate
 * @returns true if password meets minimum length
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

/**
 * Validate password change input
 * Requirements 4.2, 4.3: Validate password length and confirmation match
 * 
 * @param input - Password change input
 * @returns Object with valid flag and error message
 */
export function validatePasswordChange(input: ChangePasswordInput): { valid: boolean; error?: string } {
  // Check current password is provided
  if (!input.currentPassword || input.currentPassword.length === 0) {
    return { valid: false, error: 'Password saat ini wajib diisi' };
  }

  // Check new password minimum length (Requirement 4.2)
  if (!isValidPassword(input.newPassword)) {
    return { valid: false, error: 'Password baru minimal 8 karakter' };
  }

  // Check confirmation match (Requirement 4.3)
  if (input.newPassword !== input.confirmPassword) {
    return { valid: false, error: 'Konfirmasi password tidak cocok' };
  }

  // Check new password is different from current
  if (input.currentPassword === input.newPassword) {
    return { valid: false, error: 'Password baru harus berbeda dari password saat ini' };
  }

  return { valid: true };
}

// ============================================================================
// Password Management Functions (Requirements 3.1, 3.2, 4.1, 4.2, 4.3, 4.4)
// ============================================================================

/**
 * Change password for current user
 * Requirements 4.1: Require current password verification
 * Requirements 4.2: Validate new password minimum 8 characters
 * Requirements 4.3: Require new password confirmation match
 * Requirements 4.4: Update password immediately
 * 
 * @param input - Password change input
 */
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  // Validate input
  const validation = validatePasswordChange(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Tidak ada user yang login');
  }

  // Verify current password by attempting to sign in
  // This is the standard way to verify current password with Supabase
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: input.currentPassword,
  });

  if (verifyError) {
    throw new Error('Password saat ini salah');
  }

  // Update password (Requirement 4.4)
  const { error: updateError } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (updateError) {
    throw new Error(`Gagal mengubah password: ${updateError.message}`);
  }

  // Clear must_change_password flag if it was set
  await supabase
    .from('user_profiles')
    .update({ 
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // Log password change event
  await logActivity(user.id, 'password_change');
}

/**
 * Generate a random temporary password
 * 
 * @returns Random password string (12 characters)
 */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Reset user password (admin function)
 * Requirements 3.1: Generate a temporary password
 * Requirements 3.2: Require user to change password on next login
 * 
 * @param userId - User ID to reset password for
 * @returns Object with temporary password
 */
export async function resetUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
  // Generate temporary password
  const temporaryPassword = generateTemporaryPassword();

  // Update password in Supabase Auth
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });

  if (authError) {
    throw new Error(`Gagal reset password: ${authError.message}`);
  }

  // Set must_change_password flag (Requirement 3.2)
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ 
      must_change_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Gagal update profil: ${profileError.message}`);
  }

  return { temporaryPassword };
}
