import { describe, expect, it } from 'vitest';
import { normalizeFreelancerSeoUrl } from '@fbs/shared';
import { buildFreelancerQuery } from '../src/app/modules/freelancer-client/query.js';
import { parseRateLimitLimit, calculateAdaptiveDelay } from '../src/app/modules/freelancer-client/rate-limit.js';
import { normalizeFreelancerProject } from '../src/app/modules/freelancer-client/normalize.js';
import { isProjectOpen, projectMatches, projectSkipReason } from '../src/app/modules/project-monitor/filter.js';
import { PollLock } from '../src/app/modules/project-monitor/lock.js';
import { mapFreelancerError } from '../src/app/error/app-error.js';
import { realisticFreelancerActiveProjectResponse } from './fixtures/freelancer-active-project-response.js';
import type { SearchProfileDocument } from '../src/app/modules/search-profile/model.js';
import type { NormalizedProject } from '../src/app/modules/freelancer-client/types.js';

const activeProfile = {
  keywords: ['react'],
  excludedKeywords: [],
  jobIds: [],
  countries: [],
  languages: ['en'],
  projectTypes: ['fixed', 'hourly'],
  allowLocalProjects: true,
  maximumBidCount: undefined,
  minimumFixedBudget: undefined,
  maximumFixedBudget: undefined,
  minimumHourlyRate: undefined,
  maximumHourlyRate: undefined,
} as unknown as SearchProfileDocument;

const legacyProfile = { ...activeProfile, keywords: ['node'], excludedKeywords: ['spam'], jobIds: [9], countries: ['us'], projectTypes: ['fixed'], allowLocalProjects: false, maximumBidCount: 5 } as unknown as SearchProfileDocument;
const legacyProject = normalizeFreelancerProject({ id: 1, title: 'Node API', type: 'fixed', status: 'active', seo_url: 'node-api', language: 'en', local: false, bid_stats: { bid_count: 2 }, jobs: [{ id: 9, name: 'Node' }], location: { country: { code: 'us' } } })!;
const realisticProject = normalizeFreelancerProject(realisticFreelancerActiveProjectResponse.result.projects[0])!;

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
    await expect(Promise.all([lock.runExclusive(() => new Promise((r) => setTimeout(() => r(true), 20))), lock.runExclusive(async () => true)])).rejects.toThrow('Poll already running');
  });

  it('maps freelancer api errors', () => {
    const err = mapFreelancerError(429, { message: 'slow down' }, 'rid');
    expect(err.errorCode).toBe('FREELANCER_RATE_LIMITED');
    expect(err.freelancerRequestId).toBe('rid');
  });
});

describe('freelancer project normalization and matching', () => {
  it('normalizes snake_case response fields', () => {
    expect(realisticProject.previewDescription).toBe('Build a React admin dashboard');
    expect(realisticProject.frontendProjectStatus).toBe('open');
    expect(realisticProject.timeSubmitted).toBe(1710000000);
    expect(realisticProject.timeUpdated).toBe(1710000100);
    expect(realisticProject.bidStats).toEqual({ bidCount: 3, bidAvg: 420 });
    expect(realisticProject.seoUrl).toBe('reactjs/React-dashboard-development');
  });

  it('allows empty jobIds and countries, including missing country', () => {
    expect(projectMatches(activeProfile, { ...realisticProject, jobs: [], clientCountry: undefined, clientCountryCode: undefined })).toBe(true);
  });

  it('matches one keyword case-insensitively', () => {
    expect(projectMatches({ ...activeProfile, keywords: ['DASHBOARD'] } as SearchProfileDocument, realisticProject)).toBe(true);
  });

  it('matches keywords from normalized job names', () => {
    expect(projectMatches({ ...activeProfile, keywords: ['react.js'] } as SearchProfileDocument, { ...realisticProject, title: 'Frontend work', previewDescription: undefined, description: undefined })).toBe(true);
  });

  it('accepts active status and open frontend status', () => {
    expect(isProjectOpen({ ...realisticProject, frontendProjectStatus: undefined, status: 'active' })).toBe(true);
    expect(isProjectOpen({ ...realisticProject, frontendProjectStatus: 'open', status: 'closed' })).toBe(true);
  });

  it('rejects deleted and closed projects', () => {
    expect(projectSkipReason(activeProfile, { ...realisticProject, deleted: true })).toBe('deleted');
    expect(projectSkipReason(activeProfile, { ...realisticProject, frontendProjectStatus: 'closed', status: 'active' })).toBe('notOpen');
    expect(projectSkipReason(activeProfile, { ...realisticProject, frontendProjectStatus: undefined, status: 'closed' })).toBe('notOpen');
  });

  it('does not reject missing optional fields unnecessarily', () => {
    const minimal: NormalizedProject = { id: 99, title: 'React work', type: 'fixed', status: 'active', jobs: [] };
    expect(projectMatches({ ...activeProfile, languages: [] } as SearchProfileDocument, minimal)).toBe(true);
  });

  it('allows local projects when allowLocalProjects is true', () => {
    expect(projectMatches(activeProfile, { ...realisticProject, local: true })).toBe(true);
  });

  it('does not count duplicates as new insertions', () => {
    const seen = new Set<number>();
    const projects = [realisticProject, realisticProject];
    let inserted = 0;
    for (const project of projects) {
      if (!seen.has(project.id) && projectMatches(activeProfile, project)) {
        seen.add(project.id);
        inserted++;
      }
    }
    expect(inserted).toBe(1);
  });

  it('passes the mocked realistic React project through the matcher', () => {
    expect(projectMatches(activeProfile, realisticProject)).toBe(true);
  });
});
