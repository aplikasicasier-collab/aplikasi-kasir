/**
 * Barcode API Tests
 * Property-based tests for barcode lookup and assignment functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { lookupProductByBarcode, checkBarcodeUniqueness, assignBarcodeToProduct } from './barcodes';
import { supabase } from '../lib/supabaseClient';

// Mock supabase client
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn()
  }
}));

// Helper to generate random barcode strings that won't exist in DB
const randomBarcodeString = fc.array(
  fc.constantFrom(...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')),
  { minLength: 5, maxLength: 20 }
).map(arr => arr.join(''));

// Helper to generate valid UUID
const validUUID = fc.uuid();

describe('Barcode API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lookupProductByBarcode', () => {
    it('should return error for empty barcode', async () => {
      const result = await lookupProductByBarcode('');
      expect(result.found).toBe(false);
      expect(result.error).toBe('Barcode tidak boleh kosong');
    });

    it('should return error for whitespace-only barcode', async () => {
      const result = await lookupProductByBarcode('   ');
      expect(result.found).toBe(false);
      expect(result.error).toBe('Barcode tidak boleh kosong');
    });

    it('should return product when found', async () => {
      const mockProduct = {
        id: '123',
        name: 'Test Product',
        barcode: '5901234123457',
        price: 10000,
        stock_quantity: 10,
        min_stock: 5,
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({ data: mockProduct, error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      } as never);

      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ single: mockSingle });

      const result = await lookupProductByBarcode('5901234123457');
      expect(result.found).toBe(true);
      expect(result.product).toEqual(mockProduct);
    });
  });

  // **Feature: barcode-scanner, Property 6: Unknown Barcode Handling**
  // **Validates: Requirements 4.2**
  describe('Property 6: Unknown Barcode Handling', () => {
    it('should return not found result for any barcode not in database', async () => {
      await fc.assert(
        fc.asyncProperty(
          randomBarcodeString.filter(s => s.trim().length > 0),
          async (barcode: string) => {
            // Setup mock for each iteration - simulating barcode not found in DB
            const mockSingle = vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows returned' }
            });
            const mockEq = vi.fn().mockImplementation(() => ({
              eq: mockEq,
              single: mockSingle
            }));
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect
            } as never);

            const result = await lookupProductByBarcode(barcode);
            
            // For any barcode not in database, should return not found
            return result.found === false && result.error === 'Produk tidak ditemukan';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return not found with correct error message for non-existent barcodes', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' }
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      } as never);

      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ single: mockSingle });

      const result = await lookupProductByBarcode('NONEXISTENT123');
      expect(result.found).toBe(false);
      expect(result.error).toBe('Produk tidak ditemukan');
    });
  });

  describe('checkBarcodeUniqueness', () => {
    it('should return false for empty barcode', async () => {
      const result = await checkBarcodeUniqueness('');
      expect(result).toBe(false);
    });

    it('should return true when barcode is unique (no products found)', async () => {
      const mockNeq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as never);

      const result = await checkBarcodeUniqueness('UNIQUE123', 'product-id');
      expect(result).toBe(true);
    });

    it('should return false when barcode already exists', async () => {
      const mockNeq = vi.fn().mockResolvedValue({ 
        data: [{ id: 'other-product' }], 
        error: null 
      });
      const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as never);

      const result = await checkBarcodeUniqueness('EXISTING123', 'product-id');
      expect(result).toBe(false);
    });
  });

  describe('assignBarcodeToProduct', () => {
    it('should return error for empty product ID', async () => {
      const result = await assignBarcodeToProduct('', '5901234123457');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Product ID tidak boleh kosong');
    });

    it('should return error for empty barcode', async () => {
      const result = await assignBarcodeToProduct('product-id', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Barcode tidak boleh kosong');
    });

    it('should return error for invalid barcode format', async () => {
      const result = await assignBarcodeToProduct('product-id', '   ');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when barcode already used by another product', async () => {
      // Mock checkBarcodeUniqueness to return false (barcode exists)
      const mockNeq = vi.fn().mockResolvedValue({ 
        data: [{ id: 'other-product' }], 
        error: null 
      });
      const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as never);

      const result = await assignBarcodeToProduct('product-id', '5901234123457');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Barcode sudah digunakan produk lain');
    });

    it('should successfully assign barcode when unique and valid', async () => {
      // First call for checkBarcodeUniqueness
      const mockNeq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEqSelect = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });

      // Second call for update
      const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: mockSelect } as never;
        }
        return { update: mockUpdate } as never;
      });

      const result = await assignBarcodeToProduct('product-id', '5901234123457');
      expect(result.success).toBe(true);
    });
  });

  // **Feature: barcode-scanner, Property 3: Barcode Uniqueness Validation**
  // **Validates: Requirements 3.2**
  describe('Property 3: Barcode Uniqueness Validation', () => {
    // Generator for valid EAN-13 barcodes
    const digitString = (length: number) => 
      fc.array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length })
        .map(arr => arr.join(''));

    const calculateEAN13CheckDigit = (barcode: string): string => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(barcode[i], 10);
        sum += i % 2 === 0 ? digit : digit * 3;
      }
      return ((10 - (sum % 10)) % 10).toString();
    };

    const validEAN13 = digitString(12).map((base: string) => base + calculateEAN13CheckDigit(base));

    it('should reject barcode assignment when another product already has the same barcode', async () => {
      await fc.assert(
        fc.asyncProperty(
          validEAN13,
          validUUID,
          async (barcode: string, productId: string) => {
            // Mock: barcode already exists on another product
            const mockNeq = vi.fn().mockResolvedValue({ 
              data: [{ id: 'other-product-id' }], 
              error: null 
            });
            const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect
            } as never);

            const result = await assignBarcodeToProduct(productId, barcode);
            
            // Should reject with duplicate barcode error
            return result.success === false && 
                   result.error === 'Barcode sudah digunakan produk lain';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow barcode assignment when barcode is unique', async () => {
      await fc.assert(
        fc.asyncProperty(
          validEAN13,
          validUUID,
          async (barcode: string, productId: string) => {
            // Mock: barcode is unique (no other products have it)
            const mockNeq = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockEqSelect = vi.fn().mockReturnValue({ neq: mockNeq });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });

            // Mock for update
            const mockEqUpdate = vi.fn().mockResolvedValue({ error: null });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockSelect } as never;
              }
              return { update: mockUpdate } as never;
            });

            const result = await assignBarcodeToProduct(productId, barcode);
            
            // Should succeed when barcode is unique
            return result.success === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
