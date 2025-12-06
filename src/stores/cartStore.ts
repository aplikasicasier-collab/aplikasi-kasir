import { create } from 'zustand';
import { CartItem, Product } from '../types';

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, discount?: number) => void;
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