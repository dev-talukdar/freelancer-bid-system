import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { mapFreelancerError } from '../../error/app-error.js';
import { buildFreelancerQuery } from './query.js';
import { calculateAdaptiveDelay, parseRateLimitHeaders, type RateLimitState } from './rate-limit.js';
import { normalizeFreelancerProject } from './normalize.js';
import type { FreelancerProject, ProjectSearchParams } from './types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FreelancerClient {
  public rateLimitState: RateLimitState = { windows: [] };

  constructor(
    private token = env.FREELANCER_ACCESS_TOKEN,
    private baseUrl = env.FREELANCER_API_BASE_URL,
  ) {}

  private async get<T>(path: string, qs?: URLSearchParams, attempt = 0): Promise<T> {
    if (!this.token) throw mapFreelancerError(401, { message: 'Freelancer token is not configured' });
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { headers: { 'Freelancer-OAuth-V1': this.token }, signal: controller.signal }).finally(() =>
      clearTimeout(timeout),
    );
    this.rateLimitState = parseRateLimitHeaders(res.headers);
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => ({}));
      logger.warn({ status: res.status, freelancerRequestId: res.headers.get('x-request-id'), rateLimit: this.rateLimitState }, 'freelancer api error');
      if ((res.status === 429 || res.status >= 500) && attempt < 5) {
        await sleep(calculateAdaptiveDelay(1000, this.rateLimitState, attempt, res.status));
        return this.get<T>(path, qs, attempt + 1);
      }
      throw mapFreelancerError(res.status, body, res.headers.get('x-request-id') ?? undefined);
    }
    return (await res.json()) as T;
  }

  async self() {
    const data = await this.get<unknown>('/users/0.1/self/');
    const user = typeof data === 'object' && data && 'result' in data ? data.result : data;
    return user as { id?: number; username?: string; display_name?: string; email_verified?: boolean };
  }

  async activeProjects(params: ProjectSearchParams) {
    const data = await this.get<{ result?: { projects?: FreelancerProject[] } } | { projects?: FreelancerProject[] }>(
      '/projects/0.1/projects/active/',
      buildFreelancerQuery(params),
    );
    const projects = ('result' in data ? data.result?.projects : (data as { projects?: FreelancerProject[] }).projects) ?? [];
    return projects.map(normalizeFreelancerProject);
  }
}
