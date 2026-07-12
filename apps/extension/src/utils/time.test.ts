import { describe, expect, it } from 'vitest';

import { calculateNextPollAt, formatBangladeshDateTime, formatRelativeTime } from './time.js';

describe('time utilities', () => {
  it('formats missing and invalid Bangladesh datetimes safely', () => {
    expect(formatBangladeshDateTime(undefined)).toBe('Not available');
    expect(formatBangladeshDateTime('bad-date')).toBe('Invalid date');
  });

  it('calculates the next poll time', () => {
    expect(calculateNextPollAt('2026-07-12T00:00:00.000Z', 30)?.toISOString()).toBe(
      '2026-07-12T00:00:30.000Z',
    );
    expect(calculateNextPollAt(undefined, 30)).toBeUndefined();
    expect(calculateNextPollAt('2026-07-12T00:00:00.000Z', 0)).toBeUndefined();
  });

  it('formats relative times', () => {
    const now = new Date('2026-07-12T00:00:00.000Z');
    expect(formatRelativeTime(undefined, now)).toBe('Not available');
    expect(formatRelativeTime('bad-date', now)).toBe('Invalid date');
    expect(formatRelativeTime(now, now)).toBe('Now');
    expect(formatRelativeTime('2026-07-12T00:00:05.000Z', now)).toBe('In 5 seconds');
    expect(formatRelativeTime('2026-07-11T23:59:59.000Z', now)).toBe('1 second ago');
  });
});
