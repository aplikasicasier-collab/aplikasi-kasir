/**
 * Audit Retention API Tests
 * 
 * Property-based tests for audit log retention functionality.
 * **Feature: audit-log, Property 7: Retention Cleanup**
 * **Validates: Requirements 6.1, 6.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateRetentionCutoffDate,
  partitionLogsByRetention,
  isWithinRetentionPeriod,
  validateRetentionSettings,
  estimateStorageSizeMB,
  AuditLogForRetention,
} from './auditRetention';

// ============================================================================
// Generators
// ============================================================================

// Generator for UUID-like strings
const uuidArb = fc.uuid();

// Generator for retention days (1 to 3650 days = 10 years)
const retentionDaysArb = fc.integer({ min: 1, max: 3650 });

// Generator for reference dates within a reasonable range (using integer timestamps)
const referenceDateArb = fc.integer({
  min: new Date('2024-01-01').getTime(),
  max: new Date('2025-12-31').getTime(),
}).map(timestamp => new Date(timestamp));

// Generator for audit log entries with created_at timestamps (using integer timestamps)
const auditLogForRetentionArb: fc.Arbitrary<AuditLogForRetention> = fc.record({
  id: uuidArb,
  created_at: fc.integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2025-12-31').getTime(),
  }).map(timestamp => new Date(timestamp).toISOString()),
});

// Generator for array of audit logs
const auditLogsArb = fc.array(auditLogForRetentionArb, { minLength: 0, maxLength: 50 });

// ============================================================================
// Unit Tests
// ============================================================================

describe('Audit Retention API - Unit Tests', () => {
  describe('calculateRetentionCutoffDate', () => {
    it('should calculate cutoff date correctly for 90 days', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const cutoff = calculateRetentionCutoffDate(90, referenceDate);
      
      // 90 days before June 15 is March 17
      expect(cutoff.getFullYear()).toBe(2024);
      expect(cutoff.getMonth()).toBe(2); // March (0-indexed)
      expect(cutoff.getDate()).toBe(17);
    });

    it('should calculate cutoff date correctly for 30 days', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const cutoff = calculateRetentionCutoffDate(30, referenceDate);
      
      // 30 days before June 15 is May 16
      expect(cutoff.getFullYear()).toBe(2024);
      expect(cutoff.getMonth()).toBe(4); // May (0-indexed)
      expect(cutoff.getDate()).toBe(16);
    });

    it('should handle year boundary correctly', () => {
      const referenceDate = new Date('2024-01-15T12:00:00Z');
      const cutoff = calculateRetentionCutoffDate(30, referenceDate);
      
      // 30 days before Jan 15 is Dec 16 of previous year
      expect(cutoff.getFullYear()).toBe(2023);
      expect(cutoff.getMonth()).toBe(11); // December (0-indexed)
      expect(cutoff.getDate()).toBe(16);
    });
  });

  describe('partitionLogsByRetention', () => {
    it('should partition logs correctly', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      // 90 days before June 15 is March 17
      const logs: AuditLogForRetention[] = [
        { id: '1', created_at: '2024-06-01T10:00:00Z' }, // Within 90 days (14 days ago)
        { id: '2', created_at: '2024-04-01T10:00:00Z' }, // Within 90 days (75 days ago)
        { id: '3', created_at: '2024-03-01T10:00:00Z' }, // Outside 90 days (106 days ago)
        { id: '4', created_at: '2023-06-01T10:00:00Z' }, // Way outside
      ];
      
      const { toDelete, toKeep } = partitionLogsByRetention(logs, 90, referenceDate);
      
      expect(toKeep).toHaveLength(2);
      expect(toDelete).toHaveLength(2);
      expect(toKeep.map(l => l.id)).toContain('1');
      expect(toKeep.map(l => l.id)).toContain('2');
      expect(toDelete.map(l => l.id)).toContain('3');
      expect(toDelete.map(l => l.id)).toContain('4');
    });

    it('should keep all logs when retention period is very long', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const logs: AuditLogForRetention[] = [
        { id: '1', created_at: '2024-06-01T10:00:00Z' },
        { id: '2', created_at: '2020-01-01T10:00:00Z' },
      ];
      
      const { toDelete, toKeep } = partitionLogsByRetention(logs, 3650, referenceDate);
      
      expect(toKeep).toHaveLength(2);
      expect(toDelete).toHaveLength(0);
    });

    it('should delete all logs when retention period is very short', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const logs: AuditLogForRetention[] = [
        { id: '1', created_at: '2024-06-01T10:00:00Z' },
        { id: '2', created_at: '2024-05-01T10:00:00Z' },
      ];
      
      const { toDelete, toKeep } = partitionLogsByRetention(logs, 1, referenceDate);
      
      expect(toKeep).toHaveLength(0);
      expect(toDelete).toHaveLength(2);
    });
  });

  describe('isWithinRetentionPeriod', () => {
    it('should return true for recent logs', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const logDate = '2024-06-10T10:00:00Z';
      
      expect(isWithinRetentionPeriod(logDate, 90, referenceDate)).toBe(true);
    });

    it('should return false for old logs', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      const logDate = '2024-01-01T10:00:00Z';
      
      expect(isWithinRetentionPeriod(logDate, 90, referenceDate)).toBe(false);
    });

    it('should handle boundary case correctly', () => {
      const referenceDate = new Date('2024-06-15T12:00:00Z');
      // Exactly 90 days before is March 17
      const cutoffDate = calculateRetentionCutoffDate(90, referenceDate);
      
      // Log at exactly cutoff time should be kept
      expect(isWithinRetentionPeriod(cutoffDate.toISOString(), 90, referenceDate)).toBe(true);
      
      // Log 1ms before cutoff should be deleted
      const beforeCutoff = new Date(cutoffDate.getTime() - 1);
      expect(isWithinRetentionPeriod(beforeCutoff.toISOString(), 90, referenceDate)).toBe(false);
    });
  });

  describe('validateRetentionSettings', () => {
    it('should accept valid retention days', () => {
      expect(validateRetentionSettings({ retention_days: 90 })).toEqual({ isValid: true });
      expect(validateRetentionSettings({ retention_days: 1 })).toEqual({ isValid: true });
      expect(validateRetentionSettings({ retention_days: 3650 })).toEqual({ isValid: true });
    });

    it('should reject invalid retention days', () => {
      expect(validateRetentionSettings({ retention_days: 0 }).isValid).toBe(false);
      expect(validateRetentionSettings({ retention_days: -1 }).isValid).toBe(false);
      expect(validateRetentionSettings({ retention_days: 3651 }).isValid).toBe(false);
      expect(validateRetentionSettings({ retention_days: 1.5 }).isValid).toBe(false);
    });

    it('should accept empty settings', () => {
      expect(validateRetentionSettings({})).toEqual({ isValid: true });
    });
  });

  describe('estimateStorageSizeMB', () => {
    it('should calculate storage size correctly', () => {
      // 1000 logs * 2KB = 2000KB = ~1.95MB
      expect(estimateStorageSizeMB(1000)).toBeCloseTo(1.953, 2);
      
      // 0 logs = 0MB
      expect(estimateStorageSizeMB(0)).toBe(0);
      
      // 512 logs * 2KB = 1024KB = 1MB
      expect(estimateStorageSizeMB(512)).toBe(1);
    });

    it('should use custom average log size', () => {
      // 1000 logs * 4KB = 4000KB = ~3.9MB
      expect(estimateStorageSizeMB(1000, 4)).toBeCloseTo(3.906, 2);
    });
  });
});

// ============================================================================
// Property-Based Tests
// **Feature: audit-log, Property 7: Retention Cleanup**
// **Validates: Requirements 6.1, 6.2**
// ============================================================================

describe('Property 7: Retention Cleanup', () => {
  /**
   * Property: Logs older than retention_days should be marked for deletion
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Logs older than retention period should be deleted', () => {
    it('all logs in toDelete should be older than the cutoff date', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          retentionDaysArb,
          referenceDateArb,
          (logs, retentionDays, referenceDate) => {
            const cutoffDate = calculateRetentionCutoffDate(retentionDays, referenceDate);
            const cutoffTime = cutoffDate.getTime();
            
            const { toDelete } = partitionLogsByRetention(logs, retentionDays, referenceDate);
            
            // All logs marked for deletion should be older than cutoff
            return toDelete.every(log => {
              const logTime = new Date(log.created_at).getTime();
              return logTime < cutoffTime;
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Logs within retention period should remain unchanged
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Logs within retention period should be kept', () => {
    it('all logs in toKeep should be within or at the cutoff date', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          retentionDaysArb,
          referenceDateArb,
          (logs, retentionDays, referenceDate) => {
            const cutoffDate = calculateRetentionCutoffDate(retentionDays, referenceDate);
            const cutoffTime = cutoffDate.getTime();
            
            const { toKeep } = partitionLogsByRetention(logs, retentionDays, referenceDate);
            
            // All logs kept should be at or after cutoff
            return toKeep.every(log => {
              const logTime = new Date(log.created_at).getTime();
              return logTime >= cutoffTime;
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Partition should be complete (no logs lost)
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Partition completeness', () => {
    it('toDelete + toKeep should equal original logs count', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          retentionDaysArb,
          referenceDateArb,
          (logs, retentionDays, referenceDate) => {
            const { toDelete, toKeep } = partitionLogsByRetention(logs, retentionDays, referenceDate);
            
            return toDelete.length + toKeep.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all original log IDs should appear in either toDelete or toKeep', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          retentionDaysArb,
          referenceDateArb,
          (logs, retentionDays, referenceDate) => {
            const { toDelete, toKeep } = partitionLogsByRetention(logs, retentionDays, referenceDate);
            
            const allIds = new Set([...toDelete.map(l => l.id), ...toKeep.map(l => l.id)]);
            const originalIds = new Set(logs.map(l => l.id));
            
            // All original IDs should be in the result
            return logs.every(log => allIds.has(log.id)) &&
                   allIds.size === originalIds.size;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Partition should be disjoint (no duplicates)
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Partition disjointness', () => {
    it('no log should appear in both toDelete and toKeep', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          retentionDaysArb,
          referenceDateArb,
          (logs, retentionDays, referenceDate) => {
            const { toDelete, toKeep } = partitionLogsByRetention(logs, retentionDays, referenceDate);
            
            const deleteIds = new Set(toDelete.map(l => l.id));
            const keepIds = new Set(toKeep.map(l => l.id));
            
            // No overlap between delete and keep sets
            return toKeep.every(log => !deleteIds.has(log.id)) &&
                   toDelete.every(log => !keepIds.has(log.id));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: isWithinRetentionPeriod should be consistent with partitionLogsByRetention
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Consistency between functions', () => {
    it('isWithinRetentionPeriod should match partition result for each log', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          retentionDaysArb,
          referenceDateArb,
          (logs, retentionDays, referenceDate) => {
            const { toDelete, toKeep } = partitionLogsByRetention(logs, retentionDays, referenceDate);
            
            // Check that isWithinRetentionPeriod agrees with partition
            const keepConsistent = toKeep.every(log => 
              isWithinRetentionPeriod(log.created_at, retentionDays, referenceDate)
            );
            
            const deleteConsistent = toDelete.every(log => 
              !isWithinRetentionPeriod(log.created_at, retentionDays, referenceDate)
            );
            
            return keepConsistent && deleteConsistent;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Longer retention period should keep more or equal logs
   * **Validates: Requirements 6.1**
   */
  describe('Retention period monotonicity', () => {
    it('increasing retention days should keep more or equal logs', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          fc.integer({ min: 1, max: 1825 }), // First retention period
          fc.integer({ min: 1, max: 1825 }), // Second retention period
          referenceDateArb,
          (logs, days1, days2, referenceDate) => {
            const shorterDays = Math.min(days1, days2);
            const longerDays = Math.max(days1, days2);
            
            const { toKeep: keepShorter } = partitionLogsByRetention(logs, shorterDays, referenceDate);
            const { toKeep: keepLonger } = partitionLogsByRetention(logs, longerDays, referenceDate);
            
            // Longer retention should keep at least as many logs
            return keepLonger.length >= keepShorter.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Cutoff date calculation should be deterministic
   * **Validates: Requirements 6.1**
   */
  describe('Cutoff date determinism', () => {
    it('same inputs should produce same cutoff date', () => {
      fc.assert(
        fc.property(
          retentionDaysArb,
          referenceDateArb,
          (retentionDays, referenceDate) => {
            const cutoff1 = calculateRetentionCutoffDate(retentionDays, referenceDate);
            const cutoff2 = calculateRetentionCutoffDate(retentionDays, referenceDate);
            
            return cutoff1.getTime() === cutoff2.getTime();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Validation should accept all valid retention days
   * **Validates: Requirements 6.1**
   */
  describe('Settings validation', () => {
    it('should accept all valid retention days (1-3650)', () => {
      fc.assert(
        fc.property(
          retentionDaysArb,
          (retentionDays) => {
            const result = validateRetentionSettings({ retention_days: retentionDays });
            return result.isValid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject retention days outside valid range', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000, max: 0 }),
            fc.integer({ min: 3651, max: 10000 })
          ),
          (invalidDays) => {
            const result = validateRetentionSettings({ retention_days: invalidDays });
            return result.isValid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Storage estimation should be non-negative and proportional
   * **Validates: Requirements 6.4**
   */
  describe('Storage estimation', () => {
    it('should return non-negative values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 1, max: 100 }),
          (logCount, avgSize) => {
            const size = estimateStorageSizeMB(logCount, avgSize);
            return size >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be proportional to log count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (logCount, avgSize) => {
            const size1 = estimateStorageSizeMB(logCount, avgSize);
            const size2 = estimateStorageSizeMB(logCount * 2, avgSize);
            
            // Double the logs should double the size
            return Math.abs(size2 - size1 * 2) < 0.001;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
