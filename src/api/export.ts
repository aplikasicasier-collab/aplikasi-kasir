/**
 * Export API for generating and downloading CSV reports
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

export type ReportType = 'sales' | 'stock' | 'movements' | 'dashboard' | 'discount' | 'return';

export interface ExportOptions {
  reportType: ReportType;
  data: Record<string, unknown>[];
  columns: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
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
 * Generate CSV string from data array
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * @param data - Array of objects to convert to CSV
 * @param columns - Array of column keys to include in the CSV
 * @returns CSV formatted string with header row and data rows
 */
export function generateCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (columns.length === 0) {
    return '';
  }
  
  // Create header row
  const headerRow = columns.map(col => escapeCSVValue(col)).join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return columns.map(col => escapeCSVValue(row[col])).join(',');
  });
  
  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger browser download of CSV content
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.3**
 * 
 * @param content - CSV string content to download
 * @param filename - Name of the file to download
 */
export function downloadCSV(content: string, filename: string): void {
  // Create blob with UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  
  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
export function formatDateForFilename(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate filename for report export
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.4**
 * 
 * @param reportType - Type of report being exported
 * @param dateRange - Optional date range for the report
 * @returns Formatted filename with report type and date range
 */
export function generateFilename(
  reportType: ReportType,
  dateRange?: { startDate: string; endDate: string }
): string {
  const reportTypeNames: Record<ReportType, string> = {
    sales: 'laporan-penjualan',
    stock: 'laporan-stok',
    movements: 'laporan-pergerakan-stok',
    dashboard: 'laporan-dashboard',
    discount: 'laporan-diskon',
    return: 'laporan-retur',
  };
  
  const baseName = reportTypeNames[reportType];
  
  if (dateRange) {
    const startFormatted = formatDateForFilename(dateRange.startDate);
    const endFormatted = formatDateForFilename(dateRange.endDate);
    return `${baseName}_${startFormatted}_${endFormatted}.csv`;
  }
  
  // Use current date if no range specified
  const today = formatDateForFilename(new Date().toISOString());
  return `${baseName}_${today}.csv`;
}

/**
 * Export report data to CSV file
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 * 
 * @param options - Export options including report type, data, columns, and date range
 */
export function exportReport(options: ExportOptions): void {
  const { reportType, data, columns, dateRange } = options;
  
  // Generate CSV content
  const csvContent = generateCSV(data, columns);
  
  // Generate filename
  const filename = generateFilename(reportType, dateRange);
  
  // Trigger download
  downloadCSV(csvContent, filename);
}

/**
 * Parse CSV string back to data array (for testing round-trip)
 * **Feature: laporan, Property 6: CSV Export Completeness**
 * 
 * @param csv - CSV string to parse
 * @returns Object with columns array and data array
 */
export function parseCSV(csv: string): { columns: string[]; data: Record<string, string>[] } {
  if (!csv || csv.trim() === '') {
    return { columns: [], data: [] };
  }
  
  // Parse all rows handling quoted values with embedded newlines
  const rows = parseCSVRows(csv);
  
  if (rows.length === 0) {
    return { columns: [], data: [] };
  }
  
  // First row is header
  const columns = rows[0];
  
  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row: Record<string, string> = {};
    
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = values[j] || '';
    }
    
    data.push(row);
  }
  
  return { columns, data };
}

/**
 * Parse CSV string into array of rows, handling quoted values with embedded newlines
 */
function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < csv.length) {
    const char = csv[i];
    
    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          currentValue += '"';
          i += 2;
          continue;
        } else {
          // End of quoted value
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentValue += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentValue);
        currentValue = '';
        i++;
      } else if (char === '\n') {
        currentRow.push(currentValue);
        rows.push(currentRow);
        currentRow = [];
        currentValue = '';
        i++;
      } else if (char === '\r') {
        // Skip carriage return
        i++;
      } else {
        currentValue += char;
        i++;
      }
    }
  }
  
  // Add last value and row if not empty
  if (currentValue !== '' || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }
  
  return rows;
}


