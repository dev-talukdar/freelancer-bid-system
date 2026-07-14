/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
import type {
  FreelancerActiveProjectsResult,
  FreelancerProject,
  FreelancerUser,
  ProjectSearchParams,
} from './types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ACTIVE_PROJECTS_PATH = '/projects/0.1/projects/active/';
const MAX_ACTIVE_PROJECT_PAGES = 100;

type WrappedActiveProjectsResult = { result?: FreelancerActiveProjectsResult };
const hasWrappedResult = (
  data: FreelancerActiveProjectsResult | WrappedActiveProjectsResult,
): data is WrappedActiveProjectsResult => 'result' in data;

const normalizeIdKey = (value: number | string | null | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined;

  const normalized = String(value).trim();

  return normalized.length > 0 ? normalized : undefined;
};

const buildUserLookup = (
  users: FreelancerActiveProjectsResult['users'],
): Map<string, FreelancerUser> => {
  const lookup = new Map<string, FreelancerUser>();

  if (Array.isArray(users)) {
    for (const user of users) {
      const id = normalizeIdKey(user.id);

      if (id !== undefined) {
        lookup.set(id, user);
      }
    }

    return lookup;
  }

  for (const [responseKey, user] of Object.entries(users ?? {})) {
    lookup.set(responseKey, user);

    const userId = normalizeIdKey(user.id);

    if (userId !== undefined) {
      lookup.set(userId, user);
    }
  }

  return lookup;
};

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

    const projects: Array<
      FreelancerProject & {
        __owner?: FreelancerUser;
      }
    > = [];

    for (let page = 0; page < MAX_ACTIVE_PROJECT_PAGES; page++) {
      const pageParams = {
        ...params,
        limit: pageSize,
        offset: startOffset + page * pageSize,
      };

      const data = await this.get<WrappedActiveProjectsResult | FreelancerActiveProjectsResult>(
        ACTIVE_PROJECTS_PATH,
        buildFreelancerQuery(pageParams),
      );

      const result: FreelancerActiveProjectsResult | undefined = hasWrappedResult(data)
        ? data.result
        : data;

      const pageProjects = result?.projects ?? [];
      const userLookup = buildUserLookup(result?.users);

      const sampleProject = pageProjects[0];

      if (page === 0 && sampleProject !== undefined) {
        const sampleOwnerId = normalizeIdKey(sampleProject.owner_id ?? sampleProject.owner?.id);

        const sampleOwner = sampleOwnerId === undefined ? undefined : userLookup.get(sampleOwnerId);

        logger.info(
          {
            projectsReturned: pageProjects.length,
            rawUsersShape: Array.isArray(result?.users) ? 'array' : typeof result?.users,
            usersIndexed: userLookup.size,

            sampleProjectId: sampleProject.id,
            sampleOwnerId,
            sampleOwnerFound: sampleOwner !== undefined,

            sampleProjectLocationCountry: sampleProject.location?.country,

            sampleOwnerCountry: sampleOwner?.country,

            sampleOwnerLocationCountry: sampleOwner?.location?.country,
          },
          'freelancer owner country response diagnostic',
        );
      }

      for (const project of pageProjects) {
        const ownerId = normalizeIdKey(project.owner_id ?? project.owner?.id);

        const owner = ownerId === undefined ? undefined : userLookup.get(ownerId);

        projects.push({
          ...project,
          ...(owner === undefined ? {} : { __owner: owner }),
        });
      }

      if (pageProjects.length < pageSize) {
        break;
      }
    }

    return projects.map((project) => {
      const { __owner, ...freelancerProject } = project;

      return normalizeFreelancerProject(freelancerProject, __owner);
    });
  }
}
