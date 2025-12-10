import { CartItem } from '@/types';

// ============================================
// Types
// ============================================

export interface CheckoutValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PaymentInfo {
  method: 'cash' | 'card' | 'e-wallet';
  cashReceived?: number;
  totalAmount: number;
}

// ============================================
// Checkout Validation
// ============================================

/**
 * Validate checkout - checks cart and payment
 */
export function validateCheckout(
  items: CartItem[],
  payment: PaymentInfo
): CheckoutValidationResult {
  const errors: string[] = [];

  // Validate cart is not empty
  if (items.length === 0) {
    errors.push('Keranjang kosong. Tambahkan produk untuk melanjutkan.');
  }

  // Validate payment for cash method
  if (payment.method === 'cash') {
    if (payment.cashReceived === undefined || payment.cashReceived === null) {
      errors.push('Masukkan jumlah uang yang diterima.');
    } else if (payment.cashReceived < payment.totalAmount) {
      const shortage = payment.totalAmount - payment.cashReceived;
      errors.push(`Pembayaran kurang Rp ${shortage.toLocaleString('id-ID')}. Uang diterima harus >= total.`);
    }
  }

  // Validate all items have positive quantity
  const invalidItems = items.filter(item => item.quantity <= 0);
  if (invalidItems.length > 0) {
    errors.push('Semua item harus memiliki jumlah lebih dari 0.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate cart is not empty
 */
export function validateCartNotEmpty(items: CartItem[]): boolean {
  return items.length > 0;
}

/**
 * Validate cash payment is sufficient
 */
export function validateCashPayment(cashReceived: number, totalAmount: number): boolean {
  return cashReceived >= totalAmount;
}

/**
 * Validate payment based on method
 */
export function validatePayment(payment: PaymentInfo): CheckoutValidationResult {
  const errors: string[] = [];

  if (payment.method === 'cash') {
    if (payment.cashReceived === undefined) {
      errors.push('Jumlah uang diterima harus diisi untuk pembayaran tunai.');
    } else if (payment.cashReceived < payment.totalAmount) {
      errors.push('Jumlah uang diterima kurang dari total pembayaran.');
    }
  }

  // Card and e-wallet don't require cash validation
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate change amount
 */
export function calculateChange(cashReceived: number, totalAmount: number): number {
  return Math.max(0, cashReceived - totalAmount);
}

/**
 * Check if checkout button should be enabled
 */
export function isCheckoutEnabled(
  items: CartItem[],
  payment: PaymentInfo,
  isLoading: boolean
): boolean {
  if (isLoading) return false;
  if (items.length === 0) return false;
  
  if (payment.method === 'cash') {
    if (payment.cashReceived === undefined) return false;
    if (payment.cashReceived < payment.totalAmount) return false;
  }

  return true;
}
