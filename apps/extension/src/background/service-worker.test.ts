import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('service worker notification delivery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.chrome = {
      alarms: {
        create: vi.fn(),
        onAlarm: { addListener: vi.fn() },
      },
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        getURL: vi.fn((path: string) => path),
        sendMessage: vi.fn(),
      },
      notifications: {
        create: vi.fn(),
        clear: vi.fn(),
        getPermissionLevel: vi.fn(),
        onClicked: { addListener: vi.fn() },
      },
      offscreen: {
        hasDocument: vi.fn(),
        createDocument: vi.fn(),
      },
      tabs: { create: vi.fn() },
    } as unknown as typeof chrome;
  });

  it('does not call markNotified when chrome notification creation fails', async () => {
    vi.doMock('../storage/settings.js', () => ({
      addNotifiedId: vi.fn(),
      getSettings: vi.fn(),
      hasNotified: vi.fn().mockResolvedValue(false),
    }));
    vi.doMock('./notifications.js', () => ({
      createProjectNotification: vi.fn().mockRejectedValue(new Error('permission denied')),
    }));
    const { notifyProject } = await import('./service-worker.js');
    const api = { markNotified: vi.fn() };

    await expect(notifyProject(api as never, project, false)).rejects.toThrow('permission denied');

    expect(api.markNotified).not.toHaveBeenCalled();
  });

  it('calls markNotified after chrome notification creation succeeds', async () => {
    const addNotifiedId = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../storage/settings.js', () => ({
      addNotifiedId,
      getSettings: vi.fn(),
      hasNotified: vi.fn().mockResolvedValue(false),
    }));
    vi.doMock('./notifications.js', () => ({
      createProjectNotification: vi.fn().mockResolvedValue(undefined),
    }));
    const { notifyProject } = await import('./service-worker.js');
    const api = { markNotified: vi.fn().mockResolvedValue(undefined) };

    await notifyProject(api as never, project, false);

    expect(api.markNotified).toHaveBeenCalledWith(project.id);
    expect(addNotifiedId).toHaveBeenCalledWith(project.id);
  });
});
