import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { useCartStore } from './cartStore';
import { Product } from '../types';
import * as barcodesApi from '../api/barcodes';

// Mock the barcodes API
vi.mock('../api/barcodes', () => ({
  lookupProductByBarcode: vi.fn()
}));

// Helper to create a mock product
const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: overrides.id || 'test-id',
  name: overrides.name || 'Test Product',
  barcode: overrides.barcode || '5901234123457',
  price: overrides.price ?? 10000,
  stock_quantity: overrides.stock_quantity ?? 10,
  min_stock: overrides.min_stock ?? 5,
  is_active: overrides.is_active ?? true,
  created_at: overrides.created_at || new Date().toISOString(),
  updated_at: overrides.updated_at || new Date().toISOString()
});

// Generator for valid product data
const productArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  barcode: fc.stringMatching(/^\d{8,13}$/),
  price: fc.integer({ min: 100, max: 1000000 }),
  stock_quantity: fc.integer({ min: 1, max: 100 }),
  min_stock: fc.integer({ min: 0, max: 10 }),
  is_active: fc.constant(true),
  created_at: fc.constant(new Date().toISOString()),
  updated_at: fc.constant(new Date().toISOString())
});

// Generator for products with zero stock
const zeroStockProductArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  barcode: fc.stringMatching(/^\d{8,13}$/),
  price: fc.integer({ min: 100, max: 1000000 }),
  stock_quantity: fc.constant(0),
  min_stock: fc.integer({ min: 0, max: 10 }),
  is_active: fc.constant(true),
  created_at: fc.constant(new Date().toISOString()),
  updated_at: fc.constant(new Date().toISOString())
});

describe('Cart Store - Barcode Integration', () => {
  beforeEach(() => {
    // Reset cart state before each test
    useCartStore.setState({ items: [] });
    vi.clearAllMocks();
  });

  describe('addToCartByBarcode', () => {
    it('should add product to cart when barcode is found', async () => {
      const product = createMockProduct();
      vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
        found: true,
        product
      });

      const result = await useCartStore.getState().addToCartByBarcode('5901234123457');

      expect(result.success).toBe(true);
      expect(result.product).toEqual(product);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });

    it('should return error when barcode is not found', async () => {
      vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
        found: false,
        error: 'Produk tidak ditemukan'
      });

      const result = await useCartStore.getState().addToCartByBarcode('9999999999999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Produk tidak ditemukan');
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should increment quantity when product already in cart', async () => {
      const product = createMockProduct({ stock_quantity: 10 });
      vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
        found: true,
        product
      });

      // Add product first time
      await useCartStore.getState().addToCartByBarcode('5901234123457');
      expect(useCartStore.getState().items[0].quantity).toBe(1);

      // Add same product again
      await useCartStore.getState().addToCartByBarcode('5901234123457');
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it('should reject when product is out of stock', async () => {
      const product = createMockProduct({ stock_quantity: 0 });
      vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
        found: true,
        product
      });

      const result = await useCartStore.getState().addToCartByBarcode('5901234123457');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stok habis');
      expect(result.isOutOfStock).toBe(true);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should reject when adding would exceed stock', async () => {
      const product = createMockProduct({ stock_quantity: 2 });
      vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
        found: true,
        product
      });

      // Add product twice (stock = 2)
      await useCartStore.getState().addToCartByBarcode('5901234123457');
      await useCartStore.getState().addToCartByBarcode('5901234123457');
      expect(useCartStore.getState().items[0].quantity).toBe(2);

      // Third scan should fail
      const result = await useCartStore.getState().addToCartByBarcode('5901234123457');
      expect(result.success).toBe(false);
      expect(result.isOutOfStock).toBe(true);
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });
  });

  // **Feature: barcode-scanner, Property 1: Cart Addition on Barcode Scan**
  // **Validates: Requirements 1.3, 1.4**
  describe('Property 1: Cart Addition on Barcode Scan', () => {
    it('for any valid product barcode, product should be added with quantity 1 if not in cart', () => {
      fc.assert(
        fc.property(productArbitrary, (productData) => {
          // Reset cart
          useCartStore.setState({ items: [] });
          
          const product = createMockProduct(productData);
          
          // Simulate synchronous add (testing the addItem logic directly)
          useCartStore.getState().addItem(product, 1, 0);
          const items = useCartStore.getState().items;

          // Cart should have exactly 1 item
          if (items.length !== 1) return false;
          // Item should have quantity 1
          if (items[0].quantity !== 1) return false;
          // Item should be the correct product
          if (items[0].product.id !== product.id) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any product already in cart, adding should increment quantity by 1', () => {
      fc.assert(
        fc.property(
          productArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (productData, initialQuantity) => {
            const product = createMockProduct({
              ...productData,
              stock_quantity: initialQuantity + 10
            });
            
            // Reset cart and add initial quantity
            useCartStore.setState({ 
              items: [{ product, quantity: initialQuantity, discount: 0 }] 
            });
            
            // Add one more
            useCartStore.getState().addItem(product, 1, 0);
            const items = useCartStore.getState().items;

            // Cart should still have 1 item
            if (items.length !== 1) return false;
            // Quantity should be incremented by 1
            if (items[0].quantity !== initialQuantity + 1) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('async: for any valid product, addToCartByBarcode adds with quantity 1', async () => {
      const samples = fc.sample(productArbitrary, 20);
      
      for (const productData of samples) {
        useCartStore.setState({ items: [] });
        
        const product = createMockProduct(productData);
        vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
          found: true,
          product
        });

        const result = await useCartStore.getState().addToCartByBarcode(product.barcode!);
        const items = useCartStore.getState().items;

        expect(result.success).toBe(true);
        expect(items.length).toBe(1);
        expect(items[0].quantity).toBe(1);
        expect(items[0].product.id).toBe(product.id);
      }
    });

    it('async: for any product in cart, addToCartByBarcode increments quantity', async () => {
      const productSamples = fc.sample(productArbitrary, 20);
      const quantitySamples = fc.sample(fc.integer({ min: 1, max: 5 }), 20);
      
      for (let i = 0; i < productSamples.length; i++) {
        const productData = productSamples[i];
        const initialQuantity = quantitySamples[i];
        
        const product = createMockProduct({
          ...productData,
          stock_quantity: initialQuantity + 10
        });
        
        useCartStore.setState({ 
          items: [{ product, quantity: initialQuantity, discount: 0 }] 
        });
        
        vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
          found: true,
          product
        });

        const result = await useCartStore.getState().addToCartByBarcode(product.barcode!);
        const items = useCartStore.getState().items;

        expect(result.success).toBe(true);
        expect(items.length).toBe(1);
        expect(items[0].quantity).toBe(initialQuantity + 1);
      }
    });
  });

  // **Feature: barcode-scanner, Property 7: Out of Stock Prevention**
  // **Validates: Requirements 4.3**
  describe('Property 7: Out of Stock Prevention', () => {
    it('for any product with zero stock, adding to cart should be rejected', async () => {
      const samples = fc.sample(zeroStockProductArbitrary, 20);
      
      for (const productData of samples) {
        useCartStore.setState({ items: [] });
        
        const product = createMockProduct(productData);
        vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
          found: true,
          product
        });

        const result = await useCartStore.getState().addToCartByBarcode(product.barcode!);
        const items = useCartStore.getState().items;

        expect(result.success).toBe(false);
        expect(result.isOutOfStock).toBe(true);
        expect(result.error).toContain('Stok');
        expect(items.length).toBe(0);
      }
    });

    it('for any product, adding beyond available stock should be rejected', async () => {
      const samples = fc.sample(productArbitrary, 20);
      
      for (const productData of samples) {
        const stockLimit = Math.max(1, (productData.stock_quantity % 5) + 1);
        const product = createMockProduct({
          ...productData,
          stock_quantity: stockLimit
        });
        
        useCartStore.setState({ 
          items: [{ product, quantity: stockLimit, discount: 0 }] 
        });
        
        vi.mocked(barcodesApi.lookupProductByBarcode).mockResolvedValue({
          found: true,
          product
        });

        const result = await useCartStore.getState().addToCartByBarcode(product.barcode!);
        const items = useCartStore.getState().items;

        expect(result.success).toBe(false);
        expect(result.isOutOfStock).toBe(true);
        expect(items[0].quantity).toBe(stockLimit);
      }
    });
  });
});
