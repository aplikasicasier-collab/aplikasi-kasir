import { supabase } from '@/lib/supabaseClient';
import { Outlet, UserOutlet } from '@/types';

/**
 * Input type for assigning user to outlets
 */
export interface UserOutletAssignment {
  user_id: string;
  outlet_ids: string[];
  default_outlet_id?: string;
}

/**
 * Assign a user to one or multiple outlets
 * Replaces existing assignments with new ones
 * Requirements: 2.1, 2.2
 */
export async function assignUserToOutlets(
  assignment: UserOutletAssignment
): Promise<void> {
  const { user_id, outlet_ids, default_outlet_id } = assignment;

  if (!user_id) {
    throw new Error('User ID is required');
  }

  if (!outlet_ids || outlet_ids.length === 0) {
    throw new Error('At least one outlet must be assigned');
  }

  // Validate default outlet is in the assigned outlets
  if (default_outlet_id && !outlet_ids.includes(default_outlet_id)) {
    throw new Error('Default outlet must be one of the assigned outlets');
  }

  // Delete existing assignments for this user
  const { error: deleteError } = await supabase
    .from('user_outlets')
    .delete()
    .eq('user_id', user_id);

  if (deleteError) {
    throw new Error(`Failed to clear existing assignments: ${deleteError.message}`);
  }

  // Create new assignments
  const assignments = outlet_ids.map((outlet_id) => ({
    user_id,
    outlet_id,
    is_default: outlet_id === default_outlet_id,
  }));

  const { error: insertError } = await supabase
    .from('user_outlets')
    .insert(assignments);

  if (insertError) {
    throw new Error(`Failed to assign user to outlets: ${insertError.message}`);
  }
}


/**
 * Get all outlets assigned to a user
 * Returns full outlet objects with assignment info
 * Requirements: 2.3
 */
export async function getUserOutlets(userId: string): Promise<Outlet[]> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const { data, error } = await supabase
    .from('user_outlets')
    .select(`
      outlet_id,
      is_default,
      outlets (*)
    `)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch user outlets: ${error.message}`);
  }

  // Extract outlet objects from the joined data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || [])
    .filter((item: any) => item.outlets !== null)
    .map((item: any) => item.outlets as Outlet);
}

/**
 * Get user outlet assignments with default flag
 * Returns UserOutlet records for a user
 */
export async function getUserOutletAssignments(userId: string): Promise<UserOutlet[]> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const { data, error } = await supabase
    .from('user_outlets')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch user outlet assignments: ${error.message}`);
  }

  return data as UserOutlet[];
}

/**
 * Get the default outlet for a user
 * Returns null if no default is set
 * Requirements: 7.2
 */
export async function getDefaultOutlet(userId: string): Promise<Outlet | null> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const { data, error } = await supabase
    .from('user_outlets')
    .select(`
      outlets (*)
    `)
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch default outlet: ${error.message}`);
  }

  if (!data || !data.outlets) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.outlets as unknown as Outlet;
}

/**
 * Set a specific outlet as the default for a user
 * The outlet must already be assigned to the user
 * Requirements: 7.1
 */
export async function setDefaultOutlet(
  userId: string,
  outletId: string
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!outletId) {
    throw new Error('Outlet ID is required');
  }

  // Check if user is assigned to this outlet
  const { data: assignment, error: checkError } = await supabase
    .from('user_outlets')
    .select('id')
    .eq('user_id', userId)
    .eq('outlet_id', outletId)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check outlet assignment: ${checkError.message}`);
  }

  if (!assignment) {
    throw new Error('User is not assigned to this outlet');
  }

  // Clear existing default (database trigger handles this, but we do it explicitly for clarity)
  const { error: clearError } = await supabase
    .from('user_outlets')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);

  if (clearError) {
    throw new Error(`Failed to clear existing default: ${clearError.message}`);
  }

  // Set new default
  const { error: updateError } = await supabase
    .from('user_outlets')
    .update({ is_default: true })
    .eq('user_id', userId)
    .eq('outlet_id', outletId);

  if (updateError) {
    throw new Error(`Failed to set default outlet: ${updateError.message}`);
  }
}

/**
 * Remove a user from a specific outlet
 * Cannot remove if it's the user's only outlet
 * Requirements: 2.1
 */
export async function removeUserFromOutlet(
  userId: string,
  outletId: string
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!outletId) {
    throw new Error('Outlet ID is required');
  }

  // Check how many outlets the user has
  const { data: assignments, error: countError } = await supabase
    .from('user_outlets')
    .select('id')
    .eq('user_id', userId);

  if (countError) {
    throw new Error(`Failed to check user outlets: ${countError.message}`);
  }

  if (!assignments || assignments.length <= 1) {
    throw new Error('Cannot remove user from their only outlet');
  }

  // Delete the assignment
  const { error: deleteError } = await supabase
    .from('user_outlets')
    .delete()
    .eq('user_id', userId)
    .eq('outlet_id', outletId);

  if (deleteError) {
    throw new Error(`Failed to remove user from outlet: ${deleteError.message}`);
  }
}

/**
 * Get all users assigned to a specific outlet
 */
export async function getOutletUsers(outletId: string): Promise<string[]> {
  if (!outletId) {
    throw new Error('Outlet ID is required');
  }

  const { data, error } = await supabase
    .from('user_outlets')
    .select('user_id')
    .eq('outlet_id', outletId);

  if (error) {
    throw new Error(`Failed to fetch outlet users: ${error.message}`);
  }

  return (data || []).map((item: { user_id: string }) => item.user_id);
}

/**
 * Check if a user has access to a specific outlet
 * Admin users have access to all outlets
 * Requirements: 2.5
 */
export async function userHasOutletAccess(
  userId: string,
  outletId: string,
  userRole?: string
): Promise<boolean> {
  // Admin users have access to all outlets
  if (userRole === 'admin') {
    return true;
  }

  const { data, error } = await supabase
    .from('user_outlets')
    .select('id')
    .eq('user_id', userId)
    .eq('outlet_id', outletId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check outlet access: ${error.message}`);
  }

  return data !== null;
}
