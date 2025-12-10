/**
 * Audit Logger Utility
 * 
 * Provides comprehensive audit logging functionality for tracking all data changes
 * and business events in the POS system.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.2, 7.2
 */

import { supabase } from '@/lib/supabaseClient';
import { 
  checkBulkDeleteThreshold, 
  createBulkDeleteAlert,
  ALERT_THRESHOLDS 
} from '@/api/auditAlerts';

// ============================================================================
// Types
// ============================================================================

export type AuditEventType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'login' 
  | 'logout' 
  | 'transaction' 
  | 'refund' 
  | 'stock_adjustment' 
  | 'price_change' 
  | 'role_change';

export type AuditEntityType = 
  | 'product' 
  | 'transaction' 
  | 'user' 
  | 'supplier' 
  | 'category' 
  | 'purchase_order' 
  | 'return' 
  | 'discount' 
  | 'promo' 
  | 'outlet';

export interface AuditContext {
  userId: string;
  userRole: string;
  outletId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  event_type: AuditEventType;
  entity_type: AuditEntityType;
  entity_id: string | null;
  user_id: string | null;
  outlet_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  summary: string | null;
}

// ============================================================================
// Helper Functions (Pure functions for testing)
// Requirements: 4.2
// ============================================================================

/**
 * Calculate which fields changed between old and new values
 * Requirements 4.2: Highlight the specific fields that changed
 * 
 * @param oldValues - Object containing old values
 * @param newValues - Object containing new values
 * @returns Array of field names that changed
 */
export function calculateChangedFields(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined
): string[] {
  if (!oldValues || !newValues) {
    return [];
  }

  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    
    // Deep comparison for objects and arrays
    if (!deepEqual(oldVal, newVal)) {
      changedFields.push(key);
    }
  }

  return changedFields.sort();
}

/**
 * Deep equality check for comparing values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => deepEqual(val, b[idx]));
    }
    
    if (Array.isArray(a) || Array.isArray(b)) return false;
    
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }
  
  return false;
}

/**
 * Generate human-readable summary for audit log entry
 * 
 * @param eventType - Type of event
 * @param entityType - Type of entity
 * @param changes - Array of changed field names (for updates)
 * @returns Human-readable summary string
 */
export function generateSummary(
  eventType: AuditEventType,
  entityType: AuditEntityType,
  changes?: string[]
): string {
  const entityLabels: Record<AuditEntityType, string> = {
    product: 'Produk',
    transaction: 'Transaksi',
    user: 'Pengguna',
    supplier: 'Supplier',
    category: 'Kategori',
    purchase_order: 'Purchase Order',
    return: 'Retur',
    discount: 'Diskon',
    promo: 'Promo',
    outlet: 'Outlet',
  };

  const eventLabels: Record<AuditEventType, string> = {
    create: 'dibuat',
    update: 'diperbarui',
    delete: 'dihapus',
    login: 'login',
    logout: 'logout',
    transaction: 'transaksi selesai',
    refund: 'refund diproses',
    stock_adjustment: 'stok disesuaikan',
    price_change: 'harga diubah',
    role_change: 'role diubah',
  };

  const entityLabel = entityLabels[entityType] || entityType;
  const eventLabel = eventLabels[eventType] || eventType;

  // For CRUD operations
  if (['create', 'update', 'delete'].includes(eventType)) {
    if (eventType === 'update' && changes && changes.length > 0) {
      return `${entityLabel} ${eventLabel} (${changes.join(', ')})`;
    }
    return `${entityLabel} ${eventLabel}`;
  }

  // For business events
  return `${entityLabel}: ${eventLabel}`;
}

/**
 * Validate event type
 */
export function isValidEventType(eventType: string): eventType is AuditEventType {
  const validTypes: AuditEventType[] = [
    'create', 'update', 'delete', 'login', 'logout',
    'transaction', 'refund', 'stock_adjustment', 'price_change', 'role_change'
  ];
  return validTypes.includes(eventType as AuditEventType);
}

/**
 * Validate entity type
 */
export function isValidEntityType(entityType: string): entityType is AuditEntityType {
  const validTypes: AuditEntityType[] = [
    'product', 'transaction', 'user', 'supplier', 'category',
    'purchase_order', 'return', 'discount', 'promo', 'outlet'
  ];
  return validTypes.includes(entityType as AuditEntityType);
}

// ============================================================================
// AuditLogger Class
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
// ============================================================================

/**
 * Utility class for logging audit events from application code
 */
export class AuditLogger {
  private static context: AuditContext | null = null;

  /**
   * Set the current audit context (user, outlet, etc.)
   * Requirements 1.4, 1.5: Capture IP address, user agent, and outlet context
   * 
   * @param context - Audit context containing user and session info
   */
  static setContext(context: AuditContext): void {
    AuditLogger.context = context;
  }

  /**
   * Clear the current audit context
   */
  static clearContext(): void {
    AuditLogger.context = null;
  }

  /**
   * Get the current audit context
   */
  static getContext(): AuditContext | null {
    return AuditLogger.context;
  }

  /**
   * Build audit log entry with context
   */
  private static buildLogEntry(
    eventType: AuditEventType,
    entityType: AuditEntityType,
    entityId: string | null,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ): AuditLogEntry {
    const changedFields = eventType === 'update' 
      ? calculateChangedFields(oldValues, newValues) 
      : null;
    
    const summary = generateSummary(eventType, entityType, changedFields || undefined);
    
    // Get user agent from browser if available and not in context
    const userAgent = AuditLogger.context?.userAgent || 
      (typeof navigator !== 'undefined' ? navigator.userAgent : null);

    return {
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      user_id: AuditLogger.context?.userId || null,
      outlet_id: AuditLogger.context?.outletId || null,
      old_values: oldValues,
      new_values: newValues,
      changed_fields: changedFields,
      ip_address: AuditLogger.context?.ipAddress || null,
      user_agent: userAgent,
      summary,
    };
  }

  /**
   * Save audit log entry to database
   */
  private static async saveLog(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabase.from('audit_logs').insert(entry);
      
      if (error) {
        console.error('Failed to save audit log:', error);
      }
    } catch (error) {
      // Log error but don't throw - audit logging should not break main flow
      console.error('Failed to save audit log:', error);
    }
  }

  /**
   * Log a create event
   * Requirements 1.1: Record event with entity type, entity ID, user ID, and timestamp
   * 
   * @param entityType - Type of entity being created
   * @param entityId - ID of the created entity
   * @param data - The created data
   */
  static async logCreate(
    entityType: AuditEntityType,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const entry = AuditLogger.buildLogEntry(
      'create',
      entityType,
      entityId,
      null,
      data
    );
    await AuditLogger.saveLog(entry);
  }

  /**
   * Log an update event
   * Requirements 1.2: Record old values and new values
   * 
   * @param entityType - Type of entity being updated
   * @param entityId - ID of the updated entity
   * @param oldData - Data before the update
   * @param newData - Data after the update
   */
  static async logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): Promise<void> {
    const entry = AuditLogger.buildLogEntry(
      'update',
      entityType,
      entityId,
      oldData,
      newData
    );
    await AuditLogger.saveLog(entry);
  }

  /**
   * Log a delete event
   * Requirements 1.3: Record the deleted data snapshot
   * Requirements 7.2: Check for bulk delete threshold and create alert if exceeded
   * 
   * @param entityType - Type of entity being deleted
   * @param entityId - ID of the deleted entity
   * @param data - The deleted data snapshot
   */
  static async logDelete(
    entityType: AuditEntityType,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const entry = AuditLogger.buildLogEntry(
      'delete',
      entityType,
      entityId,
      data,
      null
    );
    await AuditLogger.saveLog(entry);
    
    // Check for bulk delete threshold and create alert if exceeded
    // Requirements 7.2: WHEN bulk data deletion occurs THEN flag as suspicious
    if (AuditLogger.context?.userId) {
      await AuditLogger.checkAndTriggerBulkDeleteAlert(entityType);
    }
  }

  /**
   * Check bulk delete threshold and create alert if exceeded
   * Requirements 7.2: WHEN bulk data deletion occurs THEN flag as suspicious
   * 
   * @param entityType - Type of entity being deleted
   */
  private static async checkAndTriggerBulkDeleteAlert(entityType: AuditEntityType): Promise<void> {
    try {
      const userId = AuditLogger.context?.userId;
      if (!userId) return;

      const thresholdExceeded = await checkBulkDeleteThreshold(userId, entityType);
      
      if (thresholdExceeded) {
        // Get the count of delete operations for the alert
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - ALERT_THRESHOLDS.BULK_DELETE_WINDOW_MINUTES);
        
        const { data } = await supabase
          .from('audit_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'delete')
          .eq('entity_type', entityType)
          .gte('created_at', windowStart.toISOString());
        
        const deleteCount = data?.length || ALERT_THRESHOLDS.BULK_DELETE_COUNT;
        
        await createBulkDeleteAlert(userId, entityType, deleteCount);
      }
    } catch (error) {
      // Log error but don't throw - alert creation should not break main flow
      console.error('Failed to check/create bulk delete alert:', error);
    }
  }

  /**
   * Log a business event
   * Requirements 2.1-2.5: Track specific business events
   * 
   * @param eventType - Type of business event
   * @param entityType - Type of entity involved
   * @param entityId - ID of the entity involved
   * @param metadata - Additional event metadata
   */
  static async logEvent(
    eventType: AuditEventType,
    entityType: AuditEntityType,
    entityId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const entry = AuditLogger.buildLogEntry(
      eventType,
      entityType,
      entityId,
      null,
      metadata || null
    );
    await AuditLogger.saveLog(entry);
  }

  /**
   * Create audit log entry without saving (for testing)
   * This is a pure function that creates the data structure without database interaction
   */
  static createLogEntry(
    eventType: AuditEventType,
    entityType: AuditEntityType,
    entityId: string | null,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ): AuditLogEntry {
    return AuditLogger.buildLogEntry(eventType, entityType, entityId, oldValues, newValues);
  }
}

export default AuditLogger;
