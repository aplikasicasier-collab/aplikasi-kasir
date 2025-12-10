import { supabase } from '@/lib/supabaseClient';
import { Category } from '@/types';

/**
 * List all categories
 */
export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return data as Category[];
}

/**
 * Create a new category
 */
export async function createCategory(
  data: Omit<Category, 'id' | 'created_at'>
): Promise<Category> {
  const { data: category, error } = await supabase
    .from('categories')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }

  return category as Category;
}

/**
 * Update a category
 */
export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, 'id' | 'created_at'>>
): Promise<Category> {
  const { data: category, error } = await supabase
    .from('categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }

  return category as Category;
}

/**
 * Delete a category (only if no products assigned)
 */
export async function deleteCategory(id: string): Promise<void> {
  // Check if category has products
  const productCount = await getCategoryProductCount(id);
  
  if (productCount > 0) {
    throw new Error(`Tidak dapat menghapus kategori. Masih ada ${productCount} produk yang menggunakan kategori ini.`);
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}

/**
 * Get count of products in a category
 */
export async function getCategoryProductCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId);

  if (error) {
    throw new Error(`Failed to count products: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as Category;
}
