import {
  LOCAL_API_BASE_URL,
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

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !body.success) throw new Error(body.message);
  return body.data;
}

export class LocalApiClient {
  constructor(private settings: ExtensionSettings) {}

  private async request<T>(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.settings.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Local-API-Key': this.settings.localApiSecret,
        ...init.headers,
      },
    });
    return parseApiResponse<T>(res);
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
  apiBaseUrl: LOCAL_API_BASE_URL,
};
