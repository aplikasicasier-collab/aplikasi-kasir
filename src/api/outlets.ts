import { supabase } from '@/lib/supabaseClient';
import { Outlet } from '@/types';

/**
 * Input type for creating an outlet
 */
export interface CreateOutletInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Input type for updating an outlet
 */
export interface UpdateOutletInput {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

/**
 * Generates a unique outlet code with format OUT-XXXX
 * XXXX is a random 4-digit alphanumeric string
 */
export function generateOutletCodeSync(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'OUT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generates a unique outlet code, checking database for uniqueness
 * Retries up to 3 times if code already exists
 */
export async function generateOutletCode(): Promise<string> {
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateOutletCodeSync();
    
    // Check if code already exists
    const { data, error } = await supabase
      .from('outlets')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to check outlet code: ${error.message}`);
    }
    
    // If no existing outlet with this code, return it
    if (!data) {
      return code;
    }
  }
  
  throw new Error('Failed to generate unique outlet code after 3 attempts');
}


/**
 * Create a new outlet
 * Generates a unique code and stores outlet data
 */
export async function createOutlet(input: CreateOutletInput): Promise<Outlet> {
  const code = await generateOutletCode();
  
  const { data, error } = await supabase
    .from('outlets')
    .insert({
      code,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create outlet: ${error.message}`);
  }

  return data as Outlet;
}

/**
 * Get all outlets, optionally including inactive ones
 */
export async function getOutlets(includeInactive: boolean = false): Promise<Outlet[]> {
  let query = supabase
    .from('outlets')
    .select('*')
    .order('name');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch outlets: ${error.message}`);
  }

  return data as Outlet[];
}

/**
 * Get outlet by ID
 */
export async function getOutletById(id: string): Promise<Outlet | null> {
  const { data, error } = await supabase
    .from('outlets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as Outlet;
}

/**
 * Update an outlet
 */
export async function updateOutlet(
  id: string,
  input: UpdateOutletInput
): Promise<Outlet> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.address !== undefined) {
    updateData.address = input.address?.trim() || null;
  }
  if (input.phone !== undefined) {
    updateData.phone = input.phone?.trim() || null;
  }
  if (input.email !== undefined) {
    updateData.email = input.email?.trim() || null;
  }
  if (input.is_active !== undefined) {
    updateData.is_active = input.is_active;
  }

  const { data, error } = await supabase
    .from('outlets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update outlet: ${error.message}`);
  }

  return data as Outlet;
}

/**
 * Deactivate an outlet (soft delete)
 */
export async function deactivateOutlet(id: string): Promise<Outlet> {
  const { data, error } = await supabase
    .from('outlets')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to deactivate outlet: ${error.message}`);
  }

  return data as Outlet;
}
