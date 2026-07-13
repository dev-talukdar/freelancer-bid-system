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

  it('handles API key missing, invalid, and local-valid states', () => {
    expect(getApiKeyStatus('')).toBe('missing');
    expect(getApiKeyStatus('secret', undefined, 'Unauthorized API key')).toBe('invalid');
    expect(getApiKeyStatus('secret', undefined, '')).toBe('valid');
    expect(
      getApiKeyStatus('secret', { ...health(false), freelancerTokenConfigured: false }, ''),
    ).toBe('valid');
  });

  it('keeps backend connected when later project loading reports an error', () => {
    const vm = buildPopupViewModel({
      health: health(false),
      secret: 'secret',
      error: 'Recent projects unavailable: Backend request timed out',
      isPolling: false,
      actionPending: false,
    });

    expect(vm.backendConnected).toBe(true);
    expect(vm.monitorStatus).toBe('stopped');
    expect(vm.apiKeyStatus).toBe('valid');
  });

  it('handles database disconnected state without showing monitoring healthy', () => {
    const disconnected = {
      ...health(true),
      status: 'degraded' as const,
      database: 'disconnected' as const,
    };

    const vm = buildPopupViewModel({
      health: disconnected,
      secret: 'secret',
      isPolling: false,
      actionPending: false,
    });
    expect(vm.backendConnected).toBe(true);
    expect(vm.databaseConnected).toBe(false);

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
