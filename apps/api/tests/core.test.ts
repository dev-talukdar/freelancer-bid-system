/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { describe, expect, it, vi } from 'vitest';
import { normalizeFreelancerSeoUrl } from '@fbs/shared';
import { Types } from 'mongoose';
import { buildFreelancerQuery } from '../src/app/modules/freelancer-client/query.js';
import {
  detectedProjectsQuerySchema,
  objectIdParamSchema,
  unnotifiedProjectsQuerySchema,
} from '../src/app/modules/detected-project/validation.js';
import {
  calculateAdaptiveDelay,
  parseRateLimitHeaders,
  parseRateLimitLimit,
} from '../src/app/modules/freelancer-client/rate-limit.js';
import {
  normalizeFreelancerProject,
  normalizeOptionalText,
  normalizeUnixTimestamp,
} from '../src/app/modules/freelancer-client/normalize.js';
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
import { FreelancerClient } from '../src/app/modules/freelancer-client/client.js';
import type { NormalizedProject } from '../src/app/modules/freelancer-client/types.js';
import {
  TARGET_COUNTRY_CODES,
  TARGET_CURRENCY_CODES,
  TARGET_SKILL_IDS,
  buildSearchProfileCreatePayload,
  clearLegacyDefaultCountryFilters,
  seedSearchProfile,
  syncActiveProfileTargetSkillIds,
} from '../src/app/modules/search-profile/service.js';
import {
  buildDetectedProjectCreatePayload,
  buildMonitorSearchParams,
} from '../src/app/modules/project-monitor/service.js';
import {
  SearchProfileModel,
  type SearchProfileDocument,
} from '../src/app/modules/search-profile/model.js';

const activeProfile: ProjectFilterProfile = {
  keywords: ['react'],
  excludedKeywords: [],
  jobIds: [69],
  countries: ['us'],
  currencies: ['USD'],
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
  clientCountryCode: 'us',
  timeSubmitted: Math.floor(Date.now() / 1000),
};

const objectIdProfile = { ...activeProfile, _id: new Types.ObjectId() } as SearchProfileDocument;

describe('api foundations', () => {
  it('serializes repeated array query parameters', () => {
    const qs = buildFreelancerQuery({ jobs: [9, 500], countries: ['us', 'ca'], compact: true });
    expect(qs.toString()).toContain('jobs%5B%5D=9');
    expect(qs.getAll('jobs[]')).toEqual(['9', '500']);
  });

  it('preserves boolean false and serializes from_time', () => {
    const qs = buildFreelancerQuery({ reverse_sort: false, from_time: 1_720_000_000 });
    expect(qs.get('reverse_sort')).toBe('false');
    expect(qs.get('from_time')).toBe('1720000000');
  });

  it('builds latest-first monitor searches with profile filters and recency window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T12:00:00.000Z'));
    const params = buildMonitorSearchParams({
      ...objectIdProfile,
      jobIds: [9, 500],
      countries: ['us', 'gb'],
      languages: ['en'],
      minimumFixedBudget: 100,
      maximumFixedBudget: 1000,
      minimumHourlyRate: 25,
      maximumHourlyRate: 150,
      maximumProjectAgeMinutes: 30,
    });

    const monitorQs = buildFreelancerQuery(params);
    expect(monitorQs.get('sort_field')).toBe('time_updated');
    expect(monitorQs.get('reverse_sort')).toBe('false');
    expect(monitorQs.get('limit')).toBe('100');
    expect(monitorQs.get('from_time')).toBe(String(Math.floor(Date.now() / 1000) - 30 * 60));
    expect(monitorQs.getAll('jobs[]')).toEqual(['9', '500']);
    expect(monitorQs.getAll('countries[]')).toEqual(['us', 'gb']);
    expect(monitorQs.getAll('languages[]')).toEqual(['en']);
    expect(monitorQs.get('min_price')).toBe('100');
    expect(monitorQs.get('max_price')).toBe('1000');
    expect(monitorQs.get('min_hourly_rate')).toBe('25');
    expect(monitorQs.get('max_hourly_rate')).toBe('150');
    vi.useRealTimers();
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

  it('validates detected project route parameters and query limits', () => {
    expect(objectIdParamSchema.safeParse({ id: new Types.ObjectId().toString() }).success).toBe(
      true,
    );
    expect(objectIdParamSchema.safeParse({ id: 'bad-id' }).success).toBe(false);
    expect(unnotifiedProjectsQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(unnotifiedProjectsQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(detectedProjectsQuerySchema.parse({ unreadOnly: 'true' }).unreadOnly).toBe(true);
  });
});

describe('freelancer project normalization and matching', () => {
  it('normalizes timestamps and optional text safely', () => {
    expect(normalizeUnixTimestamp(1_720_000_000)).toBe(1_720_000_000);
    expect(normalizeUnixTimestamp(1_720_000_000_123)).toBe(1_720_000_000);
    expect(normalizeUnixTimestamp(undefined)).toBeUndefined();
    expect(normalizeUnixTimestamp(Number.NaN)).toBeUndefined();
    expect(normalizeUnixTimestamp(0)).toBeUndefined();
    expect(normalizeUnixTimestamp(-1)).toBeUndefined();
    expect(normalizeOptionalText(' OPEN ')).toBe('open');
    expect(normalizeOptionalText('   ')).toBeUndefined();
  });

  it('normalizes client country from owner user details when compact projects omit location', () => {
    const normalized = normalizeFreelancerProject(
      {
        id: 40578441,
        title: 'SEO GEO Monthly management',
        type: 'fixed',
        status: 'active',
        frontend_project_status: 'open',
        time_submitted: Math.floor(Date.now() / 1000),
        jobs: [
          { id: 9, name: 'JavaScript' },
          { id: 335, name: 'HTML' },
        ],
        currency: { code: 'AUD' },
        budget: { minimum: 30, maximum: 250 },
        owner_id: 11,
      },
      { id: 11, location: { country: { code: 'au', name: 'Australia' } } },
    );

    expect(normalized?.clientCountryCode).toBe('au');
    expect(normalized?.clientCountry).toBe('Australia');
    expect(
      projectMatches(
        { ...activeProfile, jobIds: [9], countries: ['au'], currencies: ['AUD'], languages: [] },
        normalized!,
      ),
    ).toBe(true);
  });

  it('normalizes snake_case response fields and rejects unknown project types', () => {
    expect(normalizedRealisticProject.previewDescription).toBe('Build a React admin dashboard');
    expect(normalizedRealisticProject.frontendProjectStatus).toBe('open');
    expect(normalizedRealisticProject.timeSubmitted).toBe(1710000000);
    expect(normalizedRealisticProject.timeUpdated).toBe(1710000100);
    expect(normalizedRealisticProject.bidStats).toEqual({ bidCount: 3, bidAvg: 420 });
    expect(normalizedRealisticProject.seoUrl).toBe('reactjs/React-dashboard-development');
    expect(normalizeFreelancerProject({ id: 2, title: 'Bad', type: 'contest' })).toBeUndefined();
  });

  it('rejects missing required skill, country, and currency filters', () => {
    expect(projectSkipReason({ ...activeProfile, jobIds: [] }, realisticProject)).toBe(
      'jobMismatch',
    );
    expect(projectSkipReason({ ...activeProfile, countries: [] }, realisticProject)).toBe(
      'countryMismatch',
    );
    expect(projectSkipReason({ ...activeProfile, currencies: [] }, realisticProject)).toBe(
      'currencyMismatch',
    );
  });

  it('does not use keywords as a substitute for required skill IDs', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: ['DASHBOARD'], jobIds: [500] },
        realisticProject,
      ),
    ).toBe('jobMismatch');
  });

  it('accepts active/open variants and open frontend status', () => {
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: undefined, status: 'active' }),
    ).toBe(true);
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: 'open', status: 'closed' }),
    ).toBe(true);
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: ' OPEN ', status: ' CLOSED ' }),
    ).toBe(true);
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: 'closed', status: ' ACTIVE ' }),
    ).toBe(true);
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: undefined, status: 'open' }),
    ).toBe(true);
    expect(
      isProjectOpen({
        ...realisticProject,
        frontendProjectStatus: 'frozen open',
        status: 'pending',
      }),
    ).toBe(true);
    expect(
      isProjectOpen({
        ...realisticProject,
        frontendProjectStatus: 'active_open',
        status: 'pending',
      }),
    ).toBe(true);

    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: 'closed', status: 'inactive' }),
    ).toBe(false);
    expect(
      isProjectOpen({ ...realisticProject, frontendProjectStatus: undefined, status: undefined }),
    ).toBe(false);
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
    ).toBeUndefined();
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
    expect(projectSkipReason({ ...activeProfile, languages: [] }, minimal)).toBe('jobMismatch');
  });

  it('matches configured country names and aliases against country codes', () => {
    const profile = {
      ...activeProfile,
      countries: [
        'USA',
        'Taiwan',
        'Poland',
        'Kuwait',
        'Qatar',
        'United Arab Emirates',
        'Norway',
        'Luxembourg',
        'Thailand',
        'Denmark',
        'Austria',
        'Bahrain',
        'Lithuania',
        'Japan',
        'Croatia',
        'Estonia',
        'Romania',
      ],
    };

    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'us' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'tw' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountry: 'Poland' })).toBe(true);
    expect(
      projectMatches(profile, {
        ...realisticProject,
        clientCountryCode: undefined,
        clientCountry: 'United States',
      }),
    ).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'kw' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'qa' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'ae' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountry: 'Norway' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountry: 'Luxembourg' })).toBe(
      true,
    );
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'th' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'dk' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'at' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'bh' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'lt' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'jp' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'hr' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'ee' })).toBe(true);
    expect(projectMatches(profile, { ...realisticProject, clientCountryCode: 'ro' })).toBe(true);
  });

  it('filters projects by allowed currencies and blocks INR', () => {
    expect(projectMatches({ ...activeProfile, currencies: ['USD'] }, realisticProject)).toBe(true);

    expect(projectMatches({ ...activeProfile, currencies: ['usd'] }, realisticProject)).toBe(true);
    expect(
      projectMatches(
        { ...activeProfile, currencies: ['euro'] },
        { ...realisticProject, currency: { code: 'EUR' } },
      ),
    ).toBe(true);
    expect(
      projectMatches(
        { ...activeProfile, currencies: ['GBP', 'EUR', 'AUD', 'NZD', 'CAD'] },
        { ...realisticProject, currency: { code: 'CAD' } },
      ),
    ).toBe(true);

    expect(projectSkipReason({ ...activeProfile, currencies: ['EUR'] }, realisticProject)).toBe(
      'currencyMismatch',
    );
    expect(
      projectSkipReason(
        { ...activeProfile, currencies: ['INR', 'USD'] },
        { ...realisticProject, currency: { code: 'INR' } },
      ),
    ).toBe('currencyMismatch');
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
    ).toBeUndefined();
    expect(
      projectSkipReason(profile, { ...base, timeSubmitted: undefined, timeUpdated: undefined }),
    ).toBe('invalidShape');
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

  it('accepts project when one configured skill ID matches', () => {
    expect(
      projectMatches(
        { ...activeProfile, keywords: ['nonmatching'], jobIds: [500] },
        {
          ...realisticProject,
          title: 'Unrelated',
          previewDescription: 'Unrelated',
          jobs: [{ id: 500, name: 'Node.js' }],
        },
      ),
    ).toBe(true);
  });

  it('rejects project when skill ID misses even if keyword matches title', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: ['dashboard'], jobIds: [500] },
        { ...realisticProject, title: 'Dashboard build', jobs: [{ id: 1, name: 'Other' }] },
      ),
    ).toBe('jobMismatch');
  });

  it('rejects project when skill ID misses even if keyword matches description', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: ['client portal'], jobIds: [500] },
        {
          ...realisticProject,
          title: 'Unrelated',
          previewDescription: 'Unrelated',
          description: 'Build a client portal',
          jobs: [{ id: 1, name: 'Other' }],
        },
      ),
    ).toBe('jobMismatch');
  });

  it('rejects project when skill ID does not match', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: ['dashboard'], jobIds: [500] },
        {
          ...realisticProject,
          title: 'Mobile app',
          previewDescription: 'Native mobile work',
          description: 'Swift project',
          jobs: [{ id: 1, name: 'iOS' }],
        },
      ),
    ).toBe('jobMismatch');
  });

  it('excluded keyword rejects even when skill ID matches', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: [], excludedKeywords: ['casino'], jobIds: [500] },
        { ...realisticProject, title: 'Casino dashboard', jobs: [{ id: 500, name: 'Node.js' }] },
      ),
    ).toBe('excludedKeyword');
  });

  it('empty jobIds block notifications because a skill match is required', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: [], jobIds: [] },
        {
          ...realisticProject,
          title: 'Unrelated',
          previewDescription: 'No configured relevance filters',
        },
      ),
    ).toBe('jobMismatch');
  });

  it('accepts multiple project skills with one matching ID', () => {
    expect(
      projectMatches(
        { ...activeProfile, keywords: ['nonmatching'], jobIds: [979] },
        {
          ...realisticProject,
          title: 'Unrelated',
          previewDescription: 'Unrelated',
          jobs: [
            { id: 1, name: 'Other' },
            { id: 979, name: 'TypeScript' },
          ],
        },
      ),
    ).toBe(true);
  });

  it('does not use normalized skill names as a keyword fallback', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: ['Next JS'], jobIds: [500] },
        {
          ...realisticProject,
          title: 'Unrelated',
          previewDescription: 'Unrelated',
          jobs: [{ id: 1, name: 'Next.js' }],
        },
      ),
    ).toBe('jobMismatch');
  });

  it('continues applying filters after relevance matching', () => {
    expect(
      projectSkipReason(
        { ...activeProfile, keywords: [], jobIds: [500], currencies: ['EUR'] },
        { ...realisticProject, clientCountryCode: 'us', jobs: [{ id: 500, name: 'Node.js' }] },
      ),
    ).toBe('currencyMismatch');
  });

  it('passes the mocked realistic React project through the matcher', () => {
    expect(projectMatches(activeProfile, realisticProject)).toBe(true);
  });
});

describe('mongoose payload builders', () => {
  it('seeds configured target skill IDs into new profiles', () => {
    const payload = buildSearchProfileCreatePayload({
      name: 'Target skills',
      jobIds: [...TARGET_SKILL_IDS],
    });
    expect(payload.jobIds).toEqual([...TARGET_SKILL_IDS]);
  });

  it('does not overwrite active profile choices during startup sync', async () => {
    const findOne = vi.spyOn(SearchProfileModel, 'findOne');
    const updateOne = vi.spyOn(SearchProfileModel, 'updateOne');

    await expect(syncActiveProfileTargetSkillIds()).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();

    findOne.mockRestore();
    updateOne.mockRestore();
  });

  it('does not run profile sync when profiles already exist', async () => {
    const exists = vi
      .spyOn(SearchProfileModel, 'exists')
      .mockResolvedValue({ _id: new Types.ObjectId() } as never);
    const create = vi.spyOn(SearchProfileModel, 'create');

    await seedSearchProfile();

    expect(create).not.toHaveBeenCalled();
    exists.mockRestore();
    create.mockRestore();
  });

  it('keeps configured preferred countries during legacy startup hook', async () => {
    const findOne = vi.spyOn(SearchProfileModel, 'findOne');

    await expect(clearLegacyDefaultCountryFilters()).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();

    findOne.mockRestore();
  });

  it('seeds required country/currency/skill profile filters for realistic notifications', () => {
    const payload = buildSearchProfileCreatePayload({
      name: 'Web development monitoring',
      enabled: true,
      keywords: [],
      excludedKeywords: [],
      jobIds: [...TARGET_SKILL_IDS],
      countries: [...TARGET_COUNTRY_CODES],
      currencies: [...TARGET_CURRENCY_CODES],

      languages: [],
      projectTypes: ['fixed', 'hourly'],
      minimumFixedBudget: null,
      maximumFixedBudget: null,
      minimumHourlyRate: null,
      maximumHourlyRate: null,
      pollIntervalSeconds: 30,
      maximumProjectAgeMinutes: 720,
      notificationEnabled: true,
      soundEnabled: true,
      allowLocalProjects: false,
    });
    expect(
      projectMatches(payload, {
        ...realisticProject,
        language: undefined,
        clientCountryCode: 'in',
        clientCountry: 'India',
      }),
    ).toBe(false);
  });

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

describe('freelancer client pagination', () => {
  it('stops pagination safely when a page is shorter than the requested limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          result: {
            projects: [
              {
                id: 1,
                title: 'Fresh React project',
                type: 'fixed',
                status: 'active',
                time_submitted: Math.floor(Date.now() / 1000),
                jobs: [{ id: 759, name: 'React.js' }],
              },
            ],
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new FreelancerClient('token', 'https://www.freelancer.com/api');

    const projects = await client.activeProjects({ limit: 2, reverse_sort: false, from_time: 1 });

    expect(projects).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('reverse_sort=false');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('from_time=1');
    vi.unstubAllGlobals();
  });

  it('enriches active projects with owner country details from the users response map', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          result: {
            projects: [
              {
                id: 40578438,
                title: 'Empowerment Referral Platform Development',
                type: 'fixed',
                status: 'active',
                time_submitted: Math.floor(Date.now() / 1000),
                owner_id: 22,
                jobs: [
                  { id: 9, name: 'JavaScript' },
                  { id: 335, name: 'HTML' },
                ],
                currency: { code: 'USD' },
              },
            ],
            users: {
              '22': { id: 22, location: { country: { code: 'us', name: 'United States' } } },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new FreelancerClient('token', 'https://www.freelancer.com/api');

    const projects = await client.activeProjects({ limit: 2 });

    expect(projects[0]?.clientCountryCode).toBe('us');
    expect(projects[0]?.clientCountry).toBe('United States');
    vi.unstubAllGlobals();
  });

  it('uses a maximum of three active-project pages', async () => {
    const page = (offset: number) => ({
      ok: true,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          result: {
            projects: [
              {
                id: offset + 1,
                title: `Fresh project ${offset}`,
                type: 'fixed',
                status: 'active',
                time_submitted: Math.floor(Date.now() / 1000),
                jobs: [{ id: 759, name: 'React.js' }],
              },
            ],
          },
        }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(0))
      .mockResolvedValueOnce(page(1))
      .mockResolvedValueOnce(page(2));
    vi.stubGlobal('fetch', fetchMock);
    const client = new FreelancerClient('token', 'https://www.freelancer.com/api');

    const projects = await client.activeProjects({ limit: 1 });

    expect(projects).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });
});
