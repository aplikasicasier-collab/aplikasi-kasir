import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateCSV,
  parseCSV,
  escapeCSVValue,
  generateFilename,
  ReportType,
} from './export';

/**
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.1, 5.2, 5.4**
 * 
 * For any report export, the generated CSV should be valid CSV format, 
 * contain all columns from the report, contain all rows from the report data, 
 * AND the filename should include the report type and date range.
 */
describe('CSV Export Completeness', () => {
  // Arbitrary for generating safe column names (no special chars for simplicity)
  const columnNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/)
    .filter(s => s.length > 0);

  // Arbitrary for generating cell values (strings, numbers, etc.)
  const cellValueArb = fc.oneof(
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.integer({ min: -1000000, max: 1000000 }),
    fc.float({ min: -10000, max: 10000, noNaN: true }),
    fc.boolean(),
    fc.constant(null),
    fc.constant(undefined)
  );

  // Arbitrary for generating a data row with given columns
  const dataRowArb = (columns: string[]) => {
    if (columns.length === 0) {
      return fc.constant({} as Record<string, unknown>);
    }
    return fc.tuple(...columns.map(() => cellValueArb))
      .map(values => {
        const row: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      });
  };

  it('Property 6.1: Generated CSV contains all columns in header row', () => {
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 10 })
          .map(cols => [...new Set(cols)]) // Ensure unique columns
          .filter(cols => cols.length > 0),
        fc.integer({ min: 0, max: 20 }),
        (columns, rowCount) => {
          // Generate data rows
          const data: Record<string, unknown>[] = [];
          for (let i = 0; i < rowCount; i++) {
            const row: Record<string, unknown> = {};
            columns.forEach(col => {
              row[col] = `value_${i}_${col}`;
            });
            data.push(row);
          }

          const csv = generateCSV(data, columns);
          const parsed = parseCSV(csv);

          // All columns should be present in the parsed result
          return columns.every(col => parsed.columns.includes(col)) &&
                 parsed.columns.length === columns.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.2: Generated CSV contains all data rows', () => {
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 5 })
          .map(cols => [...new Set(cols)])
          .filter(cols => cols.length > 0),
        fc.integer({ min: 0, max: 30 }),
        (columns, rowCount) => {
          // Generate data rows with simple string values
          const data: Record<string, unknown>[] = [];
          for (let i = 0; i < rowCount; i++) {
            const row: Record<string, unknown> = {};
            columns.forEach(col => {
              row[col] = `row${i}_${col}`;
            });
            data.push(row);
          }

          const csv = generateCSV(data, columns);
          const parsed = parseCSV(csv);

          // Number of data rows should match
          return parsed.data.length === rowCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.3: CSV round-trip preserves string data', () => {
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 5 })
          .map(cols => [...new Set(cols)])
          .filter(cols => cols.length > 0),
        fc.integer({ min: 1, max: 10 }),
        fc.string({ minLength: 1, maxLength: 30 })
          .filter(s => !s.includes('\r')), // Exclude carriage returns for simplicity
        (columns, rowCount, baseValue) => {
          // Generate data rows with non-empty values
          const data: Record<string, unknown>[] = [];
          for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
            const row: Record<string, unknown> = {};
            columns.forEach((col, colIdx) => {
              row[col] = `${baseValue}_r${rowIdx}_c${colIdx}`;
            });
            data.push(row);
          }

          const csv = generateCSV(data, columns);
          const parsed = parseCSV(csv);

          // Verify row count matches
          if (parsed.data.length !== data.length) {
            return false;
          }

          // Verify each cell value matches (as string)
          for (let i = 0; i < data.length; i++) {
            for (const col of columns) {
              const original = String(data[i][col] ?? '');
              const parsedValue = parsed.data[i][col] ?? '';
              if (original !== parsedValue) {
                return false;
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.4: Empty data produces CSV with only header row', () => {
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 10 })
          .map(cols => [...new Set(cols)])
          .filter(cols => cols.length > 0),
        (columns) => {
          const csv = generateCSV([], columns);
          const parsed = parseCSV(csv);

          return parsed.columns.length === columns.length &&
                 parsed.data.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.5: Empty columns produces empty CSV', () => {
    const csv = generateCSV([{ a: 1, b: 2 }], []);
    expect(csv).toBe('');
  });

  it('Property 6.6: Values with commas are properly escaped', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (before, after) => {
          const valueWithComma = `${before},${after}`;
          const data = [{ col1: valueWithComma }];
          const columns = ['col1'];

          const csv = generateCSV(data, columns);
          const parsed = parseCSV(csv);

          return parsed.data[0]['col1'] === valueWithComma;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.7: Values with quotes are properly escaped', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (before, after) => {
          const valueWithQuote = `${before}"${after}`;
          const data = [{ col1: valueWithQuote }];
          const columns = ['col1'];

          const csv = generateCSV(data, columns);
          const parsed = parseCSV(csv);

          return parsed.data[0]['col1'] === valueWithQuote;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.8: Values with newlines are properly escaped', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
        fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
        (before, after) => {
          const valueWithNewline = `${before}\n${after}`;
          const data = [{ col1: valueWithNewline }];
          const columns = ['col1'];

          const csv = generateCSV(data, columns);
          const parsed = parseCSV(csv);

          return parsed.data[0]['col1'] === valueWithNewline;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Tests for filename generation
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.4**
 */
describe('Filename Generation', () => {
  const reportTypeArb = fc.constantFrom<ReportType>('sales', 'stock', 'movements', 'dashboard');

  // Arbitrary for valid ISO date strings
  const dateArb = fc.integer({ min: 1704067200000, max: 1735689600000 })
    .map(ts => new Date(ts).toISOString());

  it('Property 6.9: Filename includes report type', () => {
    fc.assert(
      fc.property(
        reportTypeArb,
        (reportType) => {
          const filename = generateFilename(reportType);
          
          const expectedTypeNames: Record<ReportType, string> = {
            sales: 'laporan-penjualan',
            stock: 'laporan-stok',
            movements: 'laporan-pergerakan-stok',
            dashboard: 'laporan-dashboard',
          };
          
          return filename.includes(expectedTypeNames[reportType]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.10: Filename includes date range when provided', () => {
    fc.assert(
      fc.property(
        reportTypeArb,
        dateArb,
        dateArb,
        (reportType, startDate, endDate) => {
          const filename = generateFilename(reportType, { startDate, endDate });
          
          // Extract dates from the date strings
          const startD = new Date(startDate);
          const endD = new Date(endDate);
          
          const startFormatted = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
          const endFormatted = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
          
          return filename.includes(startFormatted) && filename.includes(endFormatted);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.11: Filename ends with .csv extension', () => {
    fc.assert(
      fc.property(
        reportTypeArb,
        fc.option(
          fc.record({
            startDate: dateArb,
            endDate: dateArb,
          }),
          { nil: undefined }
        ),
        (reportType, dateRange) => {
          const filename = generateFilename(reportType, dateRange);
          return filename.endsWith('.csv');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.12: Filename without date range uses current date', () => {
    const filename = generateFilename('sales');
    
    // Should contain today's date
    const today = new Date();
    const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    expect(filename).toContain(todayFormatted);
    expect(filename).toContain('laporan-penjualan');
    expect(filename.endsWith('.csv')).toBe(true);
  });
});

/**
 * Unit tests for escapeCSVValue
 */
describe('escapeCSVValue', () => {
  it('returns empty string for null', () => {
    expect(escapeCSVValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCSVValue(undefined)).toBe('');
  });

  it('converts numbers to string', () => {
    expect(escapeCSVValue(123)).toBe('123');
    expect(escapeCSVValue(45.67)).toBe('45.67');
  });

  it('converts booleans to string', () => {
    expect(escapeCSVValue(true)).toBe('true');
    expect(escapeCSVValue(false)).toBe('false');
  });

  it('returns simple strings unchanged', () => {
    expect(escapeCSVValue('hello')).toBe('hello');
    expect(escapeCSVValue('world')).toBe('world');
  });

  it('wraps strings with commas in quotes', () => {
    expect(escapeCSVValue('hello,world')).toBe('"hello,world"');
  });

  it('wraps strings with quotes and escapes internal quotes', () => {
    expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps strings with newlines in quotes', () => {
    expect(escapeCSVValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles complex strings with multiple special characters', () => {
    expect(escapeCSVValue('a,b"c\nd')).toBe('"a,b""c\nd"');
  });
});
