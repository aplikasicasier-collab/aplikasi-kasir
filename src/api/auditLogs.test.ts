/**
 * Audit Log API Tests
 * 
 * Property-based tests for audit log filtering functionality.
 * **Feature: audit-log, Property 4: Log Filtering Accuracy**
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AuditLog,
  AuditLogFilters,
  filterByDateRange,
  filterByUser,
  filterByEntityType,
  filterByEventType,
  filterByEntityId,
  filterBySearch,
  applyFilters,
  paginateResults,
} from './auditLogs';
import { AuditEventType, AuditEntityType } from '@/lib/auditLogger';

// ============================================================================
// Generators
// ============================================================================

// Generator for valid event types
const eventTypeArb = fc.constantFrom<AuditEventType>(
  'create', 'update', 'delete', 'login', 'logout',
  'transaction', 'refund', 'stock_adjustment', 'price_change', 'role_change'
);

// Generator for valid entity types
const entityTypeArb = fc.constantFrom<AuditEntityType>(
  'product', 'transaction', 'user', 'supplier', 'category',
  'purchase_order', 'return', 'discount', 'promo', 'outlet'
);

// Generator for UUID-like strings
const uuidArb = fc.uuid();

// Generator for ISO date strings within a reasonable range
// Using integer timestamps to avoid invalid date issues
const dateArb = fc.integer({
  min: new Date('2024-01-01').getTime(),
  max: new Date('2025-12-31').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

// Generator for audit log entries
const auditLogArb: fc.Arbitrary<AuditLog> = fc.record({
  id: uuidArb,
  event_type: eventTypeArb,
  entity_type: entityTypeArb,
  entity_id: fc.option(uuidArb, { nil: null }),
  user_id: fc.option(uuidArb, { nil: null }),
  user_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  user_role: fc.option(fc.constantFrom('admin', 'manager', 'kasir'), { nil: undefined }),
  outlet_id: fc.option(uuidArb, { nil: null }),
  old_values: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
  new_values: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
  changed_fields: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 })), { nil: null }),
  ip_address: fc.option(fc.ipV4(), { nil: null }),
  user_agent: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: null }),
  summary: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  created_at: dateArb,
});

// Generator for array of audit logs
const auditLogsArb = fc.array(auditLogArb, { minLength: 0, maxLength: 50 });

// ============================================================================
// Unit Tests
// ============================================================================

describe('Audit Log API - Unit Tests', () => {
  describe('filterByDateRange', () => {
    it('should return all logs when no date range specified', () => {
      const logs: AuditLog[] = [
        createMockLog({ created_at: '2024-06-01T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-15T10:00:00Z' }),
      ];
      
      const result = filterByDateRange(logs);
      expect(result).toHaveLength(2);
    });

    it('should filter logs by date_from', () => {
      const logs: AuditLog[] = [
        createMockLog({ created_at: '2024-06-01T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-15T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-30T10:00:00Z' }),
      ];
      
      const result = filterByDateRange(logs, '2024-06-10T00:00:00Z');
      expect(result).toHaveLength(2);
    });

    it('should filter logs by date_to', () => {
      const logs: AuditLog[] = [
        createMockLog({ created_at: '2024-06-01T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-15T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-30T10:00:00Z' }),
      ];
      
      const result = filterByDateRange(logs, undefined, '2024-06-20T00:00:00Z');
      expect(result).toHaveLength(2);
    });

    it('should filter logs by both date_from and date_to', () => {
      const logs: AuditLog[] = [
        createMockLog({ created_at: '2024-06-01T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-15T10:00:00Z' }),
        createMockLog({ created_at: '2024-06-30T10:00:00Z' }),
      ];
      
      const result = filterByDateRange(logs, '2024-06-10T00:00:00Z', '2024-06-20T00:00:00Z');
      expect(result).toHaveLength(1);
    });
  });

  describe('filterByUser', () => {
    it('should return all logs when no user specified', () => {
      const logs: AuditLog[] = [
        createMockLog({ user_id: 'user-1' }),
        createMockLog({ user_id: 'user-2' }),
      ];
      
      const result = filterByUser(logs);
      expect(result).toHaveLength(2);
    });

    it('should filter logs by user_id', () => {
      const logs: AuditLog[] = [
        createMockLog({ user_id: 'user-1' }),
        createMockLog({ user_id: 'user-2' }),
        createMockLog({ user_id: 'user-1' }),
      ];
      
      const result = filterByUser(logs, 'user-1');
      expect(result).toHaveLength(2);
      expect(result.every(log => log.user_id === 'user-1')).toBe(true);
    });
  });

  describe('filterByEntityType', () => {
    it('should return all logs when no entity type specified', () => {
      const logs: AuditLog[] = [
        createMockLog({ entity_type: 'product' }),
        createMockLog({ entity_type: 'user' }),
      ];
      
      const result = filterByEntityType(logs);
      expect(result).toHaveLength(2);
    });

    it('should filter logs by entity_type', () => {
      const logs: AuditLog[] = [
        createMockLog({ entity_type: 'product' }),
        createMockLog({ entity_type: 'user' }),
        createMockLog({ entity_type: 'product' }),
      ];
      
      const result = filterByEntityType(logs, 'product');
      expect(result).toHaveLength(2);
      expect(result.every(log => log.entity_type === 'product')).toBe(true);
    });
  });

  describe('filterByEventType', () => {
    it('should return all logs when no event type specified', () => {
      const logs: AuditLog[] = [
        createMockLog({ event_type: 'create' }),
        createMockLog({ event_type: 'update' }),
      ];
      
      const result = filterByEventType(logs);
      expect(result).toHaveLength(2);
    });

    it('should filter logs by event_type', () => {
      const logs: AuditLog[] = [
        createMockLog({ event_type: 'create' }),
        createMockLog({ event_type: 'update' }),
        createMockLog({ event_type: 'create' }),
      ];
      
      const result = filterByEventType(logs, 'create');
      expect(result).toHaveLength(2);
      expect(result.every(log => log.event_type === 'create')).toBe(true);
    });
  });

  describe('paginateResults', () => {
    it('should paginate results correctly', () => {
      const data = Array.from({ length: 25 }, (_, i) => ({ id: i }));
      
      const page1 = paginateResults(data, { page: 1, pageSize: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);
      
      const page3 = paginateResults(data, { page: 3, pageSize: 10 });
      expect(page3.data).toHaveLength(5);
    });
  });
});

// ============================================================================
// Property-Based Tests
// **Feature: audit-log, Property 4: Log Filtering Accuracy**
// **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
// ============================================================================

describe('Property 4: Log Filtering Accuracy', () => {
  // **Validates: Requirements 3.2**
  describe('Date Range Filter', () => {
    it('should return only logs within the specified date range', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          dateArb,
          dateArb,
          (logs, date1, date2) => {
            // Ensure date_from <= date_to
            const [dateFrom, dateTo] = [date1, date2].sort();
            
            const filtered = filterByDateRange(logs, dateFrom, dateTo);
            
            // All filtered logs should be within the date range
            return filtered.every(log => {
              const logTime = new Date(log.created_at).getTime();
              const fromTime = new Date(dateFrom).getTime();
              const toTime = new Date(dateTo).getTime();
              return logTime >= fromTime && logTime <= toTime;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any logs that are within the date range', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          dateArb,
          dateArb,
          (logs, date1, date2) => {
            const [dateFrom, dateTo] = [date1, date2].sort();
            
            const filtered = filterByDateRange(logs, dateFrom, dateTo);
            
            // Count logs that should be in range
            const expectedCount = logs.filter(log => {
              const logTime = new Date(log.created_at).getTime();
              const fromTime = new Date(dateFrom).getTime();
              const toTime = new Date(dateTo).getTime();
              return logTime >= fromTime && logTime <= toTime;
            }).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 3.3**
  describe('User Filter', () => {
    it('should return only logs by the specified user', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          uuidArb,
          (logs, userId) => {
            const filtered = filterByUser(logs, userId);
            
            // All filtered logs should have the specified user_id
            return filtered.every(log => log.user_id === userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any logs by the specified user', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          uuidArb,
          (logs, userId) => {
            const filtered = filterByUser(logs, userId);
            
            // Count logs that should match
            const expectedCount = logs.filter(log => log.user_id === userId).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all logs when user filter is undefined', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          (logs) => {
            const filtered = filterByUser(logs, undefined);
            return filtered.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 3.4**
  describe('Entity Type Filter', () => {
    it('should return only logs for the specified entity type', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          entityTypeArb,
          (logs, entityType) => {
            const filtered = filterByEntityType(logs, entityType);
            
            // All filtered logs should have the specified entity_type
            return filtered.every(log => log.entity_type === entityType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any logs of the specified entity type', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          entityTypeArb,
          (logs, entityType) => {
            const filtered = filterByEntityType(logs, entityType);
            
            // Count logs that should match
            const expectedCount = logs.filter(log => log.entity_type === entityType).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all logs when entity type filter is undefined', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          (logs) => {
            const filtered = filterByEntityType(logs, undefined);
            return filtered.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 3.5**
  describe('Event Type Filter', () => {
    it('should return only logs of the specified event type', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          eventTypeArb,
          (logs, eventType) => {
            const filtered = filterByEventType(logs, eventType);
            
            // All filtered logs should have the specified event_type
            return filtered.every(log => log.event_type === eventType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any logs of the specified event type', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          eventTypeArb,
          (logs, eventType) => {
            const filtered = filterByEventType(logs, eventType);
            
            // Count logs that should match
            const expectedCount = logs.filter(log => log.event_type === eventType).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all logs when event type filter is undefined', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          (logs) => {
            const filtered = filterByEventType(logs, undefined);
            return filtered.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Combined filter tests
  describe('Combined Filters', () => {
    it('should correctly apply multiple filters together', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          fc.record({
            date_from: fc.option(dateArb, { nil: undefined }),
            date_to: fc.option(dateArb, { nil: undefined }),
            user_id: fc.option(uuidArb, { nil: undefined }),
            entity_type: fc.option(entityTypeArb, { nil: undefined }),
            event_type: fc.option(eventTypeArb, { nil: undefined }),
          }),
          (logs, filters) => {
            const filtered = applyFilters(logs, filters);
            
            // All filtered logs should satisfy all specified filters
            return filtered.every(log => {
              // Check date range
              if (filters.date_from) {
                const logTime = new Date(log.created_at).getTime();
                const fromTime = new Date(filters.date_from).getTime();
                if (logTime < fromTime) return false;
              }
              if (filters.date_to) {
                const logTime = new Date(log.created_at).getTime();
                const toTime = new Date(filters.date_to).getTime();
                if (logTime > toTime) return false;
              }
              
              // Check user
              if (filters.user_id && log.user_id !== filters.user_id) return false;
              
              // Check entity type
              if (filters.entity_type && log.entity_type !== filters.entity_type) return false;
              
              // Check event type
              if (filters.event_type && log.event_type !== filters.event_type) return false;
              
              return true;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return subset of original logs when filters are applied', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          fc.record({
            user_id: fc.option(uuidArb, { nil: undefined }),
            entity_type: fc.option(entityTypeArb, { nil: undefined }),
            event_type: fc.option(eventTypeArb, { nil: undefined }),
          }),
          (logs, filters) => {
            const filtered = applyFilters(logs, filters);
            
            // Filtered result should never be larger than original
            return filtered.length <= logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all logs when no filters are specified', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          (logs) => {
            const filtered = applyFilters(logs, {});
            return filtered.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Search filter tests
  describe('Search Filter', () => {
    it('should return logs where summary contains search term', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.some(l => l.summary !== null)),
          fc.string({ minLength: 1, maxLength: 10 }),
          (logs, searchTerm) => {
            const filtered = filterBySearch(logs, searchTerm);
            const searchLower = searchTerm.toLowerCase();
            
            // All filtered logs should contain the search term in summary, entity_type, or event_type
            return filtered.every(log => 
              log.summary?.toLowerCase().includes(searchLower) ||
              log.entity_type.toLowerCase().includes(searchLower) ||
              log.event_type.toLowerCase().includes(searchLower)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all logs when search is empty', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          (logs) => {
            const filtered = filterBySearch(logs, '');
            return filtered.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Pagination tests
  describe('Pagination', () => {
    it('should correctly calculate total pages', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (data, pageSize) => {
            const result = paginateResults(data, { page: 1, pageSize });
            const expectedTotalPages = Math.ceil(data.length / pageSize);
            return result.totalPages === expectedTotalPages;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct page of data', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 20 }),
          (data, page, pageSize) => {
            const result = paginateResults(data, { page, pageSize });
            
            // Calculate expected slice
            const startIndex = (page - 1) * pageSize;
            const expectedData = data.slice(startIndex, startIndex + pageSize);
            
            return (
              result.data.length === expectedData.length &&
              result.page === page &&
              result.pageSize === pageSize &&
              result.total === data.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'test-id',
    event_type: 'create',
    entity_type: 'product',
    entity_id: null,
    user_id: null,
    outlet_id: null,
    old_values: null,
    new_values: null,
    changed_fields: null,
    ip_address: null,
    user_agent: null,
    summary: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
