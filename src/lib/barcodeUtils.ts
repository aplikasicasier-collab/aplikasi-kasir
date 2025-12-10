/**
 * Barcode Utilities
 * Provides barcode format detection, validation, and generation functions
 * Supports EAN-13, EAN-8, UPC-A, Code 128, and internal barcodes
 */

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPCA' | 'CODE128' | 'INTERNAL';

export interface BarcodeValidation {
  isValid: boolean;
  format: BarcodeFormat | null;
  error?: string;
}

/**
 * Calculate check digit for EAN-13 barcode
 * Uses modulo 10 algorithm with alternating weights of 1 and 3
 */
export function calculateEAN13CheckDigit(barcode: string): string {
  if (barcode.length !== 12 || !/^\d{12}$/.test(barcode)) {
    throw new Error('EAN-13 check digit calculation requires exactly 12 digits');
  }
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Calculate check digit for EAN-8 barcode
 * Uses modulo 10 algorithm with alternating weights of 3 and 1
 */
export function calculateEAN8CheckDigit(barcode: string): string {
  if (barcode.length !== 7 || !/^\d{7}$/.test(barcode)) {
    throw new Error('EAN-8 check digit calculation requires exactly 7 digits');
  }
  
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(barcode[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Calculate check digit for UPC-A barcode
 * Uses modulo 10 algorithm with alternating weights of 3 and 1
 */
export function calculateUPCACheckDigit(barcode: string): string {
  if (barcode.length !== 11 || !/^\d{11}$/.test(barcode)) {
    throw new Error('UPC-A check digit calculation requires exactly 11 digits');
  }
  
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(barcode[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}


/**
 * Calculate check digit based on barcode format
 */
export function calculateCheckDigit(barcode: string, format: 'EAN13' | 'EAN8' | 'UPCA'): string {
  switch (format) {
    case 'EAN13':
      return calculateEAN13CheckDigit(barcode);
    case 'EAN8':
      return calculateEAN8CheckDigit(barcode);
    case 'UPCA':
      return calculateUPCACheckDigit(barcode);
    default:
      throw new Error(`Check digit calculation not supported for format: ${format}`);
  }
}

/**
 * Validate EAN-13 barcode
 * Must be 13 digits with valid check digit
 */
export function isValidEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }
  
  const checkDigit = calculateEAN13CheckDigit(barcode.slice(0, 12));
  return barcode[12] === checkDigit;
}

/**
 * Validate EAN-8 barcode
 * Must be 8 digits with valid check digit
 */
export function isValidEAN8(barcode: string): boolean {
  if (!/^\d{8}$/.test(barcode)) {
    return false;
  }
  
  const checkDigit = calculateEAN8CheckDigit(barcode.slice(0, 7));
  return barcode[7] === checkDigit;
}

/**
 * Validate UPC-A barcode
 * Must be 12 digits with valid check digit
 */
export function isValidUPCA(barcode: string): boolean {
  if (!/^\d{12}$/.test(barcode)) {
    return false;
  }
  
  const checkDigit = calculateUPCACheckDigit(barcode.slice(0, 11));
  return barcode[11] === checkDigit;
}

/**
 * Validate Code 128 barcode
 * Must contain only ASCII characters 0-127
 * Minimum length of 1 character
 */
export function isValidCode128(barcode: string): boolean {
  if (barcode.length === 0) {
    return false;
  }
  
  // Code 128 supports ASCII characters 0-127
  for (let i = 0; i < barcode.length; i++) {
    if (barcode.charCodeAt(i) > 127) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate internal barcode format
 * Must start with prefix and be followed by digits
 * Format: PREFIX + 8-10 digits
 */
export function isValidInternalBarcode(barcode: string, prefix: string = 'INT'): boolean {
  if (!barcode.startsWith(prefix)) {
    return false;
  }
  
  const suffix = barcode.slice(prefix.length);
  return /^\d{8,10}$/.test(suffix);
}

/**
 * Detect barcode format from string
 * Returns the format if detected, null if unknown
 */
export function detectBarcodeFormat(barcode: string): BarcodeFormat | null {
  if (!barcode || barcode.length === 0) {
    return null;
  }
  
  // Check for internal barcode first (starts with INT)
  if (barcode.startsWith('INT') && isValidInternalBarcode(barcode)) {
    return 'INTERNAL';
  }
  
  // Check numeric formats by length and validity
  if (/^\d+$/.test(barcode)) {
    if (barcode.length === 13 && isValidEAN13(barcode)) {
      return 'EAN13';
    }
    if (barcode.length === 8 && isValidEAN8(barcode)) {
      return 'EAN8';
    }
    if (barcode.length === 12 && isValidUPCA(barcode)) {
      return 'UPCA';
    }
  }
  
  // Check Code 128 (alphanumeric, must have at least one non-digit or be invalid EAN/UPC)
  if (isValidCode128(barcode)) {
    // Only classify as Code 128 if it's not a pure numeric that could be EAN/UPC
    if (!/^\d+$/.test(barcode) || 
        (barcode.length !== 8 && barcode.length !== 12 && barcode.length !== 13)) {
      return 'CODE128';
    }
    // Pure numeric with invalid check digit - could be Code 128
    if (/^\d+$/.test(barcode)) {
      if (barcode.length === 13 && !isValidEAN13(barcode)) return 'CODE128';
      if (barcode.length === 8 && !isValidEAN8(barcode)) return 'CODE128';
      if (barcode.length === 12 && !isValidUPCA(barcode)) return 'CODE128';
    }
  }
  
  return null;
}

/**
 * Validate barcode format and return validation result
 */
export function validateBarcodeFormat(barcode: string): BarcodeValidation {
  if (!barcode || barcode.trim().length === 0) {
    return {
      isValid: false,
      format: null,
      error: 'Barcode tidak boleh kosong'
    };
  }
  
  const format = detectBarcodeFormat(barcode);
  
  if (format === null) {
    return {
      isValid: false,
      format: null,
      error: 'Format barcode tidak dikenali. Format yang didukung: EAN-13, EAN-8, UPC-A, Code 128'
    };
  }
  
  return {
    isValid: true,
    format
  };
}


// Track generated barcodes for uniqueness within session
const generatedBarcodes = new Set<string>();

/**
 * Generate a unique internal barcode with store prefix
 * Format: PREFIX + timestamp (8 digits) + random (2 digits)
 */
export function generateInternalBarcode(prefix: string = 'INT'): string {
  let barcode: string;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    // Use timestamp base (last 8 digits of timestamp)
    const timestamp = Date.now().toString().slice(-8);
    // Add 2 random digits for uniqueness
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    barcode = `${prefix}${timestamp}${random}`;
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique barcode after maximum attempts');
    }
  } while (generatedBarcodes.has(barcode));
  
  generatedBarcodes.add(barcode);
  return barcode;
}

/**
 * Clear the generated barcodes cache (useful for testing)
 */
export function clearGeneratedBarcodesCache(): void {
  generatedBarcodes.clear();
}

/**
 * Check if a barcode has been generated in this session
 */
export function isBarcodeGenerated(barcode: string): boolean {
  return generatedBarcodes.has(barcode);
}
