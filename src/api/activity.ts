/**
 * Activity API for User Management
 * 
 * Provides activity logging functionality including:
 * - Logging user activity events (login, logout, password change)
 * - Retrieving user activity history with date filtering
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { supabase } from '@/lib/supabaseClient';

// ============================================================================
// Types
// ============================================================================

export type ActivityEventType = 'login_success' | 'login_failure' | 'logout' | 'password_change';

export interface ActivityLog {
  id: string;
  user_id: string;
  event_type: ActivityEventType;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLogInput {
  userId: string | null;
  eventType: ActivityEventType;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Activity Logging Functions (Requirements 7.1, 7.2, 7.3)
// ============================================================================

/**
 * Log user activity event
 * Requirements 7.1: Display login history with timestamp and IP address
 * Requirements 7.3: Include login success and failure events
 * 
 * @param userId - User ID (can be null for failed login attempts)
 * @param eventType - Type of event (login_success, login_failure, logout, password_change)
 * @param metadata - Additional metadata for the event
 */
export async function logActivity(
  userId: string | null,
  eventType: ActivityEventType,
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
  } catch (error) {
    // Log error but don't throw - activity logging should not break main flow
    console.error('Failed to log activity:', error);
  }
}

/**
 * Get user activity logs with optional date filtering
 * Requirements 7.1: Display login history with timestamp and IP address
 * Requirements 7.2: Show last 30 days of activity
 * Requirements 7.3: Include login success and failure events
 * 
 * @param userId - User ID to get activity for
 * @param days - Number of days to look back (default: 30)
 * @returns Array of activity logs
 */
export async function getUserActivity(userId: string, days: number = 30): Promise<ActivityLog[]> {
  // Calculate the date threshold
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  const dateThresholdISO = dateThreshold.toISOString();

  const { data, error } = await supabase
    .from('user_activity_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateThresholdISO)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil activity log: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// Pure Functions for Testing
// ============================================================================

/**
 * Filter activity logs by date range (pure function for testing)
 * Requirements 7.2: Show last 30 days of activity
 * 
 * @param logs - Array of activity logs
 * @param days - Number of days to filter
 * @returns Filtered array of activity logs within the date range
 */
export function filterActivityByDays(logs: ActivityLog[], days: number): ActivityLog[] {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return logs.filter((log) => {
    const logDate = new Date(log.created_at);
    return logDate >= dateThreshold;
  });
}

/**
 * Validate activity event type
 * 
 * @param eventType - Event type to validate
 * @returns true if event type is valid
 */
export function isValidEventType(eventType: string): eventType is ActivityEventType {
  const validTypes: ActivityEventType[] = ['login_success', 'login_failure', 'logout', 'password_change'];
  return validTypes.includes(eventType as ActivityEventType);
}

/**
 * Create activity log entry (pure function for testing)
 * This creates the data structure without database interaction
 * 
 * @param userId - User ID
 * @param eventType - Event type
 * @param metadata - Optional metadata
 * @returns Activity log entry object
 */
export function createActivityLogEntry(
  userId: string | null,
  eventType: ActivityEventType,
  metadata?: Record<string, unknown>
): Omit<ActivityLog, 'id' | 'created_at'> {
  return {
    user_id: userId || '',
    event_type: eventType,
    ip_address: null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    metadata: metadata || null,
  };
}
