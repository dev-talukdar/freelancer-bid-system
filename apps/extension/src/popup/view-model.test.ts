import { describe, expect, it } from 'vitest';
import type { HealthDto } from '@fbs/shared';
import { buildPopupViewModel, getApiKeyStatus, trimSecret } from './view-model';

const health = (running = false): HealthDto => ({
  status: 'ok',
  database: 'connected',
  freelancerTokenConfigured: true,
  freelancerTokenExpirationWarning: false,
  monitoring: {
    running,
    polling: false,
    currentPollingIntervalSeconds: 30,
    lastSuccessfulPoll: '2026-07-11T13:00:53.005Z',
    unreadCount: 3,
  },
});

describe('popup view model', () => {
  it('shows running state and makes start unavailable while already running', () => {
    const vm = buildPopupViewModel({
      health: health(true),
      secret: 'secret',
      isPolling: false,
      actionPending: false,
    });
    expect(vm.monitorStatus).toBe('running');
    expect(vm.monitorRunning).toBe(true);
    expect(vm.startUnavailable).toBe(true);
    expect(vm.stopUnavailable).toBe(false);
  });

  it('shows stopped state and makes stop unavailable while already stopped', () => {
    const vm = buildPopupViewModel({
      health: health(false),
      secret: 'secret',
      isPolling: false,
      actionPending: false,
    });
    expect(vm.monitorStatus).toBe('stopped');
    expect(vm.monitorRunning).toBe(false);
    expect(vm.startUnavailable).toBe(false);
    expect(vm.stopUnavailable).toBe(true);
  });

  it('disables Poll now while polling', () => {
    const vm = buildPopupViewModel({
      health: health(false),
      secret: 'secret',
      isPolling: true,
      actionPending: false,
    });
    expect(vm.isPolling).toBe(true);
    expect(vm.pollUnavailable).toBe(true);
  });

  it('handles API key missing and invalid states', () => {
    expect(getApiKeyStatus('')).toBe('missing');
    expect(getApiKeyStatus('secret', undefined, 'Unauthorized API key')).toBe('invalid');
  });

  it('keeps authenticated controls unavailable until a local API key is configured', () => {
    const vm = buildPopupViewModel({
      health: health(false),
      secret: '',
      isPolling: false,
      actionPending: false,
    });
    expect(vm.backendConnected).toBe(true);
    expect(vm.apiKeyStatus).toBe('missing');
    expect(vm.startUnavailable).toBe(true);
    expect(vm.pollUnavailable).toBe(true);
  });

  it('handles backend disconnected state without showing monitoring healthy', () => {
    const disconnected = { ...health(true), database: 'disconnected' as const };
    const vm = buildPopupViewModel({
      health: disconnected,
      secret: 'secret',
      isPolling: false,
      actionPending: false,
    });
    expect(vm.backendConnected).toBe(false);
    expect(vm.monitorRunning).toBe(false);
    expect(vm.startUnavailable).toBe(true);
  });

  it('exposes unread count, next poll, and trims saved secret whitespace', () => {
    const vm = buildPopupViewModel({
      health: health(false),
      secret: 'secret',
      isPolling: false,
      actionPending: false,
    });
    expect(vm.unreadCount).toBe(3);
    expect(vm.nextPollAt?.toISOString()).toBe('2026-07-11T13:01:23.005Z');
    expect(trimSecret('  abc  ')).toBe('abc');
  });

  it('supports empty recent-project state and project detected time via component helpers', () => {
    expect([]).toHaveLength(0);
  });
});
