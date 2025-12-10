/**
 * Audit Export API Tests
 * 
 * Property-based tests for audit log export functionality.
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateExportFilename,
  escapeCSVValue,
  convertToCSV,
  convertToJSON,
  exportAuditLogsToFormat,
  verifyExportMatchesFilters,
  verifyExportIncludesColumns,
  verifyFilenameHasTimestamp,
  parseAuditCSV,
  DEFAULT_AUDIT_COLUMNS,
  ExportFormat,
  AuditExportOptions,
} from './auditExport';
import { AuditLog, AuditLogFilters } from './auditLogs';
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

// Generator for export format
const exportFormatArb = fc.constantFrom<ExportFormat>('csv', 'json');

// Generator for column selection (subset of default columns)
const columnsArb = fc.subarray(DEFAULT_AUDIT_COLUMNS, { minLength: 1 });

// Generator for Date objects
const timestampArb = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2025-12-31'),
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('Audit Export API - Unit Tests', () => {
  describe('generateExportFilename', () => {
    it('should generate filename with csv extension', () => {
      const filename = generateExportFilename('csv');
      expect(filename).toMatch(/^audit-logs_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
    });

    it('should generate filename with json extension', () => {
      const filename = generateExportFilename('json');
      expect(filename).toMatch(/^audit-logs_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    });

    it('should use provided timestamp', () => {
      // Use a specific date and verify the filename contains the local time components
      const timestamp = new Date(2024, 5, 15, 14, 30, 45); // June 15, 2024 14:30:45 local time
      const filename = generateExportFilename('csv', timestamp);
      expect(filename).toBe('audit-logs_2024-06-15_14-30-45.csv');
    });
  });

  describe('escapeCSVValue', () => {
    it('should return empty string for null', () => {
      expect(escapeCSVValue(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(escapeCSVValue(undefined)).toBe('');
    });

    it('should escape values with commas', () => {
      expect(escapeCSVValue('hello, world')).toBe('"hello, world"');
    });

    it('should escape values with quotes', () => {
      expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
    });

    it('should escape values with newlines', () => {
      expect(escapeCSVValue('line1\nline2')).toBe('"line1\nline2"');
    });

    it('should convert objects to JSON', () => {
      const result = escapeCSVValue({ key: 'value' });
      expect(result).toBe('"{""key"":""value""}"');
    });
  });

  describe('convertToCSV', () => {
    it('should return empty string for empty columns', () => {
      const logs = [createMockLog()];
      expect(convertToCSV(logs, [])).toBe('');
    });

    it('should create header row', () => {
      const logs: AuditLog[] = [];
      const csv = convertToCSV(logs, ['id', 'event_type']);
      expect(csv).toBe('id,event_type');
    });

    it('should include data rows', () => {
      const logs = [
        createMockLog({ id: 'log-1', event_type: 'create' }),
        createMockLog({ id: 'log-2', event_type: 'update' }),
      ];
      const csv = convertToCSV(logs, ['id', 'event_type']);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('id,event_type');
      expect(lines[1]).toBe('log-1,create');
      expect(lines[2]).toBe('log-2,update');
    });
  });

  describe('convertToJSON', () => {
    it('should return all data when no columns specified', () => {
      const logs = [createMockLog({ id: 'log-1' })];
      const json = convertToJSON(logs, []);
      const parsed = JSON.parse(json);
      expect(parsed[0].id).toBe('log-1');
    });

    it('should filter to specified columns', () => {
      const logs = [createMockLog({ id: 'log-1', event_type: 'create', entity_type: 'product' })];
      const json = convertToJSON(logs, ['id', 'event_type']);
      const parsed = JSON.parse(json);
      expect(Object.keys(parsed[0])).toEqual(['id', 'event_type']);
    });
  });

  describe('verifyFilenameHasTimestamp', () => {
    it('should return true for valid CSV filename', () => {
      expect(verifyFilenameHasTimestamp('audit-logs_2024-06-15_14-30-45.csv')).toBe(true);
    });

    it('should return true for valid JSON filename', () => {
      expect(verifyFilenameHasTimestamp('audit-logs_2024-06-15_14-30-45.json')).toBe(true);
    });

    it('should return false for invalid filename', () => {
      expect(verifyFilenameHasTimestamp('audit-logs.csv')).toBe(false);
      expect(verifyFilenameHasTimestamp('audit-logs_2024-06-15.csv')).toBe(false);
    });
  });
});


// ============================================================================
// Property-Based Tests
// **Feature: audit-log, Property 6: Export Content Accuracy**
// **Validates: Requirements 5.1, 5.2, 5.3**
// ============================================================================

describe('Property 6: Export Content Accuracy', () => {
  // **Validates: Requirements 5.3**
  describe('Filename Timestamp', () => {
    it('should always generate filename with valid timestamp pattern', () => {
      fc.assert(
        fc.property(
          exportFormatArb,
          timestampArb,
          (format, timestamp) => {
            const filename = generateExportFilename(format, timestamp);
            return verifyFilenameHasTimestamp(filename);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include correct format extension in filename', () => {
      fc.assert(
        fc.property(
          exportFormatArb,
          timestampArb,
          (format, timestamp) => {
            const filename = generateExportFilename(format, timestamp);
            return filename.endsWith(`.${format}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should encode timestamp correctly in filename', () => {
      fc.assert(
        fc.property(
          exportFormatArb,
          timestampArb,
          (format, timestamp) => {
            const filename = generateExportFilename(format, timestamp);
            
            // Extract date parts from filename
            const match = filename.match(/audit-logs_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
            if (!match) return false;
            
            const [, year, month, day, hours, minutes, seconds] = match;
            
            // Verify against timestamp
            return (
              parseInt(year) === timestamp.getFullYear() &&
              parseInt(month) === timestamp.getMonth() + 1 &&
              parseInt(day) === timestamp.getDate() &&
              parseInt(hours) === timestamp.getHours() &&
              parseInt(minutes) === timestamp.getMinutes() &&
              parseInt(seconds) === timestamp.getSeconds()
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 5.2**
  describe('Export Includes Specified Columns', () => {
    it('should include all specified columns in CSV export', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.length > 0),
          columnsArb,
          (logs, columns) => {
            const csv = convertToCSV(logs, columns);
            return verifyExportIncludesColumns(csv, 'csv', columns);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all specified columns in JSON export', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.length > 0),
          columnsArb,
          (logs, columns) => {
            const json = convertToJSON(logs, columns);
            const parsed = JSON.parse(json);
            // Each object should have exactly the specified columns
            return parsed.every((obj: Record<string, unknown>) => {
              const keys = Object.keys(obj);
              return keys.length === columns.length && 
                     columns.every(col => keys.includes(col));
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have same number of columns in CSV header as specified', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          columnsArb,
          (logs, columns) => {
            const csv = convertToCSV(logs, columns);
            if (csv === '') return columns.length === 0;
            
            const headerRow = csv.split('\n')[0];
            const headerColumns = headerRow.split(',').length;
            return headerColumns === columns.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 5.1, 5.2**
  describe('Export Content Matches Filters', () => {
    it('should export only logs matching applied filters', () => {
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
          columnsArb,
          (logs, filters, columns) => {
            const options: AuditExportOptions = {
              format: 'json',
              filters,
              columns,
            };
            
            const result = exportAuditLogsToFormat(logs, options);
            
            // Parse the exported JSON
            const exportedLogs = JSON.parse(result.content) as AuditLog[];
            
            // Verify exported logs match filters
            return verifyExportMatchesFilters(logs, exportedLogs, filters);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should export all logs when no filters applied', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          columnsArb,
          (logs, columns) => {
            const options: AuditExportOptions = {
              format: 'json',
              filters: {},
              columns,
            };
            
            const result = exportAuditLogsToFormat(logs, options);
            const exportedLogs = JSON.parse(result.content) as AuditLog[];
            
            return exportedLogs.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 5.1**
  describe('CSV Format Correctness', () => {
    it('should have same number of data rows as filtered logs', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          columnsArb,
          (logs, columns) => {
            const options: AuditExportOptions = {
              format: 'csv',
              filters: {},
              columns,
            };
            
            const result = exportAuditLogsToFormat(logs, options);
            
            // Handle empty columns case
            if (columns.length === 0) {
              return result.content === '';
            }
            
            // Split by newline - don't filter empty lines since a row with all null values
            // will be empty but still valid
            const lines = result.content.split('\n');
            
            // Should have header + data rows (no trailing newline in our CSV format)
            const expectedLines = logs.length + 1; // +1 for header
            return lines.length === expectedLines;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce parseable CSV that round-trips column names', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.length > 0),
          columnsArb,
          (logs, columns) => {
            const csv = convertToCSV(logs, columns);
            const parsed = parseAuditCSV(csv);
            
            // Verify columns match
            return (
              parsed.columns.length === columns.length &&
              columns.every((col, i) => parsed.columns[i] === col)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce CSV with correct number of values per row', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.length > 0),
          columnsArb,
          (logs, columns) => {
            const csv = convertToCSV(logs, columns);
            const parsed = parseAuditCSV(csv);
            
            // Each data row should have same number of values as columns
            return parsed.data.every(row => 
              Object.keys(row).length === columns.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 5.1**
  describe('JSON Format Correctness', () => {
    it('should produce valid parseable JSON', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          columnsArb,
          (logs, columns) => {
            const json = convertToJSON(logs, columns);
            
            try {
              const parsed = JSON.parse(json);
              return Array.isArray(parsed);
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have same number of records as filtered logs', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          columnsArb,
          (logs, columns) => {
            const options: AuditExportOptions = {
              format: 'json',
              filters: {},
              columns,
            };
            
            const result = exportAuditLogsToFormat(logs, options);
            const parsed = JSON.parse(result.content);
            
            return parsed.length === logs.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only include specified columns in JSON objects', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.length > 0),
          columnsArb,
          (logs, columns) => {
            const json = convertToJSON(logs, columns);
            const parsed = JSON.parse(json);
            
            // Each object should have exactly the specified columns
            // (undefined values are converted to null, so all columns appear)
            return parsed.every((obj: Record<string, unknown>) => {
              const keys = Object.keys(obj);
              return (
                keys.length === columns.length &&
                keys.every(key => columns.includes(key)) &&
                columns.every(col => keys.includes(col))
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Validates: Requirements 5.1, 5.2, 5.3**
  describe('Export Result Structure', () => {
    it('should return correct mime type for format', () => {
      fc.assert(
        fc.property(
          auditLogsArb,
          exportFormatArb,
          (logs, format) => {
            const options: AuditExportOptions = {
              format,
              filters: {},
              columns: DEFAULT_AUDIT_COLUMNS,
            };
            
            const result = exportAuditLogsToFormat(logs, options);
            
            if (format === 'csv') {
              return result.mimeType === 'text/csv;charset=utf-8;';
            } else {
              return result.mimeType === 'application/json;charset=utf-8;';
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty content for non-empty logs', () => {
      fc.assert(
        fc.property(
          auditLogsArb.filter(logs => logs.length > 0),
          exportFormatArb,
          columnsArb,
          (logs, format, columns) => {
            const options: AuditExportOptions = {
              format,
              filters: {},
              columns,
            };
            
            const result = exportAuditLogsToFormat(logs, options);
            return result.content.length > 0;
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
