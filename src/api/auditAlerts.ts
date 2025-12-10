/**
 * Audit Alert API
 * 
 * Provides functions for managing security alerts and suspicious activity detection.
 * Requirements: 7.1, 7.2, 7.4
 */

import { supabase } from '@/lib/supabaseClient';

// ============================================
// Types
// Requirements: 7.4
// ============================================

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'failed_login' | 'bulk_delete' | 'unusual_transaction' | 'unauthorized_access';

export interface AuditAlert {
  id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  user_id: string | null;
  user_name?: string;
  user_role?: string;
  description: string;
  metadata: Record<string, unknown> | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface AlertFilters {
  alert_type?: AlertType;
  severity?: AlertSeverity;
  user_id?: string;
  is_resolved?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface CreateAlertInput {
  alert_type: AlertType;
  severity: AlertSeverity;
  user_id?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
}

// ============================================
// Configuration Constants
// Requirements: 7.1, 7.2
// ============================================

export const ALERT_THRESHOLDS = {
  FAILED_LOGIN_COUNT: 5,
  FAILED_LOGIN_WINDOW_MINUTES: 15,
  BULK_DELETE_COUNT: 10,
  BULK_DELETE_WINDOW_MINUTES: 5,
};

// ============================================
// Pure Functions (for testing)
// Requirements: 7.4
// ============================================

/**
 * Determine severity based on alert type and context
 * **Feature: audit-log, Property 9: Alert Severity Assignment**
 * **Validates: Requirements 7.4**
 */
export function determineSeverity(
  alertType: AlertType,
  metadata?: Record<string, unknown>
): AlertSeverity {
  switch (alertType) {
    case 'failed_login': {
      const count = (metadata?.attempt_count as number) || 0;
      if (count >= 10) return 'critical';
      if (count >= 7) return 'high';
      if (count >= 5) return 'medium';
      return 'low';
    }
    case 'bulk_delete': {
      const count = (metadata?.delete_count as number) || 0;
      if (count >= 50) return 'critical';
      if (count >= 25) return 'high';
      if (count >= 10) return 'medium';
      return 'low';
    }
    case 'unusual_transaction':
      return 'medium';
    case 'unauthorized_access':
      return 'high';
    default:
      return 'low';
  }
}

/**
 * Filter alerts by type
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.4**
 */
export function filterAlertsByType(
  alerts: AuditAlert[],
  alertType?: AlertType
): AuditAlert[] {
  if (!alertType) return alerts;
  return alerts.filter(alert => alert.alert_type === alertType);
}

/**
 * Filter alerts by severity
 * **Feature: audit-log, Property 9: Alert Severity Assignment**
 * **Validates: Requirements 7.4**
 */
export function filterAlertsBySeverity(
  alerts: AuditAlert[],
  severity?: AlertSeverity
): AuditAlert[] {
  if (!severity) return alerts;
  return alerts.filter(alert => alert.severity === severity);
}

/**
 * Filter alerts by resolved status
 * **Validates: Requirements 7.4**
 */
export function filterAlertsByResolved(
  alerts: AuditAlert[],
  isResolved?: boolean
): AuditAlert[] {
  if (isResolved === undefined) return alerts;
  return alerts.filter(alert => alert.is_resolved === isResolved);
}

/**
 * Apply all filters to alerts (pure function for testing)
 * **Validates: Requirements 7.4**
 */
export function applyAlertFilters(
  alerts: AuditAlert[],
  filters: AlertFilters
): AuditAlert[] {
  let result = alerts;
  
  result = filterAlertsByType(result, filters.alert_type);
  result = filterAlertsBySeverity(result, filters.severity);
  result = filterAlertsByResolved(result, filters.is_resolved);
  
  if (filters.user_id) {
    result = result.filter(alert => alert.user_id === filters.user_id);
  }
  
  if (filters.date_from) {
    const fromDate = new Date(filters.date_from).getTime();
    result = result.filter(alert => new Date(alert.created_at).getTime() >= fromDate);
  }
  
  if (filters.date_to) {
    const toDate = new Date(filters.date_to).getTime();
    result = result.filter(alert => new Date(alert.created_at).getTime() <= toDate);
  }
  
  return result;
}


// ============================================
// Database Query Functions
// Requirements: 7.4
// ============================================

/**
 * Get alerts with optional filters
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.4**
 */
export async function getAlerts(filters?: AlertFilters): Promise<AuditAlert[]> {
  let query = supabase
    .from('audit_alerts')
    .select(`
      *,
      user_profiles!audit_alerts_user_id_fkey (
        full_name,
        role
      )
    `);

  // Apply filters at database level
  if (filters?.alert_type) {
    query = query.eq('alert_type', filters.alert_type);
  }
  
  if (filters?.severity) {
    query = query.eq('severity', filters.severity);
  }
  
  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  
  if (filters?.is_resolved !== undefined) {
    query = query.eq('is_resolved', filters.is_resolved);
  }
  
  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  
  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch alerts: ${error.message}`);
  }

  return (data || []).map(alert => ({
    id: alert.id,
    alert_type: alert.alert_type as AlertType,
    severity: alert.severity as AlertSeverity,
    user_id: alert.user_id,
    user_name: alert.user_profiles?.full_name || undefined,
    user_role: alert.user_profiles?.role || undefined,
    description: alert.description,
    metadata: alert.metadata,
    is_resolved: alert.is_resolved,
    resolved_by: alert.resolved_by,
    resolved_at: alert.resolved_at,
    resolution_notes: alert.resolution_notes,
    created_at: alert.created_at,
  }));
}

/**
 * Get all unresolved alerts
 * **Validates: Requirements 7.4**
 */
export async function getUnresolvedAlerts(): Promise<AuditAlert[]> {
  return getAlerts({ is_resolved: false });
}

/**
 * Resolve an alert
 * **Validates: Requirements 7.4**
 */
export async function resolveAlert(
  id: string,
  notes?: string
): Promise<AuditAlert> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const { data, error } = await supabase
    .from('audit_alerts')
    .update({
      is_resolved: true,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes || null,
    })
    .eq('id', id)
    .select(`
      *,
      user_profiles!audit_alerts_user_id_fkey (
        full_name,
        role
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to resolve alert: ${error.message}`);
  }

  return {
    id: data.id,
    alert_type: data.alert_type as AlertType,
    severity: data.severity as AlertSeverity,
    user_id: data.user_id,
    user_name: data.user_profiles?.full_name || undefined,
    user_role: data.user_profiles?.role || undefined,
    description: data.description,
    metadata: data.metadata,
    is_resolved: data.is_resolved,
    resolved_by: data.resolved_by,
    resolved_at: data.resolved_at,
    resolution_notes: data.resolution_notes,
    created_at: data.created_at,
  };
}

/**
 * Create a new alert
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Feature: audit-log, Property 9: Alert Severity Assignment**
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */
export async function createAlert(input: CreateAlertInput): Promise<AuditAlert> {
  const { data, error } = await supabase
    .from('audit_alerts')
    .insert({
      alert_type: input.alert_type,
      severity: input.severity,
      user_id: input.user_id || null,
      description: input.description,
      metadata: input.metadata || null,
    })
    .select(`
      *,
      user_profiles!audit_alerts_user_id_fkey (
        full_name,
        role
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create alert: ${error.message}`);
  }

  return {
    id: data.id,
    alert_type: data.alert_type as AlertType,
    severity: data.severity as AlertSeverity,
    user_id: data.user_id,
    user_name: data.user_profiles?.full_name || undefined,
    user_role: data.user_profiles?.role || undefined,
    description: data.description,
    metadata: data.metadata,
    is_resolved: data.is_resolved,
    resolved_by: data.resolved_by,
    resolved_at: data.resolved_at,
    resolution_notes: data.resolution_notes,
    created_at: data.created_at,
  };
}


// ============================================
// Suspicious Activity Detection Functions
// Requirements: 7.1, 7.2
// ============================================

/**
 * Check if failed login attempts exceed threshold
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.1**
 */
export async function checkFailedLoginThreshold(userId: string): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - ALERT_THRESHOLDS.FAILED_LOGIN_WINDOW_MINUTES);

  // Query user_activity_logs for failed login attempts
  const { data, error } = await supabase
    .from('user_activity_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', 'login_failure')
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Failed to check login threshold:', error.message);
    return false;
  }

  const failedCount = data?.length || 0;
  return failedCount >= ALERT_THRESHOLDS.FAILED_LOGIN_COUNT;
}

/**
 * Check if bulk delete operations exceed threshold
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.2**
 */
export async function checkBulkDeleteThreshold(
  userId: string,
  entityType: string
): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - ALERT_THRESHOLDS.BULK_DELETE_WINDOW_MINUTES);

  // Query audit_logs for delete operations
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', 'delete')
    .eq('entity_type', entityType)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Failed to check bulk delete threshold:', error.message);
    return false;
  }

  const deleteCount = data?.length || 0;
  return deleteCount >= ALERT_THRESHOLDS.BULK_DELETE_COUNT;
}

/**
 * Pure function to check if count exceeds threshold
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.1, 7.2**
 */
export function exceedsThreshold(count: number, threshold: number): boolean {
  return count >= threshold;
}

/**
 * Pure function to count events within time window
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.1, 7.2**
 */
export function countEventsInWindow<T extends { created_at: string }>(
  events: T[],
  windowStart: Date,
  windowEnd: Date
): number {
  return events.filter(event => {
    const eventTime = new Date(event.created_at).getTime();
    return eventTime >= windowStart.getTime() && eventTime <= windowEnd.getTime();
  }).length;
}

/**
 * Create alert for failed login threshold exceeded
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.1**
 */
export async function createFailedLoginAlert(
  userId: string,
  attemptCount: number,
  ipAddress?: string
): Promise<AuditAlert> {
  const severity = determineSeverity('failed_login', { attempt_count: attemptCount });
  
  return createAlert({
    alert_type: 'failed_login',
    severity,
    user_id: userId,
    description: `Multiple failed login attempts detected: ${attemptCount} attempts within ${ALERT_THRESHOLDS.FAILED_LOGIN_WINDOW_MINUTES} minutes`,
    metadata: {
      attempt_count: attemptCount,
      ip_address: ipAddress,
      threshold: ALERT_THRESHOLDS.FAILED_LOGIN_COUNT,
      window_minutes: ALERT_THRESHOLDS.FAILED_LOGIN_WINDOW_MINUTES,
    },
  });
}

/**
 * Create alert for bulk delete threshold exceeded
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Validates: Requirements 7.2**
 */
export async function createBulkDeleteAlert(
  userId: string,
  entityType: string,
  deleteCount: number
): Promise<AuditAlert> {
  const severity = determineSeverity('bulk_delete', { delete_count: deleteCount });
  
  return createAlert({
    alert_type: 'bulk_delete',
    severity,
    user_id: userId,
    description: `Bulk delete operation detected: ${deleteCount} ${entityType} records deleted within ${ALERT_THRESHOLDS.BULK_DELETE_WINDOW_MINUTES} minutes`,
    metadata: {
      delete_count: deleteCount,
      entity_type: entityType,
      threshold: ALERT_THRESHOLDS.BULK_DELETE_COUNT,
      window_minutes: ALERT_THRESHOLDS.BULK_DELETE_WINDOW_MINUTES,
    },
  });
}
