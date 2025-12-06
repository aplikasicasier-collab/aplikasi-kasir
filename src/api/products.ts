import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';

export async function listActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id,name,barcode,price,stock_quantity,min_stock,is_active,created_at,updated_at')
    .eq('is_active', true)
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function searchProducts(term: string): Promise<Product[]> {
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from('products')
    .select('id,name,barcode,price,stock_quantity,min_stock,is_active,created_at,updated_at')
    .eq('is_active', true)
    .or(`name.ilike.${pattern},barcode.ilike.${pattern}`)
    .limit(50);
  if (error) throw error;
  return data || [];
}
