import { create } from 'zustand';
import { CartItem, Product } from '../types';
import { lookupProductByBarcode } from '../api/barcodes';

export interface AddToCartByBarcodeResult {
  success: boolean;
  product?: Product;
  error?: string;
  isOutOfStock?: boolean;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, discount?: number) => void;
  addToCartByBarcode: (barcode: string) => Promise<AddToCartByBarcodeResult>;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discount: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalAmount: () => number;
  getTotalDiscount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  
  addItem: (product, quantity = 1, discount = 0) => {
    const { items } = get();
    const existingItem = items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      set({
        items: items.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity, discount }
            : item
        )
      });
    } else {
      set({
        items: [...items, { product, quantity, discount }]
      });
    }
  },

  /**
   * Add product to cart by barcode scan
   * - Looks up product by barcode
   * - Checks stock availability
   * - Adds with quantity 1 or increments existing item
   * Requirements: 1.3, 1.4, 4.3
   */
  addToCartByBarcode: async (barcode: string): Promise<AddToCartByBarcodeResult> => {
    // Look up product by barcode
    const lookupResult = await lookupProductByBarcode(barcode);
    
    if (!lookupResult.found || !lookupResult.product) {
      return {
        success: false,
        error: lookupResult.error || 'Produk tidak ditemukan'
      };
    }

    const product = lookupResult.product;
    const { items, addItem } = get();
    
    // Check current quantity in cart
    const existingItem = items.find(item => item.product.id === product.id);
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    const requestedQuantity = currentCartQuantity + 1;

    // Check stock availability (Requirement 4.3)
    if (product.stock_quantity <= 0) {
      return {
        success: false,
        product,
        error: 'Stok habis',
        isOutOfStock: true
      };
    }

    // Check if adding one more would exceed stock
    if (requestedQuantity > product.stock_quantity) {
      return {
        success: false,
        product,
        error: `Stok tidak mencukupi. Tersedia: ${product.stock_quantity}`,
        isOutOfStock: true
      };
    }

    // Add to cart (will increment if exists, or add new with quantity 1)
    addItem(product, 1, existingItem?.discount || 0);

    return {
      success: true,
      product
    };
  },
  
  removeItem: (productId) => {
    const { items } = get();
    set({
      items: items.filter(item => item.product.id !== productId)
    });
  },
  
  updateQuantity: (productId, quantity) => {
    const { items } = get();
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: items.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    });
  },
  
  updateDiscount: (productId, discount) => {
    const { items } = get();
    set({
      items: items.map(item =>
        item.product.id === productId
          ? { ...item, discount }
          : item
      )
    });
  },
  
  clearCart: () => set({ items: [] }),
  
  getTotalItems: () => {
    const { items } = get();
    return items.reduce((total, item) => total + item.quantity, 0);
  },
  
  getTotalAmount: () => {
    const { items } = get();
    return items.reduce((total, item) => {
      const itemTotal = (item.product.price * item.quantity) - item.discount;
      return total + itemTotal;
    }, 0);
  },
  
  getTotalDiscount: () => {
    const { items } = get();
    return items.reduce((total, item) => total + item.discount, 0);
  }
}));