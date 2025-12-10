/**
 * Activity API Property-Based Tests
 * 
 * Tests for activity logging functionality:
 * - Property 11: Activity Log Completeness
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ActivityLog,
  ActivityEventType,
  filterActivityByDays,
  isValidEventType,
  createActivityLogEntry,
} from './activity';

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

// Valid event types
const validEventTypes: ActivityEventType[] = ['login_success', 'login_failure', 'logout', 'password_change'];

const eventTypeArb = fc.constantFrom(...validEventTypes);

const userIdArb = fc.uuid();

const metadataArb = fc.option(
  fc.record({
    email: fc.emailAddress(),
    reason: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  { nil: undefined }
);

// Generate activity log with specific date
const activityLogArb = (daysAgo: number): fc.Arbitrary<ActivityLog> =>
  fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    event_type: eventTypeArb,
    ip_address: fc.option(fc.ipV4(), { nil: null }),
    user_agent: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: null }),
    metadata: fc.option(
      fc.record({
        email: fc.emailAddress(),
        reason: fc.string({ minLength: 1, maxLength: 50 }),
      }),
      { nil: null }
    ),
    created_at: fc.constant(generateDateDaysAgo(daysAgo)),
  });

// Generate a date that is X days ago
function generateDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// Generate random days ago within a range
const daysAgoArb = (min: number, max: number) =>
  fc.integer({ min, max }).map((days) => generateDateDaysAgo(days));

// Activity log with random date within range
const activityLogWithDateRangeArb = (minDays: number, maxDays: number): fc.Arbitrary<ActivityLog> =>
  fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    event_type: eventTypeArb,
    ip_address: fc.option(fc.ipV4(), { nil: null }),
    user_agent: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: null }),
    metadata: fc.option(
      fc.record({
        email: fc.emailAddress(),
        reason: fc.string({ minLength: 1, maxLength: 50 }),
      }),
      { nil: null }
    ),
    created_at: daysAgoArb(minDays, maxDays),
  });

// ============================================================================
// Property-Based Tests for Activity Log
// ============================================================================

/**
 * **Feature: user-management, Property 11: Activity Log Completeness**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 * 
 * For any login event (success or failure), an activity log entry should be 
 * created with user_id, event_type, timestamp, AND the log should only return 
 * entries from the last 30 days.
 */
describe('Property 11: Activity Log Completeness', () => {
  
  it('Property 11.1: Activity log entry contains required fields (user_id, event_type)', () => {
    fc.assert(
      fc.property(
        userIdArb,
        eventTypeArb,
        metadataArb,
        (userId, eventType, metadata) => {
          const entry = createActivityLogEntry(userId, eventType, metadata);
          
          // Verify required fields exist
          return (
            entry.user_id === userId &&
            entry.event_type === eventType &&
            'ip_address' in entry &&
            'user_agent' in entry &&
            'metadata' in entry
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.2: Activity log entry preserves event type correctly', () => {
    fc.assert(
      fc.property(
        userIdArb,
        eventTypeArb,
        (userId, eventType) => {
          const entry = createActivityLogEntry(userId, eventType);
          return entry.event_type === eventType;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.3: Filter returns only logs within specified days', () => {
    fc.assert(
      fc.property(
        // Generate logs within 30 days
        fc.array(activityLogWithDateRangeArb(0, 29), { minLength: 1, maxLength: 20 }),
        // Generate logs older than 30 days
        fc.array(activityLogWithDateRangeArb(31, 60), { minLength: 1, maxLength: 20 }),
        (recentLogs, oldLogs) => {
          const allLogs = [...recentLogs, ...oldLogs];
          const filtered = filterActivityByDays(allLogs, 30);
          
          // All filtered logs should be within 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          return filtered.every((log) => {
            const logDate = new Date(log.created_at);
            return logDate >= thirtyDaysAgo;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.4: Filter excludes logs older than specified days', () => {
    fc.assert(
      fc.property(
        // Generate only old logs (older than 31 days)
        fc.array(activityLogWithDateRangeArb(31, 60), { minLength: 1, maxLength: 20 }),
        (oldLogs) => {
          const filtered = filterActivityByDays(oldLogs, 30);
          
          // All old logs should be excluded
          return filtered.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.5: Filter preserves all recent logs', () => {
    fc.assert(
      fc.property(
        // Generate only recent logs (within 29 days to be safe)
        fc.array(activityLogWithDateRangeArb(0, 29), { minLength: 1, maxLength: 20 }),
        (recentLogs) => {
          const filtered = filterActivityByDays(recentLogs, 30);
          
          // All recent logs should be preserved
          return filtered.length === recentLogs.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.6: Login success events are valid event types', () => {
    fc.assert(
      fc.property(
        fc.constant('login_success' as const),
        (eventType) => {
          return isValidEventType(eventType) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.7: Login failure events are valid event types', () => {
    fc.assert(
      fc.property(
        fc.constant('login_failure' as const),
        (eventType) => {
          return isValidEventType(eventType) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.8: All valid event types are recognized', () => {
    fc.assert(
      fc.property(
        eventTypeArb,
        (eventType) => {
          return isValidEventType(eventType) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.9: Invalid event types are rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !validEventTypes.includes(s as ActivityEventType)
        ),
        (invalidEventType) => {
          return isValidEventType(invalidEventType) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11.10: Activity log entry with null userId handles gracefully', () => {
    fc.assert(
      fc.property(
        eventTypeArb,
        (eventType) => {
          // For failed login attempts, userId can be null
          const entry = createActivityLogEntry(null, eventType);
          return entry.user_id === '' && entry.event_type === eventType;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Activity Functions
// ============================================================================

describe('isValidEventType function', () => {
  it('accepts login_success', () => {
    expect(isValidEventType('login_success')).toBe(true);
  });

  it('accepts login_failure', () => {
    expect(isValidEventType('login_failure')).toBe(true);
  });

  it('accepts logout', () => {
    expect(isValidEventType('logout')).toBe(true);
  });

  it('accepts password_change', () => {
    expect(isValidEventType('password_change')).toBe(true);
  });

  it('rejects invalid event types', () => {
    expect(isValidEventType('invalid')).toBe(false);
    expect(isValidEventType('login')).toBe(false);
    expect(isValidEventType('')).toBe(false);
  });
});

describe('createActivityLogEntry function', () => {
  it('creates entry with all required fields', () => {
    const entry = createActivityLogEntry('user-123', 'login_success');
    
    expect(entry.user_id).toBe('user-123');
    expect(entry.event_type).toBe('login_success');
    expect(entry).toHaveProperty('ip_address');
    expect(entry).toHaveProperty('user_agent');
    expect(entry).toHaveProperty('metadata');
  });

  it('includes metadata when provided', () => {
    const metadata = { email: 'test@example.com', reason: 'test' };
    const entry = createActivityLogEntry('user-123', 'login_failure', metadata);
    
    expect(entry.metadata).toEqual(metadata);
  });

  it('handles null userId for failed logins', () => {
    const entry = createActivityLogEntry(null, 'login_failure', { email: 'test@example.com' });
    
    expect(entry.user_id).toBe('');
    expect(entry.event_type).toBe('login_failure');
  });
});

describe('filterActivityByDays function', () => {
  it('returns empty array for empty input', () => {
    const result = filterActivityByDays([], 30);
    expect(result).toEqual([]);
  });

  it('filters out logs older than specified days', () => {
    const now = new Date();
    const recentDate = new Date(now);
    recentDate.setDate(recentDate.getDate() - 10);
    
    const oldDate = new Date(now);
    oldDate.setDate(oldDate.getDate() - 40);

    const logs: ActivityLog[] = [
      {
        id: '1',
        user_id: 'user-1',
        event_type: 'login_success',
        ip_address: null,
        user_agent: null,
        metadata: null,
        created_at: recentDate.toISOString(),
      },
      {
        id: '2',
        user_id: 'user-1',
        event_type: 'logout',
        ip_address: null,
        user_agent: null,
        metadata: null,
        created_at: oldDate.toISOString(),
      },
    ];

    const result = filterActivityByDays(logs, 30);
    
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('keeps all logs within specified days', () => {
    const now = new Date();
    const date1 = new Date(now);
    date1.setDate(date1.getDate() - 5);
    
    const date2 = new Date(now);
    date2.setDate(date2.getDate() - 15);

    const logs: ActivityLog[] = [
      {
        id: '1',
        user_id: 'user-1',
        event_type: 'login_success',
        ip_address: null,
        user_agent: null,
        metadata: null,
        created_at: date1.toISOString(),
      },
      {
        id: '2',
        user_id: 'user-1',
        event_type: 'logout',
        ip_address: null,
        user_agent: null,
        metadata: null,
        created_at: date2.toISOString(),
      },
    ];

    const result = filterActivityByDays(logs, 30);
    
    expect(result.length).toBe(2);
  });
});
