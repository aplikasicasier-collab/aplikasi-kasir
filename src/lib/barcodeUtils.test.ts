import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  detectBarcodeFormat,
  validateBarcodeFormat,
  isValidEAN13,
  isValidEAN8,
  isValidUPCA,
  isValidCode128,
  calculateEAN13CheckDigit,
  calculateEAN8CheckDigit,
  calculateUPCACheckDigit,
  generateInternalBarcode,
  clearGeneratedBarcodesCache,
  isValidInternalBarcode
} from './barcodeUtils';

// Helper to generate digit string of specific length
const digitString = (length: number) => 
  fc.array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length })
    .map(arr => arr.join(''));

// Helper to generate alphanumeric string
const alphanumericString = (minLen: number, maxLen: number) =>
  fc.array(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.'.split('')),
    { minLength: minLen, maxLength: maxLen }
  ).map(arr => arr.join(''));

// Helper to generate uppercase letter string
const uppercaseString = (minLen: number, maxLen: number) =>
  fc.array(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: minLen, maxLength: maxLen }
  ).map(arr => arr.join(''));

describe('Barcode Utilities', () => {
  beforeEach(() => {
    clearGeneratedBarcodesCache();
  });

  describe('Check Digit Calculations', () => {
    it('should calculate correct EAN-13 check digit', () => {
      // Known EAN-13: 5901234123457 -> check digit is 7
      expect(calculateEAN13CheckDigit('590123412345')).toBe('7');
      // Known EAN-13: 4006381333931 -> check digit is 1
      expect(calculateEAN13CheckDigit('400638133393')).toBe('1');
    });

    it('should calculate correct EAN-8 check digit', () => {
      // Known EAN-8: 96385074 -> check digit is 4
      expect(calculateEAN8CheckDigit('9638507')).toBe('4');
    });

    it('should calculate correct UPC-A check digit', () => {
      // Known UPC-A: 012345678905 -> check digit is 5
      expect(calculateUPCACheckDigit('01234567890')).toBe('5');
    });
  });


  describe('Format Validation', () => {
    it('should validate correct EAN-13 barcodes', () => {
      expect(isValidEAN13('5901234123457')).toBe(true);
      expect(isValidEAN13('4006381333931')).toBe(true);
    });

    it('should reject invalid EAN-13 barcodes', () => {
      expect(isValidEAN13('5901234123458')).toBe(false); // wrong check digit
      expect(isValidEAN13('123456789012')).toBe(false); // wrong length
      expect(isValidEAN13('abcdefghijklm')).toBe(false); // non-numeric
    });

    it('should validate correct EAN-8 barcodes', () => {
      expect(isValidEAN8('96385074')).toBe(true);
    });

    it('should reject invalid EAN-8 barcodes', () => {
      expect(isValidEAN8('96385075')).toBe(false); // wrong check digit
      expect(isValidEAN8('1234567')).toBe(false); // wrong length
    });

    it('should validate correct UPC-A barcodes', () => {
      expect(isValidUPCA('012345678905')).toBe(true);
    });

    it('should reject invalid UPC-A barcodes', () => {
      expect(isValidUPCA('012345678906')).toBe(false); // wrong check digit
      expect(isValidUPCA('12345678901')).toBe(false); // wrong length
    });

    it('should validate Code 128 barcodes', () => {
      expect(isValidCode128('ABC123')).toBe(true);
      expect(isValidCode128('test-barcode')).toBe(true);
      expect(isValidCode128('')).toBe(false); // empty
    });
  });

  describe('Format Detection', () => {
    it('should detect EAN-13 format', () => {
      expect(detectBarcodeFormat('5901234123457')).toBe('EAN13');
    });

    it('should detect EAN-8 format', () => {
      expect(detectBarcodeFormat('96385074')).toBe('EAN8');
    });

    it('should detect UPC-A format', () => {
      expect(detectBarcodeFormat('012345678905')).toBe('UPCA');
    });

    it('should detect Code 128 format', () => {
      expect(detectBarcodeFormat('ABC123')).toBe('CODE128');
    });

    it('should detect internal barcode format', () => {
      expect(detectBarcodeFormat('INT1234567890')).toBe('INTERNAL');
    });

    it('should return null for empty barcode', () => {
      expect(detectBarcodeFormat('')).toBe(null);
    });
  });


  // **Feature: barcode-scanner, Property 2: Barcode Format Support**
  // **Validates: Requirements 2.3**
  describe('Property 2: Barcode Format Support', () => {
    // Generator for valid EAN-13 barcodes
    const validEAN13 = digitString(12).map((base: string) => base + calculateEAN13CheckDigit(base));

    // Generator for valid EAN-8 barcodes
    const validEAN8 = digitString(7).map((base: string) => base + calculateEAN8CheckDigit(base));

    // Generator for valid UPC-A barcodes
    const validUPCA = digitString(11).map((base: string) => base + calculateUPCACheckDigit(base));

    // Generator for valid Code 128 barcodes (alphanumeric, must have at least one non-digit)
    const validCode128 = alphanumericString(1, 20)
      .filter((s: string) => /[A-Za-z\-_.]/.test(s));

    it('should correctly identify and validate EAN-13 format for any valid EAN-13 barcode', () => {
      fc.assert(
        fc.property(validEAN13, (barcode: string) => {
          const format = detectBarcodeFormat(barcode);
          return format === 'EAN13' && isValidEAN13(barcode);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify and validate EAN-8 format for any valid EAN-8 barcode', () => {
      fc.assert(
        fc.property(validEAN8, (barcode: string) => {
          const format = detectBarcodeFormat(barcode);
          return format === 'EAN8' && isValidEAN8(barcode);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify and validate UPC-A format for any valid UPC-A barcode', () => {
      fc.assert(
        fc.property(validUPCA, (barcode: string) => {
          const format = detectBarcodeFormat(barcode);
          return format === 'UPCA' && isValidUPCA(barcode);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify Code 128 format for any valid Code 128 barcode', () => {
      fc.assert(
        fc.property(validCode128, (barcode: string) => {
          const format = detectBarcodeFormat(barcode);
          return format === 'CODE128' && isValidCode128(barcode);
        }),
        { numRuns: 100 }
      );
    });
  });


  // **Feature: barcode-scanner, Property 4: Barcode Format Validation**
  // **Validates: Requirements 3.3**
  describe('Property 4: Barcode Format Validation', () => {
    it('should reject empty barcodes with validation error', () => {
      fc.assert(
        fc.property(
          fc.constant(''),
          (barcode: string) => {
            const result = validateBarcodeFormat(barcode);
            return result.isValid === false && result.error !== undefined;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject whitespace-only barcodes with validation error', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constant(' '), { minLength: 1, maxLength: 5 }).map(arr => arr.join('')),
          (barcode: string) => {
            const result = validateBarcodeFormat(barcode);
            return result.isValid === false && result.error !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Generator for numeric strings with invalid check digits
    const invalidCheckDigitEAN13 = digitString(12).map((base: string) => {
      const correctCheckDigit = calculateEAN13CheckDigit(base);
      const wrongCheckDigit = ((parseInt(correctCheckDigit) + 1) % 10).toString();
      return base + wrongCheckDigit;
    });

    it('should not identify numeric strings with invalid check digits as EAN-13', () => {
      fc.assert(
        fc.property(invalidCheckDigitEAN13, (barcode: string) => {
          const format = detectBarcodeFormat(barcode);
          // Should not be detected as EAN13 (might be CODE128)
          return format !== 'EAN13';
        }),
        { numRuns: 100 }
      );
    });
  });


  // **Feature: barcode-scanner, Property 5: Internal Barcode Generation**
  // **Validates: Requirements 3.4, 3.5**
  describe('Property 5: Internal Barcode Generation', () => {
    beforeEach(() => {
      clearGeneratedBarcodesCache();
    });

    it('should generate internal barcodes starting with configured prefix', () => {
      fc.assert(
        fc.property(
          uppercaseString(2, 5),
          (prefix: string) => {
            clearGeneratedBarcodesCache();
            const barcode = generateInternalBarcode(prefix);
            return barcode.startsWith(prefix);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique internal barcodes across multiple generations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (count: number) => {
            clearGeneratedBarcodesCache();
            const barcodes = new Set<string>();
            for (let i = 0; i < count; i++) {
              const barcode = generateInternalBarcode('INT');
              barcodes.add(barcode);
            }
            // All generated barcodes should be unique
            return barcodes.size === count;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid internal barcode format', () => {
      fc.assert(
        fc.property(
          fc.constant('INT'),
          (prefix: string) => {
            clearGeneratedBarcodesCache();
            const barcode = generateInternalBarcode(prefix);
            return isValidInternalBarcode(barcode, prefix);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect generated internal barcodes correctly', () => {
      fc.assert(
        fc.property(
          fc.constant('INT'),
          (prefix: string) => {
            clearGeneratedBarcodesCache();
            const barcode = generateInternalBarcode(prefix);
            const format = detectBarcodeFormat(barcode);
            return format === 'INTERNAL';
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
