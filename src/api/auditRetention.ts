/**
 * Audit Retention API
 * 
 * Provides functions for managing audit log retention settings and cleanup.
 * Requirements: 6.1, 6.2, 6.4
 */

import { supabase } from '@/lib/supabaseClient';

// ============================================
// Types
// Requirements: 6.1, 6.4
// ============================================

export interface RetentionSettings {
  id: string;
  retention_days: number;
  archive_enabled: boolean;
  archive_location: string | null;
  last_cleanup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageStats {
  total_logs: number;
  logs_size_mb: number;
  oldest_log_date: string | null;
  newest_log_date: string | null;
}

export interface CleanupResult {
  deleted: number;
  archived: number;
}

export interface AuditLogForRetention {
  id: string;
  created_at: string;
}

// ============================================
// Pure Functions (for testing)
// Requirements: 6.1, 6.2
// ============================================

/**
 * Calculate the cutoff date for retention cleanup
 * **Feature: audit-log, Property 7: Retention Cleanup**
 * **Validates: Requirements 6.1, 6.2**
 * 
 * @param retentionDays - Number of days to retain logs
 * @param referenceDate - Reference date (defaults to now)
 * @returns Cutoff date - logs older than this should be deleted
 */
export function calculateRetentionCutoffDate(
  retentionDays: number,
  referenceDate?: Date
): Date {
  const reference = referenceDate || new Date();
  const cutoff = new Date(reference);
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Determine which logs should be deleted based on retention period
 * **Feature: audit-log, Property 7: Retention Cleanup**
 * **Validates: Requirements 6.1, 6.2**
 * 
 * @param logs - Array of audit logs with created_at timestamps
 * @param retentionDays - Number of days to retain logs
 * @param referenceDate - Reference date for calculation (defaults to now)
 * @returns Object with logs to delete and logs to keep
 */
export function partitionLogsByRetention<T extends AuditLogForRetention>(
  logs: T[],
  retentionDays: number,
  referenceDate?: Date
): { toDelete: T[]; toKeep: T[] } {
  const cutoffDate = calculateRetentionCutoffDate(retentionDays, referenceDate);
  const cutoffTime = cutoffDate.getTime();
  
  const toDelete: T[] = [];
  const toKeep: T[] = [];
  
  for (const log of logs) {
    const logTime = new Date(log.created_at).getTime();
    if (logTime < cutoffTime) {
      toDelete.push(log);
    } else {
      toKeep.push(log);
    }
  }
  
  return { toDelete, toKeep };
}

/**
 * Check if a log is within retention period
 * **Feature: audit-log, Property 7: Retention Cleanup**
 * **Validates: Requirements 6.1, 6.2**
 * 
 * @param logCreatedAt - Log creation timestamp
 * @param retentionDays - Number of days to retain
 * @param referenceDate - Reference date (defaults to now)
 * @returns True if log should be kept, false if it should be deleted
 */
export function isWithinRetentionPeriod(
  logCreatedAt: string | Date,
  retentionDays: number,
  referenceDate?: Date
): boolean {
  const cutoffDate = calculateRetentionCutoffDate(retentionDays, referenceDate);
  const logDate = new Date(logCreatedAt);
  return logDate.getTime() >= cutoffDate.getTime();
}

/**
 * Validate retention settings
 * **Validates: Requirements 6.1**
 * 
 * @param settings - Partial retention settings to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateRetentionSettings(
  settings: Partial<RetentionSettings>
): { isValid: boolean; error?: string } {
  if (settings.retention_days !== undefined) {
    if (!Number.isInteger(settings.retention_days)) {
      return { isValid: false, error: 'Retention days must be an integer' };
    }
    if (settings.retention_days < 1) {
      return { isValid: false, error: 'Retention days must be at least 1' };
    }
    if (settings.retention_days > 3650) {
      return { isValid: false, error: 'Retention days cannot exceed 3650 (10 years)' };
    }
  }
  
  return { isValid: true };
}

/**
 * Estimate storage size based on log count
 * **Validates: Requirements 6.4**
 * 
 * @param logCount - Number of logs
 * @param avgLogSizeKB - Average size per log in KB (default 2KB)
 * @returns Estimated size in MB
 */
export function estimateStorageSizeMB(
  logCount: number,
  avgLogSizeKB: number = 2
): number {
  return (logCount * avgLogSizeKB) / 1024;
}

// ============================================
// Database Query Functions
// Requirements: 6.1, 6.2, 6.4
// ============================================

/**
 * Get current retention settings
 * **Validates: Requirements 6.1, 6.4**
 */
export async function getRetentionSettings(): Promise<RetentionSettings> {
  const { data, error } = await supabase
    .from('audit_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    // If no settings exist, return defaults
    if (error.code === 'PGRST116') {
      return {
        id: '',
        retention_days: 90,
        archive_enabled: false,
        archive_location: null,
        last_cleanup_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw new Error(`Failed to fetch retention settings: ${error.message}`);
  }

  return {
    id: data.id,
    retention_days: data.retention_days,
    archive_enabled: data.archive_enabled,
    archive_location: data.archive_location,
    last_cleanup_at: data.last_cleanup_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Update retention settings
 * **Validates: Requirements 6.1**
 */
export async function updateRetentionSettings(
  settings: Partial<Pick<RetentionSettings, 'retention_days' | 'archive_enabled' | 'archive_location'>>
): Promise<RetentionSettings> {
  // Validate settings
  const validation = validateRetentionSettings(settings);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Get current settings to find the ID
  const current = await getRetentionSettings();
  
  if (!current.id) {
    // Create new settings if none exist
    const { data, error } = await supabase
      .from('audit_settings')
      .insert({
        retention_days: settings.retention_days ?? 90,
        archive_enabled: settings.archive_enabled ?? false,
        archive_location: settings.archive_location ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create retention settings: ${error.message}`);
    }

    return {
      id: data.id,
      retention_days: data.retention_days,
      archive_enabled: data.archive_enabled,
      archive_location: data.archive_location,
      last_cleanup_at: data.last_cleanup_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  // Update existing settings
  const { data, error } = await supabase
    .from('audit_settings')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update retention settings: ${error.message}`);
  }

  return {
    id: data.id,
    retention_days: data.retention_days,
    archive_enabled: data.archive_enabled,
    archive_location: data.archive_location,
    last_cleanup_at: data.last_cleanup_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Get storage statistics for audit logs
 * **Validates: Requirements 6.4**
 */
export async function getStorageStats(): Promise<StorageStats> {
  // Use the database function for accurate stats
  const { data, error } = await supabase
    .rpc('get_audit_storage_stats');

  if (error) {
    throw new Error(`Failed to fetch storage stats: ${error.message}`);
  }

  const stats = data?.[0] || { total_logs: 0, oldest_log_date: null, newest_log_date: null };
  
  return {
    total_logs: stats.total_logs || 0,
    logs_size_mb: estimateStorageSizeMB(stats.total_logs || 0),
    oldest_log_date: stats.oldest_log_date,
    newest_log_date: stats.newest_log_date,
  };
}

/**
 * Run retention cleanup - delete logs older than retention period
 * **Feature: audit-log, Property 7: Retention Cleanup**
 * **Validates: Requirements 6.1, 6.2**
 */
export async function runRetentionCleanup(): Promise<CleanupResult> {
  // Get current retention settings
  const settings = await getRetentionSettings();
  
  // Use the database function for cleanup
  const { data, error } = await supabase
    .rpc('cleanup_old_audit_logs', { p_retention_days: settings.retention_days });

  if (error) {
    throw new Error(`Failed to run retention cleanup: ${error.message}`);
  }

  const deletedCount = data || 0;

  return {
    deleted: deletedCount,
    archived: 0, // Archive functionality not implemented yet
  };
}

/**
 * Get count of logs that would be deleted by cleanup
 * **Validates: Requirements 6.1**
 */
export async function getLogsToDeleteCount(): Promise<number> {
  const settings = await getRetentionSettings();
  const cutoffDate = calculateRetentionCutoffDate(settings.retention_days);

  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    throw new Error(`Failed to count logs to delete: ${error.message}`);
  }

  return count || 0;
}
