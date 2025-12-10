import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  AuditLogger,
  calculateChangedFields,
  generateSummary,
  isValidEventType,
  isValidEntityType,
  AuditEventType,
  AuditEntityType,
  AuditContext,
} from './auditLogger';

// ============================================================================
// Generators
// ============================================================================

// Generator for valid event types
const eventTypeArb = fc.constantFrom<AuditEventType>(
  'create', 'update', 'delete', 'login', 'logout',
  'transaction', 'refund', 'stock_adjustment', 'price_change', 'role_change'
);

// Generator for valid entity types
const entityTypeArb = fc.constantFrom<AuditEntityType>(
  'product', 'transaction', 'user', 'supplier', 'category',
  'purchase_order', 'return', 'discount', 'promo', 'outlet'
);

// Generator for UUID-like strings
const uuidArb = fc.uuid();

// Generator for simple record values (primitives only for reliable comparison)
const simpleValueArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null)
);

// Generator for flat record objects
const flatRecordArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
  simpleValueArb,
  { minKeys: 1, maxKeys: 10 }
);

// Generator for audit context
const auditContextArb = fc.record({
  userId: uuidArb,
  userRole: fc.constantFrom('admin', 'manager', 'kasir'),
  outletId: fc.option(uuidArb, { nil: undefined }),
  ipAddress: fc.option(fc.ipV4(), { nil: undefined }),
  userAgent: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('Audit Logger Utilities', () => {
  describe('isValidEventType', () => {
    it('should return true for valid event types', () => {
      expect(isValidEventType('create')).toBe(true);
      expect(isValidEventType('update')).toBe(true);
      expect(isValidEventType('delete')).toBe(true);
      expect(isValidEventType('transaction')).toBe(true);
    });

    it('should return false for invalid event types', () => {
      expect(isValidEventType('invalid')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType('CREATE')).toBe(false);
    });
  });

  describe('isValidEntityType', () => {
    it('should return true for valid entity types', () => {
      expect(isValidEntityType('product')).toBe(true);
      expect(isValidEntityType('transaction')).toBe(true);
      expect(isValidEntityType('user')).toBe(true);
    });

    it('should return false for invalid entity types', () => {
      expect(isValidEntityType('invalid')).toBe(false);
      expect(isValidEntityType('')).toBe(false);
      expect(isValidEntityType('PRODUCT')).toBe(false);
    });
  });

  describe('calculateChangedFields', () => {
    it('should return empty array for null inputs', () => {
      expect(calculateChangedFields(null, null)).toEqual([]);
      expect(calculateChangedFields(null, { a: 1 })).toEqual([]);
      expect(calculateChangedFields({ a: 1 }, null)).toEqual([]);
    });

    it('should detect changed string fields', () => {
      const oldValues = { name: 'old', price: 100 };
      const newValues = { name: 'new', price: 100 };
      expect(calculateChangedFields(oldValues, newValues)).toEqual(['name']);
    });

    it('should detect changed number fields', () => {
      const oldValues = { name: 'test', price: 100 };
      const newValues = { name: 'test', price: 200 };
      expect(calculateChangedFields(oldValues, newValues)).toEqual(['price']);
    });

    it('should detect multiple changed fields', () => {
      const oldValues = { name: 'old', price: 100, stock: 10 };
      const newValues = { name: 'new', price: 200, stock: 10 };
      expect(calculateChangedFields(oldValues, newValues)).toEqual(['name', 'price']);
    });

    it('should detect added fields', () => {
      const oldValues = { name: 'test' };
      const newValues = { name: 'test', price: 100 };
      expect(calculateChangedFields(oldValues, newValues)).toEqual(['price']);
    });

    it('should detect removed fields', () => {
      const oldValues = { name: 'test', price: 100 };
      const newValues = { name: 'test' };
      expect(calculateChangedFields(oldValues, newValues)).toEqual(['price']);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for create event', () => {
      const summary = generateSummary('create', 'product');
      expect(summary).toBe('Produk dibuat');
    });

    it('should generate summary for update event with changes', () => {
      const summary = generateSummary('update', 'product', ['name', 'price']);
      expect(summary).toBe('Produk diperbarui (name, price)');
    });

    it('should generate summary for delete event', () => {
      const summary = generateSummary('delete', 'user');
      expect(summary).toBe('Pengguna dihapus');
    });

    it('should generate summary for business events', () => {
      expect(generateSummary('transaction', 'transaction')).toBe('Transaksi: transaksi selesai');
      expect(generateSummary('refund', 'return')).toBe('Retur: refund diproses');
      expect(generateSummary('price_change', 'product')).toBe('Produk: harga diubah');
    });
  });
});

// ============================================================================
// AuditLogger Class Tests
// ============================================================================

describe('AuditLogger Class', () => {
  beforeEach(() => {
    AuditLogger.clearContext();
  });

  describe('Context Management', () => {
    it('should set and get context', () => {
      const context: AuditContext = {
        userId: '123',
        userRole: 'admin',
        outletId: '456',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
      };
      
      AuditLogger.setContext(context);
      expect(AuditLogger.getContext()).toEqual(context);
    });

    it('should clear context', () => {
      AuditLogger.setContext({ userId: '123', userRole: 'admin' });
      AuditLogger.clearContext();
      expect(AuditLogger.getContext()).toBeNull();
    });
  });

  describe('createLogEntry', () => {
    it('should create log entry for create event', () => {
      const entry = AuditLogger.createLogEntry(
        'create',
        'product',
        '123',
        null,
        { name: 'Test Product', price: 100 }
      );

      expect(entry.event_type).toBe('create');
      expect(entry.entity_type).toBe('product');
      expect(entry.entity_id).toBe('123');
      expect(entry.old_values).toBeNull();
      expect(entry.new_values).toEqual({ name: 'Test Product', price: 100 });
      expect(entry.summary).toBe('Produk dibuat');
    });

    it('should create log entry for update event with changed fields', () => {
      const entry = AuditLogger.createLogEntry(
        'update',
        'product',
        '123',
        { name: 'Old Name', price: 100 },
        { name: 'New Name', price: 100 }
      );

      expect(entry.event_type).toBe('update');
      expect(entry.changed_fields).toEqual(['name']);
      expect(entry.summary).toBe('Produk diperbarui (name)');
    });

    it('should create log entry for delete event', () => {
      const entry = AuditLogger.createLogEntry(
        'delete',
        'product',
        '123',
        { name: 'Deleted Product', price: 100 },
        null
      );

      expect(entry.event_type).toBe('delete');
      expect(entry.old_values).toEqual({ name: 'Deleted Product', price: 100 });
      expect(entry.new_values).toBeNull();
      expect(entry.summary).toBe('Produk dihapus');
    });

    it('should include context in log entry', () => {
      const context: AuditContext = {
        userId: 'user-123',
        userRole: 'admin',
        outletId: 'outlet-456',
        ipAddress: '192.168.1.1',
      };
      AuditLogger.setContext(context);

      const entry = AuditLogger.createLogEntry('create', 'product', '123', null, { name: 'Test' });

      expect(entry.user_id).toBe('user-123');
      expect(entry.outlet_id).toBe('outlet-456');
      expect(entry.ip_address).toBe('192.168.1.1');
    });
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

// **Feature: audit-log, Property 1: CRUD Event Logging**
// **Validates: Requirements 1.1, 1.2, 1.3**
describe('Property 1: CRUD Event Logging', () => {
  beforeEach(() => {
    AuditLogger.clearContext();
  });

  it('should create log entry with correct event_type, entity_type, and entity_id for any CRUD operation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AuditEventType>('create', 'update', 'delete'),
        entityTypeArb,
        uuidArb,
        flatRecordArb,
        (eventType, entityType, entityId, data) => {
          const oldValues = eventType === 'create' ? null : data;
          const newValues = eventType === 'delete' ? null : data;
          
          const entry = AuditLogger.createLogEntry(
            eventType,
            entityType,
            entityId,
            oldValues,
            newValues
          );

          return (
            entry.event_type === eventType &&
            entry.entity_type === entityType &&
            entry.entity_id === entityId
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should record old_values and new_values for update events', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        uuidArb,
        flatRecordArb,
        flatRecordArb,
        (entityType, entityId, oldData, newData) => {
          const entry = AuditLogger.createLogEntry(
            'update',
            entityType,
            entityId,
            oldData,
            newData
          );

          return (
            entry.old_values !== null &&
            entry.new_values !== null &&
            JSON.stringify(entry.old_values) === JSON.stringify(oldData) &&
            JSON.stringify(entry.new_values) === JSON.stringify(newData)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should record deleted data snapshot for delete events', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        uuidArb,
        flatRecordArb,
        (entityType, entityId, deletedData) => {
          const entry = AuditLogger.createLogEntry(
            'delete',
            entityType,
            entityId,
            deletedData,
            null
          );

          return (
            entry.old_values !== null &&
            entry.new_values === null &&
            JSON.stringify(entry.old_values) === JSON.stringify(deletedData)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should record new data for create events', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        uuidArb,
        flatRecordArb,
        (entityType, entityId, createdData) => {
          const entry = AuditLogger.createLogEntry(
            'create',
            entityType,
            entityId,
            null,
            createdData
          );

          return (
            entry.old_values === null &&
            entry.new_values !== null &&
            JSON.stringify(entry.new_values) === JSON.stringify(createdData)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// **Feature: audit-log, Property 2: Metadata Capture**
// **Validates: Requirements 1.4, 1.5**
describe('Property 2: Metadata Capture', () => {
  beforeEach(() => {
    AuditLogger.clearContext();
  });

  it('should capture ip_address and user_agent from context when available', () => {
    fc.assert(
      fc.property(
        auditContextArb,
        eventTypeArb,
        entityTypeArb,
        uuidArb,
        (context, eventType, entityType, entityId) => {
          AuditLogger.setContext(context);
          
          const entry = AuditLogger.createLogEntry(
            eventType,
            entityType,
            entityId,
            null,
            { test: 'data' }
          );

          // IP address should match context if provided
          const ipMatches = context.ipAddress 
            ? entry.ip_address === context.ipAddress 
            : entry.ip_address === null;

          // User agent should match context if provided (or browser default)
          const userAgentMatches = context.userAgent 
            ? entry.user_agent === context.userAgent 
            : true; // Browser might provide default

          AuditLogger.clearContext();
          return ipMatches && userAgentMatches;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should capture outlet_id from context when operation is in outlet context', () => {
    fc.assert(
      fc.property(
        auditContextArb,
        eventTypeArb,
        entityTypeArb,
        uuidArb,
        (context, eventType, entityType, entityId) => {
          AuditLogger.setContext(context);
          
          const entry = AuditLogger.createLogEntry(
            eventType,
            entityType,
            entityId,
            null,
            { test: 'data' }
          );

          // Outlet ID should match context if provided
          const outletMatches = context.outletId 
            ? entry.outlet_id === context.outletId 
            : entry.outlet_id === null || entry.outlet_id === undefined;

          AuditLogger.clearContext();
          return outletMatches;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should capture user_id from context', () => {
    fc.assert(
      fc.property(
        auditContextArb,
        eventTypeArb,
        entityTypeArb,
        uuidArb,
        (context, eventType, entityType, entityId) => {
          AuditLogger.setContext(context);
          
          const entry = AuditLogger.createLogEntry(
            eventType,
            entityType,
            entityId,
            null,
            { test: 'data' }
          );

          AuditLogger.clearContext();
          return entry.user_id === context.userId;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// **Feature: audit-log, Property 5: Changed Fields Detection**
// **Validates: Requirements 4.2**
describe('Property 5: Changed Fields Detection', () => {
  it('should detect exactly the fields where old_values differs from new_values', () => {
    fc.assert(
      fc.property(
        flatRecordArb,
        flatRecordArb,
        (oldValues, newValues) => {
          const changedFields = calculateChangedFields(oldValues, newValues);
          
          // Get all keys from both objects
          const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
          
          // For each key, verify it's in changedFields if and only if values differ
          for (const key of allKeys) {
            const oldVal = oldValues[key];
            const newVal = newValues[key];
            const isDifferent = JSON.stringify(oldVal) !== JSON.stringify(newVal);
            const isInChangedFields = changedFields.includes(key);
            
            if (isDifferent !== isInChangedFields) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when old and new values are identical', () => {
    fc.assert(
      fc.property(
        flatRecordArb,
        (data) => {
          // Create a deep copy to ensure we're testing with identical but separate objects
          const oldValues = JSON.parse(JSON.stringify(data));
          const newValues = JSON.parse(JSON.stringify(data));
          
          const changedFields = calculateChangedFields(oldValues, newValues);
          return changedFields.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect all fields as changed when comparing with empty object', () => {
    fc.assert(
      fc.property(
        flatRecordArb.filter(obj => Object.keys(obj).length > 0),
        (data) => {
          const changedFields = calculateChangedFields({}, data);
          const dataKeys = Object.keys(data).sort();
          
          return (
            changedFields.length === dataKeys.length &&
            changedFields.every(field => dataKeys.includes(field))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return sorted array of changed field names', () => {
    fc.assert(
      fc.property(
        flatRecordArb,
        flatRecordArb,
        (oldValues, newValues) => {
          const changedFields = calculateChangedFields(oldValues, newValues);
          
          // Verify the array is sorted
          const sortedFields = [...changedFields].sort();
          return JSON.stringify(changedFields) === JSON.stringify(sortedFields);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly handle nested object changes', () => {
    // Test with specific nested objects since our generator creates flat records
    const oldValues = { 
      name: 'test', 
      config: { enabled: true, value: 10 } 
    };
    const newValues = { 
      name: 'test', 
      config: { enabled: false, value: 10 } 
    };
    
    const changedFields = calculateChangedFields(oldValues, newValues);
    expect(changedFields).toContain('config');
    expect(changedFields).not.toContain('name');
  });

  it('should correctly handle array changes', () => {
    const oldValues = { 
      name: 'test', 
      tags: ['a', 'b', 'c'] 
    };
    const newValues = { 
      name: 'test', 
      tags: ['a', 'b', 'd'] 
    };
    
    const changedFields = calculateChangedFields(oldValues, newValues);
    expect(changedFields).toContain('tags');
    expect(changedFields).not.toContain('name');
  });

  it('should handle null to value changes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
        simpleValueArb.filter(v => v !== null),
        (fieldName, newValue) => {
          const oldValues = { [fieldName]: null };
          const newValues = { [fieldName]: newValue };
          
          const changedFields = calculateChangedFields(oldValues, newValues);
          return changedFields.includes(fieldName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle value to null changes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
        simpleValueArb.filter(v => v !== null),
        (fieldName, oldValue) => {
          const oldValues = { [fieldName]: oldValue };
          const newValues = { [fieldName]: null };
          
          const changedFields = calculateChangedFields(oldValues, newValues);
          return changedFields.includes(fieldName);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// **Feature: audit-log, Property 3: Business Event Logging**
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
describe('Property 3: Business Event Logging', () => {
  beforeEach(() => {
    AuditLogger.clearContext();
  });

  // Generator for business event types
  const businessEventTypeArb = fc.constantFrom<AuditEventType>(
    'transaction', 'refund', 'stock_adjustment', 'price_change', 'role_change'
  );

  // Generator for business event entity types (matching the event type)
  const businessEventEntityArb = fc.constantFrom<AuditEntityType>(
    'transaction', 'return', 'product', 'user'
  );

  // Generator for transaction metadata
  const transactionMetadataArb = fc.record({
    transaction_number: fc.string({ minLength: 10, maxLength: 20 }),
    total_amount: fc.double({ min: 0, max: 1000000, noNaN: true }),
    payment_method: fc.constantFrom('cash', 'card', 'e-wallet'),
    items_count: fc.integer({ min: 1, max: 100 }),
    outlet_id: fc.option(fc.uuid(), { nil: null }),
  });

  // Generator for refund metadata
  const refundMetadataArb = fc.record({
    return_number: fc.string({ minLength: 10, maxLength: 20 }),
    transaction_id: fc.uuid(),
    refund_method: fc.constantFrom('cash', 'card', 'e-wallet'),
    total_refund: fc.double({ min: 0, max: 1000000, noNaN: true }),
    items_count: fc.integer({ min: 1, max: 100 }),
  });

  // Generator for stock adjustment metadata
  const stockAdjustmentMetadataArb = fc.record({
    movement_type: fc.constantFrom('in', 'out', 'adjustment'),
    quantity: fc.integer({ min: 1, max: 10000 }),
    stock_change: fc.integer({ min: -10000, max: 10000 }),
    reference_type: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: null }),
    reference_id: fc.option(fc.uuid(), { nil: null }),
    notes: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    outlet_id: fc.option(fc.uuid(), { nil: null }),
  });

  // Generator for price change metadata
  const priceChangeMetadataArb = fc.record({
    old_price: fc.double({ min: 0, max: 1000000, noNaN: true }),
    new_price: fc.double({ min: 0, max: 1000000, noNaN: true }),
    product_name: fc.string({ minLength: 1, maxLength: 100 }),
  });

  // Generator for role change metadata
  const roleChangeMetadataArb = fc.record({
    old_role: fc.constantFrom('admin', 'manager', 'kasir'),
    new_role: fc.constantFrom('admin', 'manager', 'kasir'),
    user_name: fc.string({ minLength: 1, maxLength: 100 }),
  });

  it('should create log entry with correct event_type for any business event', () => {
    fc.assert(
      fc.property(
        businessEventTypeArb,
        businessEventEntityArb,
        uuidArb,
        (eventType, entityType, entityId) => {
          const entry = AuditLogger.createLogEntry(
            eventType,
            entityType,
            entityId,
            null,
            { event: 'test' }
          );

          return entry.event_type === eventType;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create transaction log with appropriate metadata', () => {
    fc.assert(
      fc.property(
        uuidArb,
        transactionMetadataArb,
        (entityId, metadata) => {
          const entry = AuditLogger.createLogEntry(
            'transaction',
            'transaction',
            entityId,
            null,
            metadata as Record<string, unknown>
          );

          return (
            entry.event_type === 'transaction' &&
            entry.entity_type === 'transaction' &&
            entry.entity_id === entityId &&
            entry.new_values !== null &&
            'transaction_number' in (entry.new_values as Record<string, unknown>) &&
            'total_amount' in (entry.new_values as Record<string, unknown>) &&
            'payment_method' in (entry.new_values as Record<string, unknown>)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create refund log with original transaction reference', () => {
    fc.assert(
      fc.property(
        uuidArb,
        refundMetadataArb,
        (entityId, metadata) => {
          const entry = AuditLogger.createLogEntry(
            'refund',
            'return',
            entityId,
            null,
            metadata as Record<string, unknown>
          );

          return (
            entry.event_type === 'refund' &&
            entry.entity_type === 'return' &&
            entry.new_values !== null &&
            'transaction_id' in (entry.new_values as Record<string, unknown>) &&
            'total_refund' in (entry.new_values as Record<string, unknown>)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create stock adjustment log with reason', () => {
    fc.assert(
      fc.property(
        uuidArb,
        stockAdjustmentMetadataArb,
        (entityId, metadata) => {
          const entry = AuditLogger.createLogEntry(
            'stock_adjustment',
            'product',
            entityId,
            null,
            metadata as Record<string, unknown>
          );

          return (
            entry.event_type === 'stock_adjustment' &&
            entry.entity_type === 'product' &&
            entry.new_values !== null &&
            'movement_type' in (entry.new_values as Record<string, unknown>) &&
            'quantity' in (entry.new_values as Record<string, unknown>)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create price change log with old and new price', () => {
    fc.assert(
      fc.property(
        uuidArb,
        priceChangeMetadataArb,
        (entityId, metadata) => {
          const entry = AuditLogger.createLogEntry(
            'price_change',
            'product',
            entityId,
            null,
            metadata as Record<string, unknown>
          );

          return (
            entry.event_type === 'price_change' &&
            entry.entity_type === 'product' &&
            entry.new_values !== null &&
            'old_price' in (entry.new_values as Record<string, unknown>) &&
            'new_price' in (entry.new_values as Record<string, unknown>)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create role change log with old and new role', () => {
    fc.assert(
      fc.property(
        uuidArb,
        roleChangeMetadataArb,
        (entityId, metadata) => {
          const entry = AuditLogger.createLogEntry(
            'role_change',
            'user',
            entityId,
            null,
            metadata as Record<string, unknown>
          );

          return (
            entry.event_type === 'role_change' &&
            entry.entity_type === 'user' &&
            entry.new_values !== null &&
            'old_role' in (entry.new_values as Record<string, unknown>) &&
            'new_role' in (entry.new_values as Record<string, unknown>)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate appropriate summary for business events', () => {
    fc.assert(
      fc.property(
        businessEventTypeArb,
        businessEventEntityArb,
        (eventType, entityType) => {
          const summary = generateSummary(eventType, entityType);
          
          // Summary should not be empty
          if (!summary || summary.length === 0) {
            return false;
          }

          // Summary should contain entity label or event label
          const hasContent = summary.includes(':') || summary.includes(' ');
          return hasContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include context metadata in business event logs', () => {
    fc.assert(
      fc.property(
        auditContextArb,
        businessEventTypeArb,
        businessEventEntityArb,
        uuidArb,
        (context, eventType, entityType, entityId) => {
          AuditLogger.setContext(context);
          
          const entry = AuditLogger.createLogEntry(
            eventType,
            entityType,
            entityId,
            null,
            { event: 'test' }
          );

          AuditLogger.clearContext();

          return (
            entry.user_id === context.userId &&
            (context.outletId ? entry.outlet_id === context.outletId : true) &&
            (context.ipAddress ? entry.ip_address === context.ipAddress : true)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
