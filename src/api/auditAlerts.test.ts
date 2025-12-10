/**
 * Audit Alert API Tests
 * 
 * Property-based tests for alert functionality and suspicious activity detection.
 * **Feature: audit-log, Property 8: Suspicious Activity Detection**
 * **Feature: audit-log, Property 9: Alert Severity Assignment**
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AuditAlert,
  AlertSeverity,
  AlertType,
  AlertFilters,
  ALERT_THRESHOLDS,
  determineSeverity,
  filterAlertsByType,
  filterAlertsBySeverity,
  filterAlertsByResolved,
  applyAlertFilters,
  exceedsThreshold,
  countEventsInWindow,
} from './auditAlerts';

// ============================================================================
// Generators
// ============================================================================

// Generator for valid alert types
const alertTypeArb = fc.constantFrom<AlertType>(
  'failed_login', 'bulk_delete', 'unusual_transaction', 'unauthorized_access'
);

// Generator for valid severity levels
const severityArb = fc.constantFrom<AlertSeverity>(
  'low', 'medium', 'high', 'critical'
);

// Generator for UUID-like strings
const uuidArb = fc.uuid();

// Generator for ISO date strings within a reasonable range
const dateArb = fc.integer({
  min: new Date('2024-01-01').getTime(),
  max: new Date('2025-12-31').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

// Generator for audit alert entries
const auditAlertArb: fc.Arbitrary<AuditAlert> = fc.record({
  id: uuidArb,
  alert_type: alertTypeArb,
  severity: severityArb,
  user_id: fc.option(uuidArb, { nil: null }),
  user_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  user_role: fc.option(fc.constantFrom('admin', 'manager', 'kasir'), { nil: undefined }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
  is_resolved: fc.boolean(),
  resolved_by: fc.option(uuidArb, { nil: null }),
  resolved_at: fc.option(dateArb, { nil: null }),
  resolution_notes: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  created_at: dateArb,
});

// Generator for array of audit alerts
const auditAlertsArb = fc.array(auditAlertArb, { minLength: 0, maxLength: 50 });

// Generator for events with timestamps (for counting in window)
const eventWithTimestampArb = fc.record({
  id: uuidArb,
  created_at: dateArb,
});

const eventsArb = fc.array(eventWithTimestampArb, { minLength: 0, maxLength: 100 });

// ============================================================================
// Unit Tests
// ============================================================================

describe('Audit Alert API - Unit Tests', () => {
  describe('determineSeverity', () => {
    it('should return low severity for failed_login with < 5 attempts', () => {
      expect(determineSeverity('failed_login', { attempt_count: 3 })).toBe('low');
    });

    it('should return medium severity for failed_login with 5-6 attempts', () => {
      expect(determineSeverity('failed_login', { attempt_count: 5 })).toBe('medium');
      expect(determineSeverity('failed_login', { attempt_count: 6 })).toBe('medium');
    });

    it('should return high severity for failed_login with 7-9 attempts', () => {
      expect(determineSeverity('failed_login', { attempt_count: 7 })).toBe('high');
      expect(determineSeverity('failed_login', { attempt_count: 9 })).toBe('high');
    });

    it('should return critical severity for failed_login with >= 10 attempts', () => {
      expect(determineSeverity('failed_login', { attempt_count: 10 })).toBe('critical');
      expect(determineSeverity('failed_login', { attempt_count: 15 })).toBe('critical');
    });

    it('should return low severity for bulk_delete with < 10 deletes', () => {
      expect(determineSeverity('bulk_delete', { delete_count: 5 })).toBe('low');
    });

    it('should return medium severity for bulk_delete with 10-24 deletes', () => {
      expect(determineSeverity('bulk_delete', { delete_count: 10 })).toBe('medium');
      expect(determineSeverity('bulk_delete', { delete_count: 20 })).toBe('medium');
    });

    it('should return high severity for bulk_delete with 25-49 deletes', () => {
      expect(determineSeverity('bulk_delete', { delete_count: 25 })).toBe('high');
      expect(determineSeverity('bulk_delete', { delete_count: 40 })).toBe('high');
    });

    it('should return critical severity for bulk_delete with >= 50 deletes', () => {
      expect(determineSeverity('bulk_delete', { delete_count: 50 })).toBe('critical');
      expect(determineSeverity('bulk_delete', { delete_count: 100 })).toBe('critical');
    });

    it('should return medium severity for unusual_transaction', () => {
      expect(determineSeverity('unusual_transaction')).toBe('medium');
    });

    it('should return high severity for unauthorized_access', () => {
      expect(determineSeverity('unauthorized_access')).toBe('high');
    });
  });

  describe('filterAlertsByType', () => {
    it('should return all alerts when no type specified', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ alert_type: 'failed_login' }),
        createMockAlert({ alert_type: 'bulk_delete' }),
      ];
      
      const result = filterAlertsByType(alerts);
      expect(result).toHaveLength(2);
    });

    it('should filter alerts by type', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ alert_type: 'failed_login' }),
        createMockAlert({ alert_type: 'bulk_delete' }),
        createMockAlert({ alert_type: 'failed_login' }),
      ];
      
      const result = filterAlertsByType(alerts, 'failed_login');
      expect(result).toHaveLength(2);
      expect(result.every(a => a.alert_type === 'failed_login')).toBe(true);
    });
  });

  describe('filterAlertsBySeverity', () => {
    it('should return all alerts when no severity specified', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ severity: 'low' }),
        createMockAlert({ severity: 'high' }),
      ];
      
      const result = filterAlertsBySeverity(alerts);
      expect(result).toHaveLength(2);
    });

    it('should filter alerts by severity', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ severity: 'low' }),
        createMockAlert({ severity: 'high' }),
        createMockAlert({ severity: 'low' }),
      ];
      
      const result = filterAlertsBySeverity(alerts, 'low');
      expect(result).toHaveLength(2);
      expect(result.every(a => a.severity === 'low')).toBe(true);
    });
  });

  describe('filterAlertsByResolved', () => {
    it('should return all alerts when resolved status not specified', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ is_resolved: true }),
        createMockAlert({ is_resolved: false }),
      ];
      
      const result = filterAlertsByResolved(alerts);
      expect(result).toHaveLength(2);
    });

    it('should filter unresolved alerts', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ is_resolved: true }),
        createMockAlert({ is_resolved: false }),
        createMockAlert({ is_resolved: false }),
      ];
      
      const result = filterAlertsByResolved(alerts, false);
      expect(result).toHaveLength(2);
      expect(result.every(a => a.is_resolved === false)).toBe(true);
    });

    it('should filter resolved alerts', () => {
      const alerts: AuditAlert[] = [
        createMockAlert({ is_resolved: true }),
        createMockAlert({ is_resolved: false }),
        createMockAlert({ is_resolved: true }),
      ];
      
      const result = filterAlertsByResolved(alerts, true);
      expect(result).toHaveLength(2);
      expect(result.every(a => a.is_resolved === true)).toBe(true);
    });
  });

  describe('exceedsThreshold', () => {
    it('should return true when count equals threshold', () => {
      expect(exceedsThreshold(5, 5)).toBe(true);
    });

    it('should return true when count exceeds threshold', () => {
      expect(exceedsThreshold(10, 5)).toBe(true);
    });

    it('should return false when count is below threshold', () => {
      expect(exceedsThreshold(3, 5)).toBe(false);
    });
  });

  describe('countEventsInWindow', () => {
    it('should count events within time window', () => {
      const now = new Date();
      const events = [
        { id: '1', created_at: new Date(now.getTime() - 5 * 60000).toISOString() }, // 5 min ago
        { id: '2', created_at: new Date(now.getTime() - 10 * 60000).toISOString() }, // 10 min ago
        { id: '3', created_at: new Date(now.getTime() - 20 * 60000).toISOString() }, // 20 min ago
      ];
      
      const windowStart = new Date(now.getTime() - 15 * 60000); // 15 min ago
      const windowEnd = now;
      
      const count = countEventsInWindow(events, windowStart, windowEnd);
      expect(count).toBe(2);
    });

    it('should return 0 for empty events array', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 15 * 60000);
      
      const count = countEventsInWindow([], windowStart, now);
      expect(count).toBe(0);
    });
  });
});


// ============================================================================
// Property-Based Tests
// **Feature: audit-log, Property 8: Suspicious Activity Detection**
// **Validates: Requirements 7.1, 7.2**
// ============================================================================

describe('Property 8: Suspicious Activity Detection', () => {
  describe('Threshold Detection', () => {
    it('should correctly identify when count exceeds threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (count, threshold) => {
            const result = exceedsThreshold(count, threshold);
            return result === (count >= threshold);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect failed login threshold correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          (attemptCount) => {
            const threshold = ALERT_THRESHOLDS.FAILED_LOGIN_COUNT;
            const shouldTrigger = attemptCount >= threshold;
            const result = exceedsThreshold(attemptCount, threshold);
            return result === shouldTrigger;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect bulk delete threshold correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 30 }),
          (deleteCount) => {
            const threshold = ALERT_THRESHOLDS.BULK_DELETE_COUNT;
            const shouldTrigger = deleteCount >= threshold;
            const result = exceedsThreshold(deleteCount, threshold);
            return result === shouldTrigger;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Event Counting in Time Window', () => {
    it('should count only events within the specified time window', () => {
      fc.assert(
        fc.property(
          eventsArb,
          fc.integer({ min: 1, max: 60 }), // window size in minutes
          (events, windowMinutes) => {
            const now = new Date();
            const windowStart = new Date(now.getTime() - windowMinutes * 60000);
            const windowEnd = now;
            
            const count = countEventsInWindow(events, windowStart, windowEnd);
            
            // Manually count events in window
            const expectedCount = events.filter(e => {
              const eventTime = new Date(e.created_at).getTime();
              return eventTime >= windowStart.getTime() && eventTime <= windowEnd.getTime();
            }).length;
            
            return count === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for empty events array', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 60 }),
          (windowMinutes) => {
            const now = new Date();
            const windowStart = new Date(now.getTime() - windowMinutes * 60000);
            
            const count = countEventsInWindow([], windowStart, now);
            return count === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should count all events when window covers all timestamps', () => {
      fc.assert(
        fc.property(
          eventsArb.filter(events => events.length > 0),
          (events) => {
            // Create a window that covers all possible timestamps
            const windowStart = new Date('2020-01-01');
            const windowEnd = new Date('2030-12-31');
            
            const count = countEventsInWindow(events, windowStart, windowEnd);
            return count === events.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Alert Filtering by Type', () => {
    it('should return only alerts of the specified type', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          alertTypeArb,
          (alerts, alertType) => {
            const filtered = filterAlertsByType(alerts, alertType);
            return filtered.every(alert => alert.alert_type === alertType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any alerts of the specified type', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          alertTypeArb,
          (alerts, alertType) => {
            const filtered = filterAlertsByType(alerts, alertType);
            const expectedCount = alerts.filter(a => a.alert_type === alertType).length;
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all alerts when type filter is undefined', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          (alerts) => {
            const filtered = filterAlertsByType(alerts, undefined);
            return filtered.length === alerts.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Alert Filtering by Resolved Status', () => {
    it('should return only unresolved alerts when filtering for unresolved', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          (alerts) => {
            const filtered = filterAlertsByResolved(alerts, false);
            return filtered.every(alert => alert.is_resolved === false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only resolved alerts when filtering for resolved', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          (alerts) => {
            const filtered = filterAlertsByResolved(alerts, true);
            return filtered.every(alert => alert.is_resolved === true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Property-Based Tests
// **Feature: audit-log, Property 9: Alert Severity Assignment**
// **Validates: Requirements 7.4**
// ============================================================================

describe('Property 9: Alert Severity Assignment', () => {
  describe('Severity Determination', () => {
    it('should always return a valid severity level', () => {
      fc.assert(
        fc.property(
          alertTypeArb,
          fc.dictionary(fc.string(), fc.integer({ min: 0, max: 100 })),
          (alertType, metadata) => {
            const severity = determineSeverity(alertType, metadata);
            const validSeverities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
            return validSeverities.includes(severity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign higher severity for higher failed login attempt counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          (count1, count2) => {
            const severity1 = determineSeverity('failed_login', { attempt_count: count1 });
            const severity2 = determineSeverity('failed_login', { attempt_count: count2 });
            
            const severityOrder: Record<AlertSeverity, number> = {
              'low': 0,
              'medium': 1,
              'high': 2,
              'critical': 3,
            };
            
            // If count1 < count2, severity1 should be <= severity2
            if (count1 < count2) {
              return severityOrder[severity1] <= severityOrder[severity2];
            }
            // If count1 > count2, severity1 should be >= severity2
            if (count1 > count2) {
              return severityOrder[severity1] >= severityOrder[severity2];
            }
            // If equal, severities should be equal
            return severity1 === severity2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign higher severity for higher bulk delete counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (count1, count2) => {
            const severity1 = determineSeverity('bulk_delete', { delete_count: count1 });
            const severity2 = determineSeverity('bulk_delete', { delete_count: count2 });
            
            const severityOrder: Record<AlertSeverity, number> = {
              'low': 0,
              'medium': 1,
              'high': 2,
              'critical': 3,
            };
            
            if (count1 < count2) {
              return severityOrder[severity1] <= severityOrder[severity2];
            }
            if (count1 > count2) {
              return severityOrder[severity1] >= severityOrder[severity2];
            }
            return severity1 === severity2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should assign consistent severity for same alert type and metadata', () => {
      fc.assert(
        fc.property(
          alertTypeArb,
          fc.integer({ min: 0, max: 100 }),
          (alertType, count) => {
            const metadata = alertType === 'failed_login' 
              ? { attempt_count: count }
              : { delete_count: count };
            
            const severity1 = determineSeverity(alertType, metadata);
            const severity2 = determineSeverity(alertType, metadata);
            
            return severity1 === severity2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Severity Filtering', () => {
    it('should return only alerts of the specified severity', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          severityArb,
          (alerts, severity) => {
            const filtered = filterAlertsBySeverity(alerts, severity);
            return filtered.every(alert => alert.severity === severity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any alerts of the specified severity', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          severityArb,
          (alerts, severity) => {
            const filtered = filterAlertsBySeverity(alerts, severity);
            const expectedCount = alerts.filter(a => a.severity === severity).length;
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all alerts when severity filter is undefined', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          (alerts) => {
            const filtered = filterAlertsBySeverity(alerts, undefined);
            return filtered.length === alerts.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Alert Filters', () => {
    it('should correctly apply multiple filters together', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          fc.record({
            alert_type: fc.option(alertTypeArb, { nil: undefined }),
            severity: fc.option(severityArb, { nil: undefined }),
            is_resolved: fc.option(fc.boolean(), { nil: undefined }),
            user_id: fc.option(uuidArb, { nil: undefined }),
          }),
          (alerts, filters) => {
            const filtered = applyAlertFilters(alerts, filters);
            
            return filtered.every(alert => {
              if (filters.alert_type && alert.alert_type !== filters.alert_type) return false;
              if (filters.severity && alert.severity !== filters.severity) return false;
              if (filters.is_resolved !== undefined && alert.is_resolved !== filters.is_resolved) return false;
              if (filters.user_id && alert.user_id !== filters.user_id) return false;
              return true;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return subset of original alerts when filters are applied', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          fc.record({
            alert_type: fc.option(alertTypeArb, { nil: undefined }),
            severity: fc.option(severityArb, { nil: undefined }),
            is_resolved: fc.option(fc.boolean(), { nil: undefined }),
          }),
          (alerts, filters) => {
            const filtered = applyAlertFilters(alerts, filters);
            return filtered.length <= alerts.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all alerts when no filters are specified', () => {
      fc.assert(
        fc.property(
          auditAlertsArb,
          (alerts) => {
            const filtered = applyAlertFilters(alerts, {});
            return filtered.length === alerts.length;
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

function createMockAlert(overrides: Partial<AuditAlert> = {}): AuditAlert {
  return {
    id: 'test-id',
    alert_type: 'failed_login',
    severity: 'medium',
    user_id: null,
    description: 'Test alert description',
    metadata: null,
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
