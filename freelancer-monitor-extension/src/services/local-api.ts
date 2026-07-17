import {
  type ApiResponse,
  type HealthDto,
  type MonitorPollResultDto,
  type MonitorStatusDto,
  type PaginatedDetectedProjectsDto,
  type UnnotifiedDetectedProjectsDto,
} from '../types/api-contracts.js';
import { extensionConfig } from '../config/extension-config.js';

export class ApiConnectionError extends Error {
  constructor(message: string, public readonly code: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

export interface ExtensionSettings {
  localApiSecret: string;
  apiBaseUrl: string;
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => undefined)) as ApiResponse<T> | undefined;
  if (res.status === 401) throw new ApiConnectionError(body?.message ?? 'API key is invalid.', 'API_KEY_INVALID', 401);
  if (res.status === 403) throw new ApiConnectionError(body?.message ?? 'API access is forbidden.', 'FORBIDDEN', 403);
  if (res.status >= 500) throw new ApiConnectionError(body?.message ?? 'The backend encountered an error.', 'SERVER_ERROR', res.status);
  if (!res.ok || !body?.success) throw new ApiConnectionError(body?.message ?? `API request failed (${res.status}).`, 'HTTP_ERROR', res.status);
  return body.data;
}

export class LocalApiClient {
  constructor(private settings: ExtensionSettings) {}

  private async request<T>(path: string, init: RequestInit = {}) {
    if (!this.settings.localApiSecret.trim()) throw new ApiConnectionError('API key is missing. Save it in extension settings.', 'API_KEY_MISSING');
    try {
      const res = await fetch(`${this.settings.apiBaseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'X-Local-API-Key': this.settings.localApiSecret, ...init.headers },
      });
      return await parseApiResponse<T>(res);
    } catch (error) {
      if (error instanceof ApiConnectionError) throw error;
      const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(this.settings.apiBaseUrl);
      throw new ApiConnectionError(local ? 'Backend unreachable. Confirm that the local API is running.' : 'Network request failed. Check connectivity, CORS, and extension host permissions.', local ? 'BACKEND_UNREACHABLE' : 'NETWORK_OR_CORS');
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
  clearDetectedProjects() {
    return this.request<{ deletedCount: number }>('/api/v1/detected-projects', {
      method: 'DELETE',
    });
  }
}
export const defaultSettings: ExtensionSettings = {
  localApiSecret: '',
  apiBaseUrl: extensionConfig.apiBaseUrl,
};
