/**
 * Barcode API
 * Provides barcode lookup and assignment functions for products
 */

import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';
import { validateBarcodeFormat, BarcodeValidation } from '../lib/barcodeUtils';

export interface ProductLookupResult {
  found: boolean;
  product?: Product;
  error?: string;
}

/**
 * Look up a product by its barcode
 * Returns the product if found, or a not found error
 * Requirements: 1.3, 4.2
 */
export async function lookupProductByBarcode(barcode: string): Promise<ProductLookupResult> {
  if (!barcode || barcode.trim().length === 0) {
    return {
      found: false,
      error: 'Barcode tidak boleh kosong'
    };
  }

  const trimmedBarcode = barcode.trim();

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,barcode,price,stock_quantity,min_stock,is_active,created_at,updated_at')
      .eq('barcode', trimmedBarcode)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return {
          found: false,
          error: 'Produk tidak ditemukan'
        };
      }
      throw error;
    }

    if (!data) {
      return {
        found: false,
        error: 'Produk tidak ditemukan'
      };
    }

    return {
      found: true,
      product: data as Product
    };
  } catch (err) {
    return {
      found: false,
      error: err instanceof Error ? err.message : 'Terjadi kesalahan saat mencari produk'
    };
  }
}

/**
 * Check if a barcode is unique (not assigned to any other product)
 * Requirements: 3.2
 */
export async function checkBarcodeUniqueness(
  barcode: string,
  excludeProductId?: string
): Promise<boolean> {
  if (!barcode || barcode.trim().length === 0) {
    return false;
  }

  const trimmedBarcode = barcode.trim();

  try {
    let query = supabase
      .from('products')
      .select('id')
      .eq('barcode', trimmedBarcode);

    if (excludeProductId) {
      query = query.neq('id', excludeProductId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Barcode is unique if no products found with this barcode
    return !data || data.length === 0;
  } catch {
    // On error, assume not unique for safety
    return false;
  }
}

/**
 * Assign a barcode to a product
 * Validates format and uniqueness before assignment
 * Requirements: 3.1, 3.2
 */
export async function assignBarcodeToProduct(
  productId: string,
  barcode: string
): Promise<{ success: boolean; error?: string }> {
  if (!productId) {
    return {
      success: false,
      error: 'Product ID tidak boleh kosong'
    };
  }

  if (!barcode || barcode.trim().length === 0) {
    return {
      success: false,
      error: 'Barcode tidak boleh kosong'
    };
  }

  const trimmedBarcode = barcode.trim();

  // Validate barcode format
  const validation: BarcodeValidation = validateBarcodeFormat(trimmedBarcode);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || 'Format barcode tidak valid'
    };
  }

  // Check uniqueness
  const isUnique = await checkBarcodeUniqueness(trimmedBarcode, productId);
  if (!isUnique) {
    return {
      success: false,
      error: 'Barcode sudah digunakan produk lain'
    };
  }

  try {
    const { error } = await supabase
      .from('products')
      .update({ barcode: trimmedBarcode, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan barcode'
    };
  }
}

export { validateBarcodeFormat, type BarcodeValidation };
