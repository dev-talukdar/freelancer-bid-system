import type { HealthDto } from '@fbs/shared';
import { calculateNextPollAt } from '../utils/time';

export type MonitorStatus = 'running' | 'stopped' | 'connecting' | 'error';
export type ApiKeyStatus = 'valid' | 'missing' | 'invalid';

export interface PopupViewModel {
  backendConnected: boolean;
  databaseConnected: boolean;
  monitorStatus: MonitorStatus;
  monitorRunning: boolean;
  apiKeyStatus: ApiKeyStatus;
  lastPollAt: string | undefined;
  nextPollAt: Date | undefined;
  pollIntervalSeconds: number;
  unreadCount: number;
  isPolling: boolean;
  startUnavailable: boolean;
  stopUnavailable: boolean;
  pollUnavailable: boolean;
}

export function getApiKeyStatus(secret: string, health?: HealthDto, loadError = ''): ApiKeyStatus {
  if (!secret.trim()) return 'missing';
  const lower = loadError.toLowerCase();
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('api key'))
    return 'invalid';
  return health?.freelancerTokenConfigured === false ? 'missing' : 'valid';
}

export function buildPopupViewModel(params: {
  health: HealthDto | undefined;
  secret: string;
  error?: string;
  isPolling: boolean;
  actionPending: boolean;
}): PopupViewModel {
  const backendConnected = Boolean(params.health) && !params.error;
  const databaseConnected = params.health?.database === 'connected';
  const monitorRunning = databaseConnected ? (params.health?.monitoring.running ?? false) : false;
  const monitorStatus: MonitorStatus = params.error
    ? 'error'
    : !params.health && params.secret.trim()
      ? 'connecting'
      : monitorRunning
        ? 'running'
        : 'stopped';
  const pollIntervalSeconds = params.health?.monitoring.currentPollingIntervalSeconds ?? 0;
  const lastPollAt = params.health?.monitoring.lastSuccessfulPoll;

  return {
    backendConnected,
    databaseConnected,
    monitorStatus,
    monitorRunning,
    apiKeyStatus: getApiKeyStatus(params.secret, params.health, params.error),
    lastPollAt,
    nextPollAt: calculateNextPollAt(lastPollAt, pollIntervalSeconds),
    pollIntervalSeconds,
    unreadCount: params.health?.monitoring.unreadCount ?? 0,
    isPolling: params.isPolling || (params.health?.monitoring.polling ?? false),
    startUnavailable:
      monitorRunning || params.actionPending || !backendConnected || !databaseConnected,
    stopUnavailable:
      !monitorRunning || params.actionPending || !backendConnected || !databaseConnected,
    pollUnavailable:
      params.isPolling || params.actionPending || !backendConnected || !databaseConnected,
  };
}

export const trimSecret = (value: string) => value.trim();
