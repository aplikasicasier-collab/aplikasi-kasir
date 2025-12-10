import { supabase } from '@/lib/supabaseClient';
import { Return, ReturnStatus, getReturnById } from './returns';

// ============================================
// Types
// Requirements: 7.2, 7.3, 7.4
// ============================================

export interface ApprovalInput {
  return_id: string;
  reason: string;
}

export interface ApprovalResult {
  success: boolean;
  return_id: string;
  status: ReturnStatus;
  approved_by?: string;
  approval_reason?: string;
  rejected_reason?: string;
}

// ============================================
// Pure Functions for Testing
// Requirements: 7.2, 7.3, 7.4
// ============================================

/**
 * Check if a return is pending approval
 * Requirements: 7.4
 */
export function isPendingApproval(returnData: Return): boolean {
  return returnData.status === 'pending_approval' && returnData.requires_approval === true;
}

/**
 * Filter returns to get only pending approvals
 * Requirements: 7.4
 * 
 * **Feature: retur-refund, Property 10: Pending Approvals List**
 * **Validates: Requirements 7.4**
 */
export function filterPendingApprovals(returns: Return[]): Return[] {
  return returns.filter(isPendingApproval);
}

/**
 * Validate approval input
 * Requirements: 7.2, 7.3
 */
export function validateApprovalInput(input: ApprovalInput): { valid: boolean; error?: string } {
  if (!input.return_id || input.return_id.trim() === '') {
    return { valid: false, error: 'Return ID is required' };
  }
  
  if (!input.reason || input.reason.trim() === '') {
    return { valid: false, error: 'Reason is required' };
  }
  
  return { valid: true };
}

/**
 * Simulate approval state transition
 * Requirements: 7.2
 * 
 * **Feature: retur-refund, Property 9: Approval Workflow**
 * **Validates: Requirements 7.2, 7.3**
 */
export function simulateApproval(
  returnData: Return,
  approverId: string,
  reason: string
): Return {
  return {
    ...returnData,
    status: 'approved',
    approved_by: approverId,
    approval_reason: reason,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simulate rejection state transition
 * Requirements: 7.3
 */
export function simulateRejection(
  returnData: Return,
  reason: string
): Return {
  return {
    ...returnData,
    status: 'rejected',
    rejected_reason: reason,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Check if return can be approved or rejected
 * Requirements: 7.2, 7.3
 */
export function canBeApprovedOrRejected(returnData: Return): { canProcess: boolean; error?: string } {
  if (returnData.status === 'completed') {
    return { canProcess: false, error: 'Retur sudah selesai' };
  }
  
  if (returnData.status === 'cancelled') {
    return { canProcess: false, error: 'Retur sudah dibatalkan' };
  }
  
  if (returnData.status === 'rejected') {
    return { canProcess: false, error: 'Retur sudah ditolak' };
  }
  
  if (returnData.status === 'approved') {
    return { canProcess: false, error: 'Retur sudah disetujui' };
  }
  
  if (returnData.status !== 'pending_approval') {
    return { canProcess: false, error: 'Retur tidak dalam status menunggu persetujuan' };
  }
  
  return { canProcess: true };
}

// ============================================
// Database Functions
// Requirements: 7.2, 7.3, 7.4
// ============================================

/**
 * Get all returns pending approval
 * Requirements: 7.4
 */
export async function getPendingApprovals(): Promise<Return[]> {
  const { data, error } = await supabase
    .from('returns')
    .select(`
      *,
      return_items (
        *,
        products (id, name)
      ),
      transactions (*)
    `)
    .eq('status', 'pending_approval')
    .eq('requires_approval', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pending approvals: ${error.message}`);
  }

  return (data || []).map(ret => ({
    ...ret,
    transaction: ret.transactions,
    items: (ret.return_items || []).map((item: { products?: { name: string } }) => ({
      ...item,
      product_name: item.products?.name,
    })),
  })) as Return[];
}

/**
 * Approve a return
 * Records the approver and approval reason
 * Requirements: 7.2
 */
export async function approveReturn(input: ApprovalInput): Promise<Return> {
  const { return_id, reason } = input;

  // Validate input
  const validation = validateApprovalInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get return data
  const returnData = await getReturnById(return_id);
  if (!returnData) {
    throw new Error('Retur tidak ditemukan');
  }

  // Check if can be approved
  const canProcess = canBeApprovedOrRejected(returnData);
  if (!canProcess.canProcess) {
    throw new Error(canProcess.error);
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Update return status to approved
  const { data: updatedReturn, error: updateError } = await supabase
    .from('returns')
    .update({
      status: 'approved',
      approved_by: user?.id,
      approval_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', return_id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to approve return: ${updateError.message}`);
  }

  return {
    ...updatedReturn,
    items: returnData.items,
    transaction: returnData.transaction,
  } as Return;
}

/**
 * Reject a return
 * Records the rejection reason
 * Requirements: 7.3
 */
export async function rejectReturn(input: ApprovalInput): Promise<Return> {
  const { return_id, reason } = input;

  // Validate input
  const validation = validateApprovalInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get return data
  const returnData = await getReturnById(return_id);
  if (!returnData) {
    throw new Error('Retur tidak ditemukan');
  }

  // Check if can be rejected
  const canProcess = canBeApprovedOrRejected(returnData);
  if (!canProcess.canProcess) {
    throw new Error(canProcess.error);
  }

  // Update return status to rejected
  const { data: updatedReturn, error: updateError } = await supabase
    .from('returns')
    .update({
      status: 'rejected',
      rejected_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', return_id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to reject return: ${updateError.message}`);
  }

  return {
    ...updatedReturn,
    items: returnData.items,
    transaction: returnData.transaction,
  } as Return;
}
