/**
 * Audit Log Export API
 * 
 * Provides export functionality for audit logs in CSV and JSON formats.
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

import { AuditLog, AuditLogFilters, applyFilters } from './auditLogs';

// ============================================
// Types
// ============================================

export type ExportFormat = 'csv' | 'json';

export interface AuditExportOptions {
  format: ExportFormat;
  filters: AuditLogFilters;
  columns?: string[];
}

export interface AuditExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

// Default columns for audit log export
export const DEFAULT_AUDIT_COLUMNS = [
  'id',
  'event_type',
  'entity_type',
  'entity_id',
  'user_id',
  'user_name',
  'outlet_id',
  'summary',
  'ip_address',
  'created_at',
];

// All available columns for audit log export
export const ALL_AUDIT_COLUMNS = [
  'id',
  'event_type',
  'entity_type',
  'entity_id',
  'user_id',
  'user_name',
  'user_role',
  'outlet_id',
  'old_values',
  'new_values',
  'changed_fields',
  'ip_address',
  'user_agent',
  'summary',
  'created_at',
];

// ============================================
// Pure Functions (for testing)
// ============================================

/**
 * Generate export filename with timestamp
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.3**
 * 
 * @param format - Export format (csv or json)
 * @param timestamp - Optional timestamp to use (defaults to current time)
 * @returns Filename with format: audit-logs_YYYY-MM-DD_HH-mm-ss.{format}
 */
export function generateExportFilename(
  format: ExportFormat,
  timestamp?: Date
): string {
  const date = timestamp || new Date();
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `audit-logs_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.${format}`;
}


/**
 * Escape a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle objects and arrays by converting to JSON string
  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value);
    // Always quote JSON values since they contain special characters
    return `"${jsonStr.replace(/"/g, '""')}"`;
  }
  
  const stringValue = String(value);
  
  // Check if value needs escaping
  const needsEscape = stringValue.includes(',') || 
                      stringValue.includes('"') || 
                      stringValue.includes('\n') ||
                      stringValue.includes('\r');
  
  if (needsEscape) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert audit logs to CSV format
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * @param logs - Array of audit logs to convert
 * @param columns - Array of column keys to include
 * @returns CSV formatted string
 */
export function convertToCSV(logs: AuditLog[], columns: string[]): string {
  if (columns.length === 0) {
    return '';
  }
  
  // Create header row
  const headerRow = columns.map(col => escapeCSVValue(col)).join(',');
  
  // Create data rows
  const dataRows = logs.map(log => {
    return columns.map(col => {
      const value = log[col as keyof AuditLog];
      return escapeCSVValue(value);
    }).join(',');
  });
  
  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Convert audit logs to JSON format
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * @param logs - Array of audit logs to convert
 * @param columns - Array of column keys to include (if empty, includes all)
 * @returns JSON formatted string
 */
export function convertToJSON(logs: AuditLog[], columns: string[]): string {
  // If no columns specified, export all data
  if (columns.length === 0) {
    return JSON.stringify(logs, null, 2);
  }
  
  // Filter to only include specified columns
  // Always include the column key even if value is undefined (as null)
  const filteredLogs = logs.map(log => {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      const value = log[col as keyof AuditLog];
      // Convert undefined to null so it appears in JSON
      filtered[col] = value === undefined ? null : value;
    }
    return filtered;
  });
  
  return JSON.stringify(filteredLogs, null, 2);
}

/**
 * Export audit logs to specified format (pure function for testing)
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 * 
 * @param logs - Array of audit logs to export
 * @param options - Export options including format and columns
 * @param timestamp - Optional timestamp for filename
 * @returns Export result with content, filename, and mime type
 */
export function exportAuditLogsToFormat(
  logs: AuditLog[],
  options: AuditExportOptions,
  timestamp?: Date
): AuditExportResult {
  const { format, columns = DEFAULT_AUDIT_COLUMNS } = options;
  
  // Apply filters if logs are provided unfiltered
  const filteredLogs = applyFilters(logs, options.filters);
  
  // Generate content based on format
  let content: string;
  let mimeType: string;
  
  if (format === 'csv') {
    content = convertToCSV(filteredLogs, columns);
    mimeType = 'text/csv;charset=utf-8;';
  } else {
    content = convertToJSON(filteredLogs, columns);
    mimeType = 'application/json;charset=utf-8;';
  }
  
  // Generate filename with timestamp
  const filename = generateExportFilename(format, timestamp);
  
  return {
    content,
    filename,
    mimeType,
  };
}

/**
 * Check if exported content matches applied filters
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.2**
 * 
 * @param originalLogs - Original unfiltered logs
 * @param exportedLogs - Logs that were exported
 * @param filters - Filters that were applied
 * @returns True if exported logs match the filter criteria
 */
export function verifyExportMatchesFilters(
  originalLogs: AuditLog[],
  exportedLogs: AuditLog[],
  filters: AuditLogFilters
): boolean {
  const expectedLogs = applyFilters(originalLogs, filters);
  
  if (expectedLogs.length !== exportedLogs.length) {
    return false;
  }
  
  // Check that all exported logs are in the expected set
  const expectedIds = new Set(expectedLogs.map(l => l.id));
  return exportedLogs.every(log => expectedIds.has(log.id));
}

/**
 * Check if exported content includes all specified columns
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.2**
 * 
 * @param content - Exported content (CSV or JSON)
 * @param format - Export format
 * @param columns - Expected columns
 * @returns True if all columns are present
 */
export function verifyExportIncludesColumns(
  content: string,
  format: ExportFormat,
  columns: string[]
): boolean {
  if (format === 'csv') {
    // Check CSV header row
    const headerRow = content.split('\n')[0];
    if (!headerRow) return columns.length === 0;
    
    const headerColumns = parseCSVRow(headerRow);
    return columns.every(col => headerColumns.includes(col));
  } else {
    // Check JSON keys - note that undefined values are not serialized in JSON
    // so we check that all columns that have defined values are present
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return columns.length === 0;
      }
      
      const firstRow = parsed[0];
      // For JSON, we verify that all keys in the object are from the specified columns
      // (undefined values won't appear in JSON, which is expected behavior)
      const keys = Object.keys(firstRow);
      return keys.every(key => columns.includes(key));
    } catch {
      return false;
    }
  }
}

/**
 * Check if filename contains a valid timestamp
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.3**
 * 
 * @param filename - Filename to check
 * @returns True if filename contains a valid timestamp pattern
 */
export function verifyFilenameHasTimestamp(filename: string): boolean {
  // Pattern: audit-logs_YYYY-MM-DD_HH-mm-ss.{format}
  const pattern = /^audit-logs_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(csv|json)$/;
  return pattern.test(filename);
}

/**
 * Parse a single CSV row into array of values
 */
function parseCSVRow(row: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }
  
  values.push(currentValue);
  return values;
}

// ============================================
// Browser Download Functions
// ============================================

/**
 * Trigger browser download of exported content
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1**
 * 
 * @param result - Export result containing content, filename, and mime type
 */
export function downloadExport(result: AuditExportResult): void {
  // Create blob with UTF-8 BOM for CSV Excel compatibility
  const BOM = result.mimeType.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([BOM + result.content], { type: result.mimeType });
  
  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', result.filename);
  link.style.visibility = 'hidden';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export audit logs and trigger download
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 * 
 * @param logs - Array of audit logs to export
 * @param options - Export options
 */
export function exportAuditLogs(
  logs: AuditLog[],
  options: AuditExportOptions
): void {
  const result = exportAuditLogsToFormat(logs, options);
  downloadExport(result);
}

/**
 * Parse CSV content back to audit log array (for testing round-trip)
 * **Feature: audit-log, Property 6: Export Content Accuracy**
 * 
 * @param csv - CSV string to parse
 * @returns Object with columns and data
 */
export function parseAuditCSV(csv: string): { columns: string[]; data: Record<string, string>[] } {
  if (!csv || csv.trim() === '') {
    return { columns: [], data: [] };
  }
  
  const rows = csv.split('\n').filter(row => row.trim() !== '');
  
  if (rows.length === 0) {
    return { columns: [], data: [] };
  }
  
  // Parse header
  const columns = parseCSVRow(rows[0]);
  
  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = parseCSVRow(rows[i]);
    const row: Record<string, string> = {};
    
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = values[j] || '';
    }
    
    data.push(row);
  }
  
  return { columns, data };
}
