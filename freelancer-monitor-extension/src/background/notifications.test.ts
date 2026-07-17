import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toFreelancerProjectUrl } from '../types/api-contracts.js';
import { parseApiResponse } from '../services/local-api.js';
import { buildNotificationMessage, createProjectNotification } from './notifications.js';
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
  beforeEach(() => {
    globalThis.chrome = {
      runtime: { getURL: vi.fn((path: string) => path) },
      notifications: {
        getPermissionLevel: vi.fn().mockResolvedValue('granted'),
        create: vi.fn().mockResolvedValue('detected-project:mongo'),
      },
    } as unknown as typeof chrome;
  });
  it('parses local api responses', async () => {
    const res = new Response(JSON.stringify({ success: true, message: 'ok', data: { value: 1 } }));
    await expect(parseApiResponse<{ value: number }>(res)).resolves.toEqual({ value: 1 });
  });
  it('constructs notification payload text', () => {
    expect(buildNotificationMessage(project)).toContain('USD 100-200');
    expect(buildNotificationMessage(project)).toContain('Node');
  });
  it('creates a chrome notification when permission is granted', async () => {
    await expect(createProjectNotification(project)).resolves.toBeUndefined();
    expect(chrome.notifications.create).toHaveBeenCalled();
  });
  it('fails when chrome notification permission is unavailable', async () => {
    (
      chrome.notifications.getPermissionLevel as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue('denied');
    await expect(createProjectNotification(project)).rejects.toThrow(
      'Chrome notification permission is denied',
    );
  });
  it('generates project urls', () => {
    expect(toFreelancerProjectUrl('build-api')).toBe(
      'https://www.freelancer.com/projects/build-api',
    );
  });
  it('deduplicates notification ids', () => {
    expect(shouldNotify(['mongo'], 'mongo')).toBe(false);
    expect(shouldNotify([], 'mongo')).toBe(true);
  });
});
