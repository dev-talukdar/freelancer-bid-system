import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { mapFreelancerError } from '../../error/app-error.js';
import { buildFreelancerQuery } from './query.js';
import {
  calculateAdaptiveDelay,
  parseRateLimitHeaders,
  type RateLimitState,
} from './rate-limit.js';
import { normalizeFreelancerProject } from './normalize.js';
import type { FreelancerProject, FreelancerUser, ProjectSearchParams } from './types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ACTIVE_PROJECTS_PATH = '/projects/0.1/projects/active/';
const MAX_ACTIVE_PROJECT_PAGES = 3;

interface ActiveProjectsResponseBody {
  projects?: FreelancerProject[];
  users?: Record<string, FreelancerUser>;
}

interface ActiveProjectsWrappedResponse {
  result?: ActiveProjectsResponseBody;
}

type ActiveProjectsResponse = ActiveProjectsWrappedResponse | ActiveProjectsResponseBody;

const isWrappedActiveProjectsResponse = (
  response: ActiveProjectsResponse,
): response is ActiveProjectsWrappedResponse => Object.hasOwn(response, 'result');

export class FreelancerClient {
  public rateLimitState: RateLimitState = { windows: [] };

  constructor(
    private token = env.FREELANCER_ACCESS_TOKEN,
    private baseUrl = env.FREELANCER_API_BASE_URL,
  ) {}

  private async get<T>(path: string, qs?: URLSearchParams, attempt = 0): Promise<T> {
    if (!this.token)
      throw mapFreelancerError(401, { message: 'Freelancer token is not configured' });
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    logger.debug({ path, query: qs?.toString() ?? '' }, 'freelancer api request');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      headers: { 'Freelancer-OAuth-V1': this.token },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    this.rateLimitState = parseRateLimitHeaders(res.headers);
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => ({}));
      logger.warn(
        {
          status: res.status,
          freelancerRequestId: res.headers.get('x-request-id'),
          rateLimit: this.rateLimitState,
        },
        'freelancer api error',
      );
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
    return user as {
      id?: number;
      username?: string;
      display_name?: string;
      email_verified?: boolean;
    };
  }

  async activeProjects(params: ProjectSearchParams) {
    const pageSize = params.limit ?? 100;
    const startOffset = params.offset ?? 0;
    const projects: Array<{ project: FreelancerProject; owner: FreelancerUser | undefined }> = [];

    for (let page = 0; page < MAX_ACTIVE_PROJECT_PAGES; page++) {
      const pageParams = { ...params, limit: pageSize, offset: startOffset + page * pageSize };
      const data = await this.get<ActiveProjectsResponse>(
        ACTIVE_PROJECTS_PATH,
        buildFreelancerQuery(pageParams),
      );
      const responseBody: ActiveProjectsResponseBody | undefined = isWrappedActiveProjectsResponse(
        data,
      )
        ? data.result
        : data;
      const users = responseBody?.users;
      const pageProjects = responseBody?.projects ?? [];
      projects.push(
        ...pageProjects.map((project) => {
          const ownerId = project.owner_id ?? project.owner?.id;
          const owner = ownerId === undefined ? undefined : users?.[String(ownerId)];
          return { project, owner };
        }),
      );

      if (pageProjects.length < pageSize) break;
    }

    return projects.map(({ project, owner }) => normalizeFreelancerProject(project, owner));
  }
}
