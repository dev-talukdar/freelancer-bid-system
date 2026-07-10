import { describe, expect, it } from 'vitest';
import { toFreelancerProjectUrl } from '@fbs/shared';
import { parseApiResponse } from '../services/local-api.js';
import { buildNotificationMessage } from './notifications.js';
import { shouldNotify } from '../utils/notification-dedupe.js';
const project = {
  id: 'mongo',
  freelancerProjectId: 7,
  title: 'Build API',
  projectType: 'fixed' as const,
  currency: 'USD',
  budgetMinimum: 100,
  budgetMaximum: 200,
  bidCount: 3,
  jobs: [{ id: 9, name: 'Node' }],
  clientCountry: 'United States',
  seoUrl: 'build-api',
  detectedAt: new Date().toISOString(),
};
describe('extension foundations', () => {
  it('parses local api responses', async () => {
    const res = new Response(JSON.stringify({ success: true, message: 'ok', data: { value: 1 } }));
    await expect(parseApiResponse<{ value: number }>(res)).resolves.toEqual({ value: 1 });
  });
  it('constructs notification payload text', () => {
    expect(buildNotificationMessage(project)).toContain('USD 100-200');
    expect(buildNotificationMessage(project)).toContain('Node');
  });
  it('generates project urls', () => {
    expect(toFreelancerProjectUrl('build-api')).toBe(
      'https://www.freelancer.com/projects/build-api',
    );
  });
  it('deduplicates notification ids', () => {
    expect(shouldNotify([7], 7)).toBe(false);
    expect(shouldNotify([], 7)).toBe(true);
  });
});
