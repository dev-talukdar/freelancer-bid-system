import {
  LOCAL_API_BASE_URL,
  type ApiFailure,
  type ApiResponse,
  type HealthDto,
  type MonitorPollResultDto,
  type MonitorStatusDto,
  type PaginatedDetectedProjectsDto,
  type UnnotifiedDetectedProjectsDto,
} from '@fbs/shared';

export interface ExtensionSettings {
  localApiSecret: string;
  apiBaseUrl: string;
}

export type LocalApiErrorKind =
  'timeout' | 'unauthorized' | 'network' | 'http' | 'invalid-response';

export class LocalApiError extends Error {
  constructor(
    public readonly kind: LocalApiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LocalApiError';
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function parseApiResponse<T>(res: Response): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new LocalApiError('invalid-response', 'Backend returned invalid JSON', res.status);
  }

  if (!res.ok || !body.success) {
    const failure = body as ApiFailure;
    const kind: LocalApiErrorKind = res.status === 401 ? 'unauthorized' : 'http';
    throw new LocalApiError(kind, failure.message, res.status);
  }

  return body.data;
}

export function mapFetchError(error: unknown): LocalApiError {
  if (error instanceof LocalApiError) return error;
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new LocalApiError('timeout', 'Backend request timed out');
  }
  if (error instanceof TypeError) {
    return new LocalApiError('network', 'Backend connection failed');
  }
  return new LocalApiError(
    'network',
    error instanceof Error ? error.message : 'Backend request failed',
  );
}

export class LocalApiClient {
  constructor(private settings: ExtensionSettings) {}

  private async request<T>(path: string, init: RequestInit = {}) {
    try {
      const res = await fetch(`${this.settings.apiBaseUrl}${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Local-API-Key': this.settings.localApiSecret,
          ...init.headers,
        },
        signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return await parseApiResponse<T>(res);
    } catch (error) {
      throw mapFetchError(error);
    }
  }

  health() {
    return this.request<HealthDto>('/api/v1/health');
  }
  status() {
    return this.request<MonitorStatusDto>('/api/v1/monitor/status');
  }
  start() {
    return this.request<MonitorStatusDto>('/api/v1/monitor/start', { method: 'POST' });
  }
  stop() {
    return this.request<MonitorStatusDto>('/api/v1/monitor/stop', { method: 'POST' });
  }
  poll() {
    return this.request<MonitorPollResultDto>('/api/v1/monitor/poll', { method: 'POST' });
  }
  detected(unreadOnly = false, pageSize = 5) {
    return this.request<PaginatedDetectedProjectsDto>(
      `/api/v1/detected-projects?unreadOnly=${unreadOnly}&pageSize=${pageSize}`,
    );
  }
  unnotified(limit = 10) {
    return this.request<UnnotifiedDetectedProjectsDto>(
      `/api/v1/detected-projects/unnotified?limit=${limit}`,
    );
  }
  markNotified(id: string) {
    return this.request<unknown>(`/api/v1/detected-projects/${id}/notified`, { method: 'PATCH' });
  }
  markRead(id: string) {
    return this.request<unknown>(`/api/v1/detected-projects/${id}/read`, { method: 'PATCH' });
  }
  opened(id: string) {
    return this.request<unknown>(`/api/v1/detected-projects/${id}/opened`, { method: 'PATCH' });
  }
}
export const defaultSettings: ExtensionSettings = {
  localApiSecret: '',
  apiBaseUrl: LOCAL_API_BASE_URL,
};
