import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';
import { AuditLogger } from '../lib/auditLogger';

// Create
// Requirements: 1.1 - Log create event with entity type, entity ID, user ID, and timestamp
export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();
  if (error) throw error;
  
  // Log product creation
  await AuditLogger.logCreate('product', data.id, data as Record<string, unknown>);
  
  return data;
}

// Read
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Update
// Requirements: 1.2 - Log update event with old and new values
// Requirements: 2.5 - Log price changes specifically
export async function updateProduct(id: string, updates: Partial<Product>) {
  // Get old values before update
  const { data: oldData, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  
  // Check if price changed - log as price_change event
  if (updates.price !== undefined && oldData.price !== updates.price) {
    await AuditLogger.logEvent('price_change', 'product', id, {
      old_price: oldData.price,
      new_price: updates.price,
      product_name: data.name,
    });
  }
  
  // Log general update
  await AuditLogger.logUpdate('product', id, oldData as Record<string, unknown>, data as Record<string, unknown>);
  
  return data;
}

// Delete
// Requirements: 1.3 - Log delete event with deleted data snapshot
export async function deleteProduct(id: string) {
  // Get data before delete for audit log
  const { data: oldData, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
  
  // Log product deletion with snapshot
  await AuditLogger.logDelete('product', id, oldData as Record<string, unknown>);
}

// Upload Image
export async function uploadProductImage(file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('products')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('products').getPublicUrl(filePath);
  return data.publicUrl;
}
