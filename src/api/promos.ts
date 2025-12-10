import { supabase } from '@/lib/supabaseClient';
import type { DiscountType } from './discounts';

// ============================================
// Types
// ============================================

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
  product_count?: number;
  products?: PromoProduct[];
  created_at: string;
  updated_at: string;
}

export interface PromoProduct {
  id: string;
  promo_id: string;
  product_id: string;
  product_name?: string;
  created_at: string;
}

export interface CreatePromoInput {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase?: number;
  product_ids: string[];
}

export interface UpdatePromoInput {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  min_purchase?: number | null;
  is_active?: boolean;
}


export interface PromoFilters {
  is_active?: boolean;
  status?: 'active' | 'upcoming' | 'expired' | 'inactive';
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================
// Validation Functions
// Requirements: 2.2
// ============================================

/**
 * Validate promo date range
 * Requirements: 2.2 - End date must be after start date
 */
export function validatePromoDateRange(startDate: string, endDate: string): ValidationResult {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Tanggal mulai tidak valid' };
  }

  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Tanggal berakhir tidak valid' };
  }

  if (end <= start) {
    return { valid: false, error: 'Tanggal berakhir harus setelah tanggal mulai' };
  }

  return { valid: true };
}

/**
 * Check if a promo is currently active based on date
 * Requirements: 2.4, 2.5
 */
export function isPromoCurrentlyActive(promo: Promo): boolean {
  if (!promo.is_active) return false;
  
  const now = new Date();
  const start = new Date(promo.start_date);
  const end = new Date(promo.end_date);
  
  return now >= start && now <= end;
}

/**
 * Get promo status based on dates and is_active flag
 * Requirements: 2.4, 2.5, 3.2
 */
export function getPromoStatus(promo: Promo): 'active' | 'upcoming' | 'expired' | 'inactive' {
  if (!promo.is_active) return 'inactive';
  
  const now = new Date();
  const start = new Date(promo.start_date);
  const end = new Date(promo.end_date);
  
  if (now < start) return 'upcoming';
  if (now > end) return 'expired';
  return 'active';
}


// ============================================
// CRUD Functions
// Requirements: 2.1, 2.2, 2.4, 2.5, 3.2, 3.5
// ============================================

/**
 * Create a new promo with products
 * Requirements: 2.1, 2.2, 2.3
 */
export async function createPromo(input: CreatePromoInput): Promise<Promo> {
  // Validate date range
  const dateValidation = validatePromoDateRange(input.start_date, input.end_date);
  if (!dateValidation.valid) {
    throw new Error(dateValidation.error);
  }

  // Validate products
  if (!input.product_ids || input.product_ids.length === 0) {
    throw new Error('Pilih minimal satu produk untuk promo');
  }

  // Create promo
  const { data: promo, error: promoError } = await supabase
    .from('promos')
    .insert({
      name: input.name,
      description: input.description || null,
      start_date: input.start_date,
      end_date: input.end_date,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_purchase: input.min_purchase || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (promoError) {
    throw new Error(`Failed to create promo: ${promoError.message}`);
  }

  // Add products to promo
  const promoProducts = input.product_ids.map(productId => ({
    promo_id: promo.id,
    product_id: productId,
  }));

  const { error: productsError } = await supabase
    .from('promo_products')
    .insert(promoProducts);

  if (productsError) {
    // Rollback promo creation
    await supabase.from('promos').delete().eq('id', promo.id);
    throw new Error(`Failed to add products to promo: ${productsError.message}`);
  }

  return {
    ...promo,
    product_count: input.product_ids.length,
  } as Promo;
}

/**
 * Get all promos with optional filters
 * Requirements: 3.2
 */
export async function getPromos(filters?: PromoFilters): Promise<Promo[]> {
  let query = supabase
    .from('promos')
    .select(`
      *,
      promo_products (
        id,
        product_id,
        products:product_id (name)
      )
    `)
    .order('created_at', { ascending: false });

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch promos: ${error.message}`);
  }

  let promos = (data || []).map(p => ({
    ...p,
    product_count: p.promo_products?.length || 0,
    products: p.promo_products?.map((pp: { id: string; product_id: string; products?: { name: string } }) => ({
      id: pp.id,
      promo_id: p.id,
      product_id: pp.product_id,
      product_name: pp.products?.name,
    })),
  })) as Promo[];

  // Filter by status if specified
  if (filters?.status) {
    promos = promos.filter(p => getPromoStatus(p) === filters.status);
  }

  return promos;
}


/**
 * Get promo by ID
 */
export async function getPromoById(id: string): Promise<Promo | null> {
  const { data, error } = await supabase
    .from('promos')
    .select(`
      *,
      promo_products (
        id,
        product_id,
        products:product_id (name)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch promo: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    product_count: data.promo_products?.length || 0,
    products: data.promo_products?.map((pp: { id: string; product_id: string; products?: { name: string } }) => ({
      id: pp.id,
      promo_id: data.id,
      product_id: pp.product_id,
      product_name: pp.products?.name,
    })),
  } as Promo;
}

/**
 * Get all currently active promos (within date range and is_active = true)
 * Requirements: 2.4, 2.5
 */
export async function getActivePromos(): Promise<Promo[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('promos')
    .select(`
      *,
      promo_products (
        id,
        product_id,
        products:product_id (name)
      )
    `)
    .eq('is_active', true)
    .lte('start_date', now)
    .gte('end_date', now)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch active promos: ${error.message}`);
  }

  return (data || []).map(p => ({
    ...p,
    product_count: p.promo_products?.length || 0,
    products: p.promo_products?.map((pp: { id: string; product_id: string; products?: { name: string } }) => ({
      id: pp.id,
      promo_id: p.id,
      product_id: pp.product_id,
      product_name: pp.products?.name,
    })),
  })) as Promo[];
}

/**
 * Get active promo for a specific product
 */
export async function getActivePromoByProductId(productId: string): Promise<Promo | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('promo_products')
    .select(`
      promo:promo_id (
        *
      )
    `)
    .eq('product_id', productId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch promo for product: ${error.message}`);
  }

  if (!data?.promo) return null;

  const promo = data.promo as unknown as Promo;
  
  // Check if promo is currently active
  if (!promo.is_active) return null;
  
  const start = new Date(promo.start_date);
  const end = new Date(promo.end_date);
  const nowDate = new Date(now);
  
  if (nowDate < start || nowDate > end) return null;

  return promo;
}


/**
 * Update a promo
 * Requirements: 3.2
 */
export async function updatePromo(id: string, input: UpdatePromoInput): Promise<Promo> {
  // Validate date range if both dates are provided
  if (input.start_date && input.end_date) {
    const dateValidation = validatePromoDateRange(input.start_date, input.end_date);
    if (!dateValidation.valid) {
      throw new Error(dateValidation.error);
    }
  } else if (input.start_date || input.end_date) {
    // If only one date is provided, fetch the existing promo to validate
    const existing = await getPromoById(id);
    if (!existing) {
      throw new Error('Promo tidak ditemukan');
    }
    
    const startDate = input.start_date || existing.start_date;
    const endDate = input.end_date || existing.end_date;
    
    const dateValidation = validatePromoDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      throw new Error(dateValidation.error);
    }
  }

  const { data, error } = await supabase
    .from('promos')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      promo_products (
        id,
        product_id,
        products:product_id (name)
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update promo: ${error.message}`);
  }

  return {
    ...data,
    product_count: data.promo_products?.length || 0,
    products: data.promo_products?.map((pp: { id: string; product_id: string; products?: { name: string } }) => ({
      id: pp.id,
      promo_id: data.id,
      product_id: pp.product_id,
      product_name: pp.products?.name,
    })),
  } as Promo;
}

/**
 * Delete a promo and all associated products
 * Requirements: 3.5
 */
export async function deletePromo(id: string): Promise<void> {
  // promo_products will be deleted automatically due to CASCADE
  const { error } = await supabase
    .from('promos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete promo: ${error.message}`);
  }
}

// ============================================
// Promo Product Functions
// Requirements: 2.3
// ============================================

/**
 * Add products to a promo
 * Requirements: 2.3
 */
export async function addProductsToPromo(promoId: string, productIds: string[]): Promise<void> {
  if (!productIds || productIds.length === 0) {
    throw new Error('Pilih minimal satu produk');
  }

  const promoProducts = productIds.map(productId => ({
    promo_id: promoId,
    product_id: productId,
  }));

  const { error } = await supabase
    .from('promo_products')
    .upsert(promoProducts, { onConflict: 'promo_id,product_id' });

  if (error) {
    throw new Error(`Failed to add products to promo: ${error.message}`);
  }
}

/**
 * Remove a product from a promo
 * Requirements: 2.3
 */
export async function removeProductFromPromo(promoId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('promo_products')
    .delete()
    .eq('promo_id', promoId)
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to remove product from promo: ${error.message}`);
  }
}

/**
 * Get all products for a promo
 */
export async function getPromoProducts(promoId: string): Promise<PromoProduct[]> {
  const { data, error } = await supabase
    .from('promo_products')
    .select(`
      *,
      products:product_id (name)
    `)
    .eq('promo_id', promoId);

  if (error) {
    throw new Error(`Failed to fetch promo products: ${error.message}`);
  }

  return (data || []).map(pp => ({
    ...pp,
    product_name: pp.products?.name,
  })) as PromoProduct[];
}
