import { describe, expect, it } from 'vitest';
import { calculateNextPollAt, formatBangladeshDateTime, formatRelativeTime } from '../utils/time';

describe('Bangladesh time helpers', () => {
  it('formats dates in Asia/Dhaka time', () => {
    expect(formatBangladeshDateTime('2026-07-11T13:00:53.005Z')).toContain('7:00:53 PM');
  });

  it('handles missing and invalid poll values', () => {
    expect(formatBangladeshDateTime(undefined)).toBe('Not available');
    expect(formatBangladeshDateTime('not-a-date')).toBe('Invalid date');
  });

  it('calculates next poll from last poll plus interval', () => {
    expect(calculateNextPollAt('2026-07-11T13:00:53.005Z', 30)?.toISOString()).toBe(
      '2026-07-11T13:01:23.005Z',
    );
    expect(calculateNextPollAt('bad', 30)).toBeUndefined();
  });

  it('formats relative countdowns', () => {
    const now = new Date('2026-07-11T13:00:53.005Z');
    expect(formatRelativeTime('2026-07-11T13:01:11.005Z', now)).toBe('In 18 seconds');
    expect(formatRelativeTime('2026-07-11T13:00:41.005Z', now)).toBe('12 seconds ago');
  });
});
