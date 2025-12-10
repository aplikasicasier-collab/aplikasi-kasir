import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isPendingApproval,
  filterPendingApprovals,
  validateApprovalInput,
  simulateApproval,
  simulateRejection,
  canBeApprovedOrRejected,
  ApprovalInput,
} from './returnApprovals';
import { Return, ReturnStatus, ReturnReason } from './returns';

// ============================================
// Helpers
// ============================================

function createMockReturn(overrides: Partial<Return> = {}): Return {
  return {
    id: 'test-return-id',
    return_number: 'RTN-20241208-0001',
    transaction_id: 'test-transaction-id',
    outlet_id: null,
    status: 'pending_approval',
    total_refund: 50000,
    refund_method: null,
    requires_approval: true,
    approved_by: null,
    approval_reason: null,
    rejected_reason: null,
    notes: null,
    created_by: 'test-user-id',
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [],
    ...overrides,
  };
}

// Arbitrary for generating valid return statuses
const returnStatusArb = fc.constantFrom<ReturnStatus>(
  'pending_approval',
  'approved',
  'completed',
  'rejected',
  'cancelled'
);

// Arbitrary for generating return reasons
const returnReasonArb = fc.constantFrom<ReturnReason>(
  'damaged',
  'wrong_product',
  'not_as_described',
  'changed_mind',
  'other'
);

// Arbitrary for generating valid dates
const validDateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).filter(d => !isNaN(d.getTime()));

// Arbitrary for generating mock returns
const mockReturnArb = fc.record({
  id: fc.uuid(),
  return_number: fc.constant('RTN-20241208-0001'),
  transaction_id: fc.uuid(),
  outlet_id: fc.option(fc.uuid(), { nil: null }),
  status: returnStatusArb,
  total_refund: fc.integer({ min: 1000, max: 1000000 }),
  refund_method: fc.option(fc.constantFrom('cash', 'card', 'e-wallet'), { nil: null }),
  requires_approval: fc.boolean(),
  approved_by: fc.option(fc.uuid(), { nil: null }),
  approval_reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  rejected_reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  notes: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  created_by: fc.uuid(),
  completed_at: fc.option(validDateArb.map(d => d.toISOString()), { nil: null }),
  created_at: validDateArb.map(d => d.toISOString()),
  updated_at: validDateArb.map(d => d.toISOString()),
  items: fc.constant([]),
}) as fc.Arbitrary<Return>;

// ============================================
// Property 9: Approval Workflow
// **Feature: retur-refund, Property 9: Approval Workflow**
// **Validates: Requirements 7.2, 7.3**
// ============================================

describe('Property 9: Approval Workflow', () => {
  /**
   * Property 9.1: When approved, return records approver_id and approval_reason
   */
  it('Property 9.1: When approved, return records approver_id and approval_reason', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // approverId
        fc.string({ minLength: 1, maxLength: 200 }), // reason
        (approverId, reason) => {
          const returnData = createMockReturn({
            status: 'pending_approval',
            requires_approval: true,
          });

          const result = simulateApproval(returnData, approverId, reason);

          // Should record approver_id
          if (result.approved_by !== approverId) return false;
          
          // Should record approval_reason
          if (result.approval_reason !== reason) return false;
          
          // Status should be 'approved'
          if (result.status !== 'approved') return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: When rejected, return records rejected_reason and status is 'rejected'
   */
  it('Property 9.2: When rejected, return records rejected_reason and status is rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }), // reason
        (reason) => {
          const returnData = createMockReturn({
            status: 'pending_approval',
            requires_approval: true,
          });

          const result = simulateRejection(returnData, reason);

          // Should record rejected_reason
          if (result.rejected_reason !== reason) return false;
          
          // Status should be 'rejected'
          if (result.status !== 'rejected') return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: Approval preserves other return data
   */
  it('Property 9.3: Approval preserves other return data', () => {
    fc.assert(
      fc.property(
        mockReturnArb.filter(r => r.status === 'pending_approval'),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        (returnData, approverId, reason) => {
          const result = simulateApproval(returnData, approverId, reason);

          // Should preserve original data
          if (result.id !== returnData.id) return false;
          if (result.return_number !== returnData.return_number) return false;
          if (result.transaction_id !== returnData.transaction_id) return false;
          if (result.total_refund !== returnData.total_refund) return false;
          if (result.created_by !== returnData.created_by) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.4: Rejection preserves other return data
   */
  it('Property 9.4: Rejection preserves other return data', () => {
    fc.assert(
      fc.property(
        mockReturnArb.filter(r => r.status === 'pending_approval'),
        fc.string({ minLength: 1, maxLength: 200 }),
        (returnData, reason) => {
          const result = simulateRejection(returnData, reason);

          // Should preserve original data
          if (result.id !== returnData.id) return false;
          if (result.return_number !== returnData.return_number) return false;
          if (result.transaction_id !== returnData.transaction_id) return false;
          if (result.total_refund !== returnData.total_refund) return false;
          if (result.created_by !== returnData.created_by) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.5: Only pending_approval returns can be approved or rejected
   */
  it('Property 9.5: Only pending_approval returns can be approved or rejected', () => {
    fc.assert(
      fc.property(
        returnStatusArb,
        (status) => {
          const returnData = createMockReturn({ status });
          const result = canBeApprovedOrRejected(returnData);

          if (status === 'pending_approval') {
            // Should be processable
            return result.canProcess === true;
          } else {
            // Should NOT be processable
            return result.canProcess === false && result.error !== undefined;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.6: Approval input validation requires return_id and reason
   */
  it('Property 9.6: Approval input validation requires return_id and reason', () => {
    fc.assert(
      fc.property(
        fc.option(fc.uuid(), { nil: '' }),
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: '' }),
        (returnId, reason) => {
          const input: ApprovalInput = {
            return_id: returnId || '',
            reason: reason || '',
          };

          const result = validateApprovalInput(input);

          const hasValidReturnId = returnId !== null && returnId !== '';
          const hasValidReason = reason !== null && reason !== '';

          if (hasValidReturnId && hasValidReason) {
            return result.valid === true;
          } else {
            return result.valid === false && result.error !== undefined;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 10: Pending Approvals List
// **Feature: retur-refund, Property 10: Pending Approvals List**
// **Validates: Requirements 7.4**
// ============================================

describe('Property 10: Pending Approvals List', () => {
  /**
   * Property 10.1: isPendingApproval returns true only for pending_approval status with requires_approval=true
   */
  it('Property 10.1: isPendingApproval returns true only for correct conditions', () => {
    fc.assert(
      fc.property(
        returnStatusArb,
        fc.boolean(), // requires_approval
        (status, requiresApproval) => {
          const returnData = createMockReturn({
            status,
            requires_approval: requiresApproval,
          });

          const result = isPendingApproval(returnData);

          // Should return true only when status is 'pending_approval' AND requires_approval is true
          const expected = status === 'pending_approval' && requiresApproval === true;
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: filterPendingApprovals returns only returns with status='pending_approval' AND requires_approval=true
   */
  it('Property 10.2: filterPendingApprovals returns only pending approvals', () => {
    fc.assert(
      fc.property(
        fc.array(mockReturnArb, { minLength: 0, maxLength: 20 }),
        (returns) => {
          const result = filterPendingApprovals(returns);

          // All results should have status='pending_approval' AND requires_approval=true
          for (const ret of result) {
            if (ret.status !== 'pending_approval') return false;
            if (ret.requires_approval !== true) return false;
          }

          // Count expected pending approvals
          const expectedCount = returns.filter(
            r => r.status === 'pending_approval' && r.requires_approval === true
          ).length;

          return result.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.3: filterPendingApprovals excludes non-pending returns
   */
  it('Property 10.3: filterPendingApprovals excludes non-pending returns', () => {
    fc.assert(
      fc.property(
        fc.array(
          mockReturnArb.filter(r => r.status !== 'pending_approval'),
          { minLength: 1, maxLength: 10 }
        ),
        (nonPendingReturns) => {
          const result = filterPendingApprovals(nonPendingReturns);

          // Should return empty array since none are pending_approval
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.4: filterPendingApprovals excludes returns where requires_approval=false
   */
  it('Property 10.4: filterPendingApprovals excludes returns where requires_approval=false', () => {
    fc.assert(
      fc.property(
        fc.array(
          mockReturnArb.map(r => ({ ...r, status: 'pending_approval' as ReturnStatus, requires_approval: false })),
          { minLength: 1, maxLength: 10 }
        ),
        (returnsWithoutApprovalRequired) => {
          const result = filterPendingApprovals(returnsWithoutApprovalRequired);

          // Should return empty array since requires_approval is false
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.5: filterPendingApprovals preserves all pending approval returns
   */
  it('Property 10.5: filterPendingApprovals preserves all pending approval returns', () => {
    fc.assert(
      fc.property(
        fc.array(
          mockReturnArb.map(r => ({ ...r, status: 'pending_approval' as ReturnStatus, requires_approval: true })),
          { minLength: 1, maxLength: 10 }
        ),
        (pendingReturns) => {
          const result = filterPendingApprovals(pendingReturns);

          // Should return all returns since all are pending_approval with requires_approval=true
          return result.length === pendingReturns.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.6: filterPendingApprovals correctly handles mixed returns
   */
  it('Property 10.6: filterPendingApprovals correctly handles mixed returns', () => {
    fc.assert(
      fc.property(
        fc.array(mockReturnArb, { minLength: 0, maxLength: 20 }),
        (mixedReturns) => {
          const result = filterPendingApprovals(mixedReturns);
          const resultIds = new Set(result.map(r => r.id));

          // Verify each original return is correctly included or excluded
          for (const ret of mixedReturns) {
            const shouldBeIncluded = ret.status === 'pending_approval' && ret.requires_approval === true;
            const isIncluded = resultIds.has(ret.id);

            if (shouldBeIncluded !== isIncluded) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Unit Tests
// ============================================

describe('Approval Functions Unit Tests', () => {
  describe('isPendingApproval', () => {
    it('returns true for pending_approval with requires_approval=true', () => {
      const returnData = createMockReturn({
        status: 'pending_approval',
        requires_approval: true,
      });
      expect(isPendingApproval(returnData)).toBe(true);
    });

    it('returns false for pending_approval with requires_approval=false', () => {
      const returnData = createMockReturn({
        status: 'pending_approval',
        requires_approval: false,
      });
      expect(isPendingApproval(returnData)).toBe(false);
    });

    it('returns false for approved status', () => {
      const returnData = createMockReturn({
        status: 'approved',
        requires_approval: true,
      });
      expect(isPendingApproval(returnData)).toBe(false);
    });

    it('returns false for completed status', () => {
      const returnData = createMockReturn({
        status: 'completed',
        requires_approval: true,
      });
      expect(isPendingApproval(returnData)).toBe(false);
    });
  });

  describe('validateApprovalInput', () => {
    it('returns valid for complete input', () => {
      const input: ApprovalInput = {
        return_id: 'test-id',
        reason: 'Test reason',
      };
      expect(validateApprovalInput(input)).toEqual({ valid: true });
    });

    it('returns invalid for empty return_id', () => {
      const input: ApprovalInput = {
        return_id: '',
        reason: 'Test reason',
      };
      const result = validateApprovalInput(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for empty reason', () => {
      const input: ApprovalInput = {
        return_id: 'test-id',
        reason: '',
      };
      const result = validateApprovalInput(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns invalid for whitespace-only return_id', () => {
      const input: ApprovalInput = {
        return_id: '   ',
        reason: 'Test reason',
      };
      const result = validateApprovalInput(input);
      expect(result.valid).toBe(false);
    });

    it('returns invalid for whitespace-only reason', () => {
      const input: ApprovalInput = {
        return_id: 'test-id',
        reason: '   ',
      };
      const result = validateApprovalInput(input);
      expect(result.valid).toBe(false);
    });
  });

  describe('canBeApprovedOrRejected', () => {
    it('returns canProcess=true for pending_approval', () => {
      const returnData = createMockReturn({ status: 'pending_approval' });
      const result = canBeApprovedOrRejected(returnData);
      expect(result.canProcess).toBe(true);
    });

    it('returns canProcess=false for completed', () => {
      const returnData = createMockReturn({ status: 'completed' });
      const result = canBeApprovedOrRejected(returnData);
      expect(result.canProcess).toBe(false);
      expect(result.error).toBe('Retur sudah selesai');
    });

    it('returns canProcess=false for cancelled', () => {
      const returnData = createMockReturn({ status: 'cancelled' });
      const result = canBeApprovedOrRejected(returnData);
      expect(result.canProcess).toBe(false);
      expect(result.error).toBe('Retur sudah dibatalkan');
    });

    it('returns canProcess=false for rejected', () => {
      const returnData = createMockReturn({ status: 'rejected' });
      const result = canBeApprovedOrRejected(returnData);
      expect(result.canProcess).toBe(false);
      expect(result.error).toBe('Retur sudah ditolak');
    });

    it('returns canProcess=false for approved', () => {
      const returnData = createMockReturn({ status: 'approved' });
      const result = canBeApprovedOrRejected(returnData);
      expect(result.canProcess).toBe(false);
      expect(result.error).toBe('Retur sudah disetujui');
    });
  });

  describe('simulateApproval', () => {
    it('sets status to approved', () => {
      const returnData = createMockReturn({ status: 'pending_approval' });
      const result = simulateApproval(returnData, 'approver-id', 'Approved');
      expect(result.status).toBe('approved');
    });

    it('records approver_id', () => {
      const returnData = createMockReturn({ status: 'pending_approval' });
      const result = simulateApproval(returnData, 'approver-id', 'Approved');
      expect(result.approved_by).toBe('approver-id');
    });

    it('records approval_reason', () => {
      const returnData = createMockReturn({ status: 'pending_approval' });
      const result = simulateApproval(returnData, 'approver-id', 'Customer is VIP');
      expect(result.approval_reason).toBe('Customer is VIP');
    });
  });

  describe('simulateRejection', () => {
    it('sets status to rejected', () => {
      const returnData = createMockReturn({ status: 'pending_approval' });
      const result = simulateRejection(returnData, 'Policy violation');
      expect(result.status).toBe('rejected');
    });

    it('records rejected_reason', () => {
      const returnData = createMockReturn({ status: 'pending_approval' });
      const result = simulateRejection(returnData, 'Policy violation');
      expect(result.rejected_reason).toBe('Policy violation');
    });
  });
});
