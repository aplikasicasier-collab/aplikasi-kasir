import { supabase } from '@/lib/supabaseClient';
import { Supplier } from '@/types';

/**
 * List all suppliers
 */
export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch suppliers: ${error.message}`);
  }

  return data as Supplier[];
}

/**
 * Input type for creating a supplier
 */
export interface CreateSupplierInput {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
}

/**
 * Create a new supplier
 */
export async function createSupplier(
  data: CreateSupplierInput
): Promise<Supplier> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .insert({
      ...data,
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create supplier: ${error.message}`);
  }

  return supplier as Supplier;
}

/**
 * Update a supplier
 */
export async function updateSupplier(
  id: string,
  data: Partial<Omit<Supplier, 'id' | 'created_at'>>
): Promise<Supplier> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update supplier: ${error.message}`);
  }

  return supplier as Supplier;
}

/**
 * Delete a supplier (only if no products assigned)
 */
export async function deleteSupplier(id: string): Promise<void> {
  // Check if supplier has products
  const productCount = await getSupplierProductCount(id);
  
  if (productCount > 0) {
    throw new Error(`Tidak dapat menghapus supplier. Masih ada ${productCount} produk yang menggunakan supplier ini.`);
  }

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete supplier: ${error.message}`);
  }
}

/**
 * Get count of products from a supplier
 */
export async function getSupplierProductCount(supplierId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', supplierId);

  if (error) {
    throw new Error(`Failed to count products: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as Supplier;
}
