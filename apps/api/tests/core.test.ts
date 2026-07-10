import { describe, expect, it } from 'vitest';
import { normalizeFreelancerSeoUrl } from '@fbs/shared';
import { Types } from 'mongoose';
import { buildFreelancerQuery } from '../src/app/modules/freelancer-client/query.js';
import {
  calculateAdaptiveDelay,
  parseRateLimitHeaders,
  parseRateLimitLimit,
} from '../src/app/modules/freelancer-client/rate-limit.js';
import { normalizeFreelancerProject } from '../src/app/modules/freelancer-client/normalize.js';
import {
  createSkipReasons,
  isProjectOpen,
  projectMatches,
  projectSkipReason,
  type ProjectFilterProfile,
} from '../src/app/modules/project-monitor/filter.js';
import { PollLock } from '../src/app/modules/project-monitor/lock.js';
import { mapFreelancerError } from '../src/app/error/app-error.js';
import { realisticFreelancerActiveProjectResponse } from './fixtures/freelancer-active-project-response.js';
import type { NormalizedProject } from '../src/app/modules/freelancer-client/types.js';
import { buildSearchProfileCreatePayload } from '../src/app/modules/search-profile/service.js';
import { buildDetectedProjectCreatePayload } from '../src/app/modules/project-monitor/service.js';
import type { SearchProfileDocument } from '../src/app/modules/search-profile/model.js';

const activeProfile: ProjectFilterProfile = {
  keywords: ['react'],
  excludedKeywords: [],
  jobIds: [],
  countries: [],
  currencies: [],
  languages: ['en'],
  projectTypes: ['fixed', 'hourly'],
  allowLocalProjects: true,
  maximumProjectAgeMinutes: 10,
};

const legacyProfile: ProjectFilterProfile = {
  ...activeProfile,
  keywords: ['node'],
  excludedKeywords: ['spam'],
  jobIds: [9],
  countries: ['us'],
  currencies: ['USD'],
  projectTypes: ['fixed'],
  allowLocalProjects: false,
  maximumBidCount: 5,
};
const legacyProject = normalizeFreelancerProject({
  id: 1,
  title: 'Node API',
  type: 'fixed',
  status: 'active',
  time_submitted: Math.floor(Date.now() / 1000),
  seo_url: 'node-api',
  language: 'en',
  local: false,
  currency: { code: 'USD' },
  bid_stats: { bid_count: 2 },
  jobs: [{ id: 9, name: 'Node' }],
  location: { country: { code: 'us' } },
})!;
const normalizedRealisticProject = normalizeFreelancerProject(
  realisticFreelancerActiveProjectResponse.result.projects[0],
)!;
const realisticProject = {
  ...normalizedRealisticProject,
  timeSubmitted: Math.floor(Date.now() / 1000),
};

const objectIdProfile = { ...activeProfile, _id: new Types.ObjectId() } as SearchProfileDocument;

describe('api foundations', () => {
  it('serializes repeated array query parameters', () => {
    const qs = buildFreelancerQuery({ jobs: [9, 500], countries: ['us', 'ca'], compact: true });
    expect(qs.toString()).toContain('jobs%5B%5D=9');
    expect(qs.getAll('jobs[]')).toEqual(['9', '500']);
  });

  it('parses rate limit headers and adapts delay', () => {
    expect(parseRateLimitLimit('50, 1000;window=3600')[1]?.windowSeconds).toBe(3600);
    expect(calculateAdaptiveDelay(30000, { windows: [{ limit: 50 }], remaining: 5 })).toBe(60000);
  });

  it('parses rate-limit edge cases without undefined optional fields', () => {
    expect(parseRateLimitLimit('50;window=60, bad;window=10, 100;window=nope, 200')).toEqual([
      { limit: 50, windowSeconds: 60 },
      { limit: 100 },
      { limit: 200 },
    ]);
    expect(parseRateLimitLimit(null)).toEqual([]);
    expect(parseRateLimitHeaders(new Headers({ 'RateLimit-Limit': '10;window=1' }))).toEqual({
      windows: [{ limit: 10, windowSeconds: 1 }],
    });
    expect(parseRateLimitHeaders(new Headers({ 'RateLimit-Remaining': '7' })).remaining).toBe(7);
    expect(parseRateLimitHeaders(new Headers({ 'RateLimit-Remaining': 'invalid' }))).toEqual({
      windows: [],
    });
  });

  it('filters local projects and matches configured filters', () => {
    expect(projectMatches(legacyProfile, legacyProject)).toBe(true);
    expect(projectMatches(legacyProfile, { ...legacyProject, local: true })).toBe(false);
  });

  it('normalizes SEO URLs safely', () => {
    expect(normalizeFreelancerSeoUrl('/foo/bar')).toBe('foo/bar');
    expect(() => normalizeFreelancerSeoUrl('../bad')).toThrow();
  });

  it('locks concurrent polls', async () => {
    const lock = new PollLock();

    const firstPoll = lock.runExclusive(
      () =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(true), 20);
        }),
    );

    const secondPoll = lock.runExclusive(() => Promise.resolve(true));

    await expect(secondPoll).rejects.toThrow('Poll already running');
    await expect(firstPoll).resolves.toBe(true);
  });

  it('maps freelancer api errors', () => {
    const err = mapFreelancerError(429, { message: 'slow down' }, 'rid');
    expect(err.errorCode).toBe('FREELANCER_RATE_LIMITED');
    expect(err.freelancerRequestId).toBe('rid');
  });
});

describe('freelancer project normalization and matching', () => {
  it('normalizes snake_case response fields and rejects unknown project types', () => {
    expect(normalizedRealisticProject.previewDescription).toBe('Build a React admin dashboard');
    expect(normalizedRealisticProject.frontendProjectStatus).toBe('open');
    expect(normalizedRealisticProject.timeSubmitted).toBe(1710000000);
    expect(normalizedRealisticProject.timeUpdated).toBe(1710000100);
    expect(normalizedRealisticProject.bidStats).toEqual({ bidCount: 3, bidAvg: 420 });
    expect(normalizedRealisticProject.seoUrl).toBe('reactjs/React-dashboard-development');
    expect(normalizeFreelancerProject({ id: 2, title: 'Bad', type: 'contest' })).toBeUndefined();
  });

  it('allows empty jobIds and countries, including missing country', () => {
    const project: NormalizedProject = { ...realisticProject, jobs: [] };
    delete project.clientCountry;
    delete project.clientCountryCode;
    expect(projectMatches(activeProfile, project)).toBe(true);
  });

  it('matches one keyword case-insensitively', () => {
    expect(projectMatches({ ...activeProfile, keywords: ['DASHBOARD'] }, realisticProject)).toBe(
      true,
    );
  });

  it('matches keywords from normalized job names', () => {
    const project: NormalizedProject = { ...realisticProject, title: 'Frontend work' };
    delete project.previewDescription;
    delete project.description;
    expect(projectMatches({ ...activeProfile, keywords: ['react.js'] }, project)).toBe(true);
  });

  it('accepts active status and open frontend status', () => {
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: undefined, status: 'active' }),
    ).toBe(true);
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: 'open', status: 'closed' }),
    ).toBe(true);
  });

  it('rejects deleted and closed projects', () => {
    expect(projectSkipReason(activeProfile, { ...realisticProject, deleted: true })).toBe(
      'deleted',
    );
    expect(
      projectSkipReason(activeProfile, {
        ...realisticProject,
        frontendProjectStatus: 'closed',
        status: 'active',
      }),
    ).toBe('notOpen');
    expect(
      projectSkipReason(activeProfile, {
        ...realisticProject,
        frontendProjectStatus: undefined,
        status: 'closed',
      }),
    ).toBe('notOpen');
  });

  it('does not reject missing optional fields unnecessarily', () => {
    const minimal: NormalizedProject = {
      id: 99,
      title: 'React work',
      type: 'fixed',
      status: 'active',
      timeSubmitted: Math.floor(Date.now() / 1000),
      jobs: [],
    };
    expect(projectMatches({ ...activeProfile, languages: [] }, minimal)).toBe(true);
  });

  it('filters projects by allowed currencies', () => {
    expect(projectMatches({ ...activeProfile, currencies: ['USD'] }, realisticProject)).toBe(true);
    expect(projectSkipReason({ ...activeProfile, currencies: ['EUR'] }, realisticProject)).toBe(
      'currencyMismatch',
    );
  });

  it('handles nullable numeric filters and reports accurate reasons', () => {
    expect(
      projectSkipReason({ ...activeProfile, maximumBidCount: null }, realisticProject),
    ).toBeUndefined();
    expect(projectSkipReason({ ...activeProfile, maximumBidCount: 1 }, realisticProject)).toBe(
      'bidCountExceeded',
    );
    expect(
      projectSkipReason({ ...activeProfile, minimumFixedBudget: 1000 }, realisticProject),
    ).toBe('fixedBudgetMismatch');
    expect(projectSkipReason({ ...activeProfile, maximumFixedBudget: 10 }, realisticProject)).toBe(
      'fixedBudgetMismatch',
    );
    expect(
      projectSkipReason(
        { ...activeProfile, minimumHourlyRate: 1000 },
        { ...realisticProject, type: 'hourly' },
      ),
    ).toBe('hourlyRateMismatch');
  });

  it('allows local projects when allowLocalProjects is true', () => {
    expect(projectMatches(activeProfile, { ...realisticProject, local: true })).toBe(true);
  });

  it('applies project recency filtering from timeSubmitted', () => {
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    const profile: ProjectFilterProfile = {
      ...activeProfile,
      maximumProjectAgeMinutes: 10,
      keywords: [],
    };
    const base = {
      ...realisticProject,
      timeSubmitted: nowSeconds,
      timeUpdated: nowSeconds - 365 * 24 * 60 * 60,
    };

    expect(projectMatches(profile, { ...base, timeSubmitted: nowSeconds - 2 * 60 })).toBe(true);
    expect(
      projectMatches(profile, { ...base, timeSubmitted: Math.ceil((now - 10 * 60 * 1000) / 1000) }),
    ).toBe(true);
    expect(projectSkipReason(profile, { ...base, timeSubmitted: nowSeconds - 11 * 60 })).toBe(
      'tooOld',
    );
    expect(
      projectSkipReason(profile, {
        ...base,
        timeSubmitted: nowSeconds - 11 * 60,
        timeUpdated: nowSeconds,
      }),
    ).toBe('tooOld');
    expect(projectSkipReason(profile, { ...base, timeSubmitted: undefined })).toBe('invalidShape');
  });

  it('includes new skip reason diagnostics', () => {
    const skipReasons = createSkipReasons();
    skipReasons.bidCountExceeded++;
    skipReasons.currencyMismatch++;
    skipReasons.fixedBudgetMismatch++;
    skipReasons.hourlyRateMismatch++;
    expect(skipReasons.bidCountExceeded).toBe(1);
    expect(skipReasons.currencyMismatch).toBe(1);
    expect(skipReasons.fixedBudgetMismatch).toBe(1);
    expect(skipReasons.hourlyRateMismatch).toBe(1);
  });

  it.each([
    ['Casino website'],
    ['crypto casino platform'],
    ['online betting dashboard'],
    ['slot game development'],
    ['academic homework portal'],
    ['CaSiNo admin'],
  ])('rejects excluded keyword match: %s', (title) => {
    const profile: ProjectFilterProfile = {
      ...activeProfile,
      keywords: [],
      excludedKeywords: ['casino', 'crypto casino', 'betting', 'slot', 'academic', 'homework'],
    };
    expect(projectSkipReason(profile, { ...realisticProject, title })).toBe('excludedKeyword');
  });

  it('passes the mocked realistic React project through the matcher', () => {
    expect(projectMatches(activeProfile, realisticProject)).toBe(true);
  });
});

describe('mongoose payload builders', () => {
  it('omits undefined optional search profile values while preserving null and numbers', () => {
    const omitted = buildSearchProfileCreatePayload({ name: 'Omitted' });
    expect(Object.hasOwn(omitted, 'maximumBidCount')).toBe(false);
    const explicitNull = buildSearchProfileCreatePayload({ name: 'Nulls', maximumBidCount: null });
    expect(explicitNull.maximumBidCount).toBeNull();
    const populated = buildSearchProfileCreatePayload({
      name: 'Populated',
      maximumBidCount: 3,
      minimumFixedBudget: 100,
    });
    expect(populated.maximumBidCount).toBe(3);
    expect(populated.minimumFixedBudget).toBe(100);
  });

  it('omits undefined optional detected project values and keeps ObjectId persistence boundary', () => {
    const minimal: NormalizedProject = {
      id: 99,
      title: 'React work',
      type: 'fixed',
      status: 'active',
      timeSubmitted: Math.floor(Date.now() / 1000),
      jobs: [],
    };
    const payload = buildDetectedProjectCreatePayload(objectIdProfile, minimal);
    expect(payload.searchProfileId).toBeInstanceOf(Types.ObjectId);
    expect(Object.hasOwn(payload, 'descriptionPreview')).toBe(false);
    expect(Object.hasOwn(payload, 'rawSnapshot')).toBe(false);
    const populated = buildDetectedProjectCreatePayload(objectIdProfile, realisticProject);
    expect(populated.currency).toBe('USD');
    expect(populated.bidCount).toBe(3);
  });
});
