import { CartItem } from '@/types';

// ============================================
// Types
// ============================================

export type DiscountType = 'percentage' | 'nominal';

export interface Discount {
  id: string;
  product_id: string;
  product_name?: string;
  discount_type: DiscountType;
  discount_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promo {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase: number | null;
  is_active: boolean;
  product_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface DiscountedPrice {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface CartItemWithDiscount extends CartItem {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  appliedDiscount?: Discount;
  appliedPromo?: Promo;
}

export interface CartWithDiscounts {
  items: CartItemWithDiscount[];
  subtotal: number;
  totalDiscount: number;
  total: number;
}


export interface MinimumPurchaseResult {
  eligible: boolean;
  remaining: number;
}

// ============================================
// Discount Calculation Functions
// ============================================

/**
 * Calculate percentage discount
 * Formula: final_price = price × (1 - percentage/100)
 * Requirements: 4.3
 */
export function calculatePercentageDiscount(
  price: number,
  percentage: number
): DiscountedPrice {
  // Clamp percentage to valid range
  const validPercentage = Math.max(0, Math.min(100, percentage));
  const discountAmount = Math.round(price * (validPercentage / 100));
  const finalPrice = price - discountAmount;

  return {
    originalPrice: price,
    discountAmount,
    finalPrice,
    discountType: 'percentage',
    discountValue: validPercentage,
  };
}

/**
 * Calculate nominal discount
 * Formula: final_price = price - nominal_value
 * Requirements: 4.4
 */
export function calculateNominalDiscount(
  price: number,
  nominal: number
): DiscountedPrice {
  // Ensure nominal doesn't exceed price
  const validNominal = Math.max(0, Math.min(price, nominal));
  const finalPrice = price - validNominal;

  return {
    originalPrice: price,
    discountAmount: validNominal,
    finalPrice,
    discountType: 'nominal',
    discountValue: validNominal,
  };
}

/**
 * Calculate discounted price based on discount type
 * Requirements: 4.3, 4.4
 */
export function calculateDiscountedPrice(
  price: number,
  discount: Discount
): DiscountedPrice {
  if (discount.discount_type === 'percentage') {
    return calculatePercentageDiscount(price, discount.discount_value);
  }
  return calculateNominalDiscount(price, discount.discount_value);
}


// ============================================
// Cart Discount Functions
// ============================================

/**
 * Check if a promo is currently active based on date
 */
function isPromoActive(promo: Promo, currentDate: Date = new Date()): boolean {
  if (!promo.is_active) return false;
  const startDate = new Date(promo.start_date);
  const endDate = new Date(promo.end_date);
  return currentDate >= startDate && currentDate <= endDate;
}

/**
 * Get applicable discount for a product
 * Checks both individual discounts and active promos
 * Requirements: 4.1, 4.2
 */
export function getApplicableDiscount(
  productId: string,
  discounts: Discount[],
  promos: Promo[],
  currentDate: Date = new Date()
): { discount: Discount | null; promo: Promo | null } {
  // First check for individual product discount
  const productDiscount = discounts.find(
    d => d.product_id === productId && d.is_active
  );

  if (productDiscount) {
    return { discount: productDiscount, promo: null };
  }

  // Then check for active promos that include this product
  for (const promo of promos) {
    if (isPromoActive(promo, currentDate) && promo.product_ids?.includes(productId)) {
      // Create a virtual discount from promo
      const promoDiscount: Discount = {
        id: `promo-${promo.id}`,
        product_id: productId,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        is_active: true,
        created_at: promo.created_at,
        updated_at: promo.updated_at,
      };
      return { discount: promoDiscount, promo };
    }
  }

  return { discount: null, promo: null };
}

/**
 * Calculate cart with all applicable discounts
 * Requirements: 4.1, 4.2
 */
export function calculateCartWithDiscounts(
  items: CartItem[],
  discounts: Discount[],
  promos: Promo[],
  currentDate: Date = new Date()
): CartWithDiscounts {
  let subtotal = 0;
  let totalDiscount = 0;

  const itemsWithDiscounts: CartItemWithDiscount[] = items.map(item => {
    const { discount, promo } = getApplicableDiscount(
      item.product.id,
      discounts,
      promos,
      currentDate
    );

    const originalPrice = item.product.price;
    let discountAmount = 0;
    let finalPrice = originalPrice;

    if (discount) {
      const calculated = calculateDiscountedPrice(originalPrice, discount);
      discountAmount = calculated.discountAmount;
      finalPrice = calculated.finalPrice;
    }

    const itemSubtotal = originalPrice * item.quantity;
    const itemDiscount = discountAmount * item.quantity;

    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;

    return {
      ...item,
      originalPrice,
      discountAmount,
      finalPrice,
      appliedDiscount: discount || undefined,
      appliedPromo: promo || undefined,
    };
  });

  return {
    items: itemsWithDiscounts,
    subtotal,
    totalDiscount,
    total: subtotal - totalDiscount,
  };
}


// ============================================
// Minimum Purchase Functions
// ============================================

/**
 * Check if cart meets minimum purchase requirement for a promo
 * Requirements: 6.2, 6.3, 6.4
 */
export function checkMinimumPurchase(
  cartTotal: number,
  promo: Promo
): MinimumPurchaseResult {
  // If no minimum purchase requirement, always eligible
  if (promo.min_purchase === null || promo.min_purchase === undefined) {
    return {
      eligible: true,
      remaining: 0,
    };
  }

  const minPurchase = promo.min_purchase;
  const eligible = cartTotal >= minPurchase;
  const remaining = eligible ? 0 : minPurchase - cartTotal;

  return {
    eligible,
    remaining,
  };
}
