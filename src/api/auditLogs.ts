/**
 * Audit Log API
 * 
 * Provides query functions for audit logs with filtering and pagination.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { supabase } from '@/lib/supabaseClient';
import { AuditEventType, AuditEntityType } from '@/lib/auditLogger';

// ============================================
// Types
// Requirements: 3.1
// ============================================

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  entity_type: AuditEntityType;
  entity_id: string | null;
  user_id: string | null;
  user_name?: string;
  user_role?: string;
  outlet_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  summary: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  date_from?: string;
  date_to?: string;
  user_id?: string;
  entity_type?: AuditEntityType;
  event_type?: AuditEventType;
  entity_id?: string;
  outlet_id?: string;
  search?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Pure Filter Functions (for testing)
// Requirements: 3.2, 3.3, 3.4, 3.5
// ============================================

/**
 * Filter audit logs by date range
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.2**
 */
export function filterByDateRange(
  logs: AuditLog[],
  dateFrom?: string,
  dateTo?: string
): AuditLog[] {
  if (!dateFrom && !dateTo) {
    return logs;
  }

  return logs.filter(log => {
    const logDate = new Date(log.created_at).getTime();
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime();
      if (logDate < fromDate) return false;
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo).getTime();
      if (logDate > toDate) return false;
    }
    
    return true;
  });
}

/**
 * Filter audit logs by user ID
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.3**
 */
export function filterByUser(
  logs: AuditLog[],
  userId?: string
): AuditLog[] {
  if (!userId) {
    return logs;
  }
  return logs.filter(log => log.user_id === userId);
}

/**
 * Filter audit logs by entity type
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.4**
 */
export function filterByEntityType(
  logs: AuditLog[],
  entityType?: AuditEntityType
): AuditLog[] {
  if (!entityType) {
    return logs;
  }
  return logs.filter(log => log.entity_type === entityType);
}

/**
 * Filter audit logs by event type
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.5**
 */
export function filterByEventType(
  logs: AuditLog[],
  eventType?: AuditEventType
): AuditLog[] {
  if (!eventType) {
    return logs;
  }
  return logs.filter(log => log.event_type === eventType);
}

/**
 * Filter audit logs by entity ID
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.1**
 */
export function filterByEntityId(
  logs: AuditLog[],
  entityId?: string
): AuditLog[] {
  if (!entityId) {
    return logs;
  }
  return logs.filter(log => log.entity_id === entityId);
}

/**
 * Filter audit logs by search term (searches in summary)
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.1**
 */
export function filterBySearch(
  logs: AuditLog[],
  search?: string
): AuditLog[] {
  if (!search || search.trim() === '') {
    return logs;
  }
  const searchLower = search.toLowerCase();
  return logs.filter(log => 
    log.summary?.toLowerCase().includes(searchLower) ||
    log.entity_type.toLowerCase().includes(searchLower) ||
    log.event_type.toLowerCase().includes(searchLower)
  );
}

/**
 * Apply all filters to audit logs (pure function for testing)
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
 */
export function applyFilters(
  logs: AuditLog[],
  filters: AuditLogFilters
): AuditLog[] {
  let result = logs;
  
  result = filterByDateRange(result, filters.date_from, filters.date_to);
  result = filterByUser(result, filters.user_id);
  result = filterByEntityType(result, filters.entity_type);
  result = filterByEventType(result, filters.event_type);
  result = filterByEntityId(result, filters.entity_id);
  result = filterBySearch(result, filters.search);
  
  return result;
}

/**
 * Paginate results (pure function for testing)
 */
export function paginateResults<T>(
  data: T[],
  pagination: Pagination
): PaginatedResult<T> {
  const { page, pageSize } = pagination;
  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  return {
    data: data.slice(startIndex, endIndex),
    total,
    page,
    pageSize,
    totalPages,
  };
}


// ============================================
// Database Query Functions
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
// ============================================

/**
 * Get audit logs with filters and pagination
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */
export async function getAuditLogs(
  filters?: AuditLogFilters,
  pagination?: Pagination
): Promise<PaginatedResult<AuditLog>> {
  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 20;
  
  // Build query
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      user_profiles!audit_logs_user_id_fkey (
        full_name,
        role
      )
    `, { count: 'exact' });

  // Apply filters at database level for efficiency
  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  
  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }
  
  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  
  if (filters?.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }
  
  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type);
  }
  
  if (filters?.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }
  
  if (filters?.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }
  
  if (filters?.search) {
    query = query.ilike('summary', `%${filters.search}%`);
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  // Transform data to include user info
  const logs: AuditLog[] = (data || []).map(log => ({
    id: log.id,
    event_type: log.event_type as AuditEventType,
    entity_type: log.entity_type as AuditEntityType,
    entity_id: log.entity_id,
    user_id: log.user_id,
    user_name: log.user_profiles?.full_name || undefined,
    user_role: log.user_profiles?.role || undefined,
    outlet_id: log.outlet_id,
    old_values: log.old_values,
    new_values: log.new_values,
    changed_fields: log.changed_fields,
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    summary: log.summary,
    created_at: log.created_at,
  }));

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: logs,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get a single audit log by ID
 * **Validates: Requirements 3.1**
 */
export async function getAuditLogById(id: string): Promise<AuditLog | null> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user_profiles!audit_logs_user_id_fkey (
        full_name,
        role
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    event_type: data.event_type as AuditEventType,
    entity_type: data.entity_type as AuditEntityType,
    entity_id: data.entity_id,
    user_id: data.user_id,
    user_name: data.user_profiles?.full_name || undefined,
    user_role: data.user_profiles?.role || undefined,
    outlet_id: data.outlet_id,
    old_values: data.old_values,
    new_values: data.new_values,
    changed_fields: data.changed_fields,
    ip_address: data.ip_address,
    user_agent: data.user_agent,
    summary: data.summary,
    created_at: data.created_at,
  };
}

/**
 * Get audit logs for a specific entity
 * **Validates: Requirements 3.1, 3.4**
 */
export async function getAuditLogsByEntity(
  entityType: AuditEntityType,
  entityId: string
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user_profiles!audit_logs_user_id_fkey (
        full_name,
        role
      )
    `)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return (data || []).map(log => ({
    id: log.id,
    event_type: log.event_type as AuditEventType,
    entity_type: log.entity_type as AuditEntityType,
    entity_id: log.entity_id,
    user_id: log.user_id,
    user_name: log.user_profiles?.full_name || undefined,
    user_role: log.user_profiles?.role || undefined,
    outlet_id: log.outlet_id,
    old_values: log.old_values,
    new_values: log.new_values,
    changed_fields: log.changed_fields,
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    summary: log.summary,
    created_at: log.created_at,
  }));
}
