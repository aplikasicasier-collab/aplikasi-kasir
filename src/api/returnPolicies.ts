import { supabase } from '@/lib/supabaseClient';
import { Transaction } from '@/types';

// ============================================
// Types
// Requirements: 3.1, 3.3
// ============================================

export interface ReturnPolicy {
  id: string;
  max_return_days: number;
  non_returnable_categories: string[];
  require_receipt: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateReturnPolicyInput {
  max_return_days?: number;
  non_returnable_categories?: string[];
  require_receipt?: boolean;
  is_active?: boolean;
}

export interface PolicyCheckResult {
  allowed: boolean;
  requires_approval: boolean;
  reason?: string;
}

// ============================================
// Return Policy CRUD Functions
// Requirements: 3.1, 3.3
// ============================================

/**
 * Get the active return policy
 * Requirements: 3.1 - Allow setting maximum days for return eligibility
 */
export async function getReturnPolicy(): Promise<ReturnPolicy | null> {
  const { data, error } = await supabase
    .from('return_policies')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch return policy: ${error.message}`);
  }

  return data as ReturnPolicy | null;
}

/**
 * Update the return policy
 * Requirements: 3.1, 3.3 - Allow setting max days and non-returnable categories
 */
export async function updateReturnPolicy(input: UpdateReturnPolicyInput): Promise<ReturnPolicy> {
  // First get the active policy
  const currentPolicy = await getReturnPolicy();
  
  if (!currentPolicy) {
    // Create a new policy if none exists
    const { data, error } = await supabase
      .from('return_policies')
      .insert({
        max_return_days: input.max_return_days ?? 7,
        non_returnable_categories: input.non_returnable_categories ?? [],
        require_receipt: input.require_receipt ?? true,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create return policy: ${error.message}`);
    }

    return data as ReturnPolicy;
  }

  // Update existing policy
  const { data, error } = await supabase
    .from('return_policies')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', currentPolicy.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update return policy: ${error.message}`);
  }

  return data as ReturnPolicy;
}


// ============================================
// Policy Check Functions
// Requirements: 3.2, 3.4
// ============================================

/**
 * Calculate the number of days between two dates
 */
export function calculateDaysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / oneDay);
}

/**
 * Check if a return is eligible based on the policy
 * Requirements: 3.2 - Display warning and require manager approval if beyond policy period
 * 
 * @param transaction - The original transaction
 * @param policy - The return policy to check against
 * @returns PolicyCheckResult indicating if return is allowed and if approval is required
 */
export function checkReturnEligibility(
  transaction: Transaction,
  policy: ReturnPolicy
): PolicyCheckResult {
  const transactionDate = new Date(transaction.transaction_date);
  const currentDate = new Date();
  
  const daysSinceTransaction = calculateDaysBetween(transactionDate, currentDate);
  
  // Check if transaction is within the return period
  if (daysSinceTransaction > policy.max_return_days) {
    return {
      allowed: true, // Still allowed but requires approval
      requires_approval: true,
      reason: `Transaksi sudah melewati batas waktu retur (${policy.max_return_days} hari). Memerlukan persetujuan manager.`,
    };
  }
  
  return {
    allowed: true,
    requires_approval: false,
  };
}

/**
 * Check if a product is returnable based on its category
 * Requirements: 3.4 - Prevent return and display policy message for non-returnable products
 * 
 * @param productCategoryId - The category ID of the product
 * @param policy - The return policy to check against
 * @returns PolicyCheckResult indicating if the product can be returned
 */
export function isProductReturnable(
  productCategoryId: string | null | undefined,
  policy: ReturnPolicy
): PolicyCheckResult {
  // If product has no category, it's returnable
  if (!productCategoryId) {
    return {
      allowed: true,
      requires_approval: false,
    };
  }
  
  // Check if the product's category is in the non-returnable list
  const isNonReturnable = policy.non_returnable_categories.includes(productCategoryId);
  
  if (isNonReturnable) {
    return {
      allowed: false,
      requires_approval: false,
      reason: 'Produk tidak dapat diretur sesuai kebijakan toko',
    };
  }
  
  return {
    allowed: true,
    requires_approval: false,
  };
}

/**
 * Combined check for return eligibility (date + product category)
 * Requirements: 3.2, 3.4
 * 
 * @param transaction - The original transaction
 * @param productCategoryId - The category ID of the product being returned
 * @param policy - The return policy to check against
 * @returns PolicyCheckResult with combined result
 */
export function checkFullReturnEligibility(
  transaction: Transaction,
  productCategoryId: string | null | undefined,
  policy: ReturnPolicy
): PolicyCheckResult {
  // First check if product is returnable
  const productCheck = isProductReturnable(productCategoryId, policy);
  if (!productCheck.allowed) {
    return productCheck;
  }
  
  // Then check date eligibility
  const dateCheck = checkReturnEligibility(transaction, policy);
  
  return dateCheck;
}
