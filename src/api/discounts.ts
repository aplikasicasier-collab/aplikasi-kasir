import { supabase } from '@/lib/supabaseClient';

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

export interface CreateDiscountInput {
  product_id: string;
  discount_type: DiscountType;
  discount_value: number;
}

export interface UpdateDiscountInput {
  discount_type?: DiscountType;
  discount_value?: number;
  is_active?: boolean;
}

export interface DiscountFilters {
  is_active?: boolean;
  product_id?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================
// Validation Functions
// Requirements: 1.2, 1.3
// ============================================

/**
 * Validate percentage discount value
 * Requirements: 1.2 - Value must be between 1 and 100
 */
export function validatePercentageDiscount(value: number): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: 'Nilai diskon harus berupa angka' };
  }
  
  if (value < 1 || value > 100) {
    return { valid: false, error: 'Persentase harus antara 1-100' };
  }
  
  return { valid: true };
}

/**
 * Validate nominal discount value
 * Requirements: 1.3 - Value must be > 0 and < product price
 */
export function validateNominalDiscount(value: number, productPrice: number): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: 'Nilai diskon harus berupa angka' };
  }
  
  if (typeof productPrice !== 'number' || isNaN(productPrice)) {
    return { valid: false, error: 'Harga produk tidak valid' };
  }
  
  if (value <= 0) {
    return { valid: false, error: 'Diskon nominal harus lebih dari 0' };
  }
  
  if (value >= productPrice) {
    return { valid: false, error: 'Diskon tidak boleh melebihi harga produk' };
  }
  
  return { valid: true };
}

/**
 * Validate discount based on type
 */
export function validateDiscount(
  discountType: DiscountType,
  discountValue: number,
  productPrice?: number
): ValidationResult {
  if (discountType === 'percentage') {
    return validatePercentageDiscount(discountValue);
  }
  
  if (discountType === 'nominal') {
    if (productPrice === undefined) {
      return { valid: false, error: 'Harga produk diperlukan untuk validasi diskon nominal' };
    }
    return validateNominalDiscount(discountValue, productPrice);
  }
  
  return { valid: false, error: 'Tipe diskon tidak valid' };
}


// ============================================
// CRUD Functions
// Requirements: 1.1, 1.4, 1.5, 3.1, 3.3, 3.4
// ============================================

/**
 * Check if a product already has an active discount
 * Requirements: 1.5
 */
export async function hasActiveDiscount(productId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('discounts')
    .select('id')
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check active discount: ${error.message}`);
  }

  return data !== null;
}

/**
 * Create a new discount
 * Requirements: 1.1, 1.4, 1.5
 */
export async function createDiscount(input: CreateDiscountInput): Promise<Discount> {
  // Check for existing active discount on the product
  const existingDiscount = await hasActiveDiscount(input.product_id);
  if (existingDiscount) {
    throw new Error('Produk sudah memiliki diskon aktif');
  }

  const { data, error } = await supabase
    .from('discounts')
    .insert({
      product_id: input.product_id,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      products:product_id (name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create discount: ${error.message}`);
  }

  return {
    ...data,
    product_name: data.products?.name,
  } as Discount;
}

/**
 * Get all discounts with optional filters
 * Requirements: 3.1
 */
export async function getDiscounts(filters?: DiscountFilters): Promise<Discount[]> {
  let query = supabase
    .from('discounts')
    .select(`
      *,
      products:product_id (name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters?.product_id) {
    query = query.eq('product_id', filters.product_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch discounts: ${error.message}`);
  }

  return (data || []).map(d => ({
    ...d,
    product_name: d.products?.name,
  })) as Discount[];
}

/**
 * Get discount by ID
 */
export async function getDiscountById(id: string): Promise<Discount | null> {
  const { data, error } = await supabase
    .from('discounts')
    .select(`
      *,
      products:product_id (name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch discount: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    product_name: data.products?.name,
  } as Discount;
}

/**
 * Get active discount for a specific product
 * Requirements: 3.1
 */
export async function getActiveDiscountByProductId(productId: string): Promise<Discount | null> {
  const { data, error } = await supabase
    .from('discounts')
    .select(`
      *,
      products:product_id (name)
    `)
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active discount: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    product_name: data.products?.name,
  } as Discount;
}

/**
 * Update a discount
 * Requirements: 3.3
 */
export async function updateDiscount(id: string, input: UpdateDiscountInput): Promise<Discount> {
  const { data, error } = await supabase
    .from('discounts')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      products:product_id (name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update discount: ${error.message}`);
  }

  return {
    ...data,
    product_name: data.products?.name,
  } as Discount;
}

/**
 * Deactivate a discount
 * Requirements: 3.4
 */
export async function deactivateDiscount(id: string): Promise<Discount> {
  return updateDiscount(id, { is_active: false });
}

/**
 * Delete a discount
 */
export async function deleteDiscount(id: string): Promise<void> {
  const { error } = await supabase
    .from('discounts')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete discount: ${error.message}`);
  }
}
