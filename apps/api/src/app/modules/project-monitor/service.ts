 
import { DEFAULT_POLL_INTERVAL_SECONDS, type ProjectType } from '@fbs/shared';
import type { Types } from 'mongoose';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { FreelancerClient } from '../freelancer-client/client.js';
import { DetectedProjectModel } from '../detected-project/model.js';
import { createSkipReasons, projectActivityDate, projectSkipReason } from './filter.js';
import { PollLock } from './lock.js';

import type { NormalizedProject, ProjectSearchParams } from '../freelancer-client/types.js';
import type { SearchProfileDocument } from '../search-profile/model.js';
import { getActiveProfile } from '../search-profile/service.js';

interface DetectedProjectCreateInput {
  freelancerProjectId: number;
  searchProfileId: Types.ObjectId;
  title: string;
  descriptionPreview?: string;
  projectType: ProjectType;
  currency?: string;
  budgetMinimum?: number;
  budgetMaximum?: number;
  bidCount?: number;
  averageBid?: number;
  jobs: Array<{ id: number; name: string }>;
  clientCountry?: string;
  seoUrl: string;
  timeSubmitted?: Date;
  timeUpdated?: Date;
}

const projectAgeMinutes = (project: NormalizedProject): number | undefined => {
  const activityAt = projectActivityDate(project);
  if (activityAt === undefined) return undefined;
  return Math.floor((Date.now() - activityAt.getTime()) / 60_000);
};

const projectIsoDate = (timestamp: number | undefined): string | undefined =>
  timestamp === undefined ? undefined : new Date(timestamp * 1000).toISOString();

const normalizedProjectSummary = (profile: SearchProfileDocument, project: NormalizedProject) => ({
  id: project.id,
  title: project.title,
  status: project.status,
  frontendProjectStatus: project.frontendProjectStatus,
  deleted: project.deleted,
  submittedAt: projectIsoDate(project.timeSubmitted),
  updatedAt: projectIsoDate(project.timeUpdated),
  activityAgeMinutes: projectAgeMinutes(project),
  skillIds: project.jobs.map((job) => job.id),
  skillNames: project.jobs.map((job) => job.name),
  skipReason: projectSkipReason(profile, project),
});

const logProjectFetchDiagnostics = (
  profile: SearchProfileDocument,
  projects: Array<NormalizedProject | undefined>,
) => {
  const normalizedProjects = projects.filter(
    (project): project is NormalizedProject => project !== undefined,
  );
  const firstProject = normalizedProjects[0];
  const lastProject = normalizedProjects.at(-1);
  logger.debug(
    {
      returned: projects.length,
      firstProject:
        firstProject === undefined ? undefined : normalizedProjectSummary(profile, firstProject),
      lastProject:
        lastProject === undefined ? undefined : normalizedProjectSummary(profile, lastProject),
      firstFiveProjects: normalizedProjects
        .slice(0, 5)
        .map((project) => normalizedProjectSummary(profile, project)),
    },
    'freelancer normalized project diagnostics',
  );
};

const logDebugProjectDiagnostic = (
  profile: SearchProfileDocument,
  projects: Array<NormalizedProject | undefined>,
) => {
  const debugProjectId = env.DEBUG_FREELANCER_PROJECT_ID;
  if (debugProjectId === undefined) return;
  const project = projects.find((candidate) => candidate?.id === debugProjectId);
  logger.info(
    {
      projectId: debugProjectId,
      fetched: project !== undefined,
      skipReason: project === undefined ? undefined : projectSkipReason(profile, project),
      normalizedProjectSummary:
        project === undefined ? undefined : normalizedProjectSummary(profile, project),
    },
    'freelancer debug project diagnostic',
  );
};

export function buildDetectedProjectCreatePayload(
  profile: SearchProfileDocument,
  project: NormalizedProject,
): DetectedProjectCreateInput {
  const payload: DetectedProjectCreateInput = {
    freelancerProjectId: project.id,
    searchProfileId: profile._id,
    title: project.title,
    projectType: project.type,
    jobs: project.jobs,
    seoUrl: project.seoUrl ?? String(project.id),
  };
  const clientCountry = project.clientCountry ?? project.clientCountryCode;
  if (clientCountry !== undefined) payload.clientCountry = clientCountry;
  if (project.previewDescription !== undefined)
    payload.descriptionPreview = project.previewDescription;
  if (project.currency?.code !== undefined) payload.currency = project.currency.code;
  if (project.budget?.minimum !== undefined) payload.budgetMinimum = project.budget.minimum;
  if (project.budget?.maximum !== undefined) payload.budgetMaximum = project.budget.maximum;
  if (project.bidStats?.bidCount !== undefined) payload.bidCount = project.bidStats.bidCount;
  if (project.bidStats?.bidAvg !== undefined) payload.averageBid = project.bidStats.bidAvg;
  if (project.timeSubmitted !== undefined)
    payload.timeSubmitted = new Date(project.timeSubmitted * 1000);
  if (project.timeUpdated !== undefined) payload.timeUpdated = new Date(project.timeUpdated * 1000);
  return payload;
}

export function buildMonitorSearchParams(profile: SearchProfileDocument): ProjectSearchParams {
  return {
    project_types: profile.projectTypes,
    sort_field: 'time_updated',
    reverse_sort: true,
    limit: 100,
    compact: true,
    full_description: true,
    job_details: true,
    user_details: true,
    user_country_details: true,
    user_display_info: true,
    user_employer_reputation: true,
  };
}

export interface MonitorRuntime {
  running: boolean;
  lastSuccessfulPoll?: Date;
  lastPollingError?: string | undefined;
  currentPollingIntervalSeconds: number;
}

export class ProjectMonitor {
  private timer: NodeJS.Timeout | undefined;
  readonly lock = new PollLock();
  state: MonitorRuntime = {
    running: false,
    currentPollingIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
  };

  constructor(private client = new FreelancerClient()) {}

  start() {
    if (this.state.running) return;
    this.state.running = true;
    logger.info({ intervalSeconds: this.state.currentPollingIntervalSeconds }, 'monitor started');
    void this.poll();
  }

  stop() {
    this.state.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    logger.info('monitor stopped');
  }

  private schedule() {
    if (!this.state.running) return;
    logger.debug(
      { intervalSeconds: this.state.currentPollingIntervalSeconds },
      'monitor next poll scheduled',
    );
    this.timer = setTimeout(
      () => void this.poll(),
      this.state.currentPollingIntervalSeconds * 1000,
    );
  }

  async poll() {
    return this.lock.runExclusive(async () => {
      const started = Date.now();
      const skipReasons = createSkipReasons();
      try {
        logger.info('monitor poll started');
        const profile = await getActiveProfile();
        if (!profile) {
          logger.warn(
            { durationMs: Date.now() - started },
            'monitor poll skipped: no active profile',
          );
          return { returned: 0, matched: 0, new: 0, skipped: 0, skipReasons };
        }
        this.state.currentPollingIntervalSeconds = Math.max(
          20,
          profile.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
        );
        logger.info(
          {
            profileId: profile._id,
            enabled: profile.enabled,
            maximumProjectAgeMinutes: profile.maximumProjectAgeMinutes,
            jobIds: profile.jobIds,
            countries: profile.countries,
            currencies: profile.currencies,
            languages: profile.languages,
            projectTypes: profile.projectTypes,
            maximumBidCount: profile.maximumBidCount,
            minimumFixedBudget: profile.minimumFixedBudget,
            maximumFixedBudget: profile.maximumFixedBudget,
            minimumHourlyRate: profile.minimumHourlyRate,
            maximumHourlyRate: profile.maximumHourlyRate,
          },
          'monitor active profile',
        );
        // Fetch a broad newest-first window, then apply all profile filters locally. Passing job,
        // country, or language filters to Freelancer can hide valid keyword matches before our matcher
        // sees them (for example website-development or QA projects whose skill IDs are not in our
        // configured web-development job list).
        const searchParams = buildMonitorSearchParams(profile);
        const projects = await this.client.activeProjects(searchParams);

        logProjectFetchDiagnostics(profile, projects);
        logDebugProjectDiagnostic(profile, projects);
        let matched = 0;
        let newCount = 0;
        for (const project of projects) {
          if (!project) {
            skipReasons.invalidShape++;
            continue;
          }
          const reason = projectSkipReason(profile, project);
          if (reason) {
            skipReasons[reason]++;
            logger.debug(
              {
                projectId: project.id,
                title: project.title,
                status: project.status,
                frontendProjectStatus: project.frontendProjectStatus,
                reason,
                deleted: project.deleted,
                submittedAt: projectIsoDate(project.timeSubmitted),
                updatedAt: projectIsoDate(project.timeUpdated),
                activityAgeMinutes: projectAgeMinutes(project),
                maximumProjectAgeMinutes: profile.maximumProjectAgeMinutes,
                projectSkillIds: project.jobs.map((job) => job.id),
                projectSkillNames: project.jobs.map((job) => job.name),
                configuredSkillIds: profile.jobIds,
                country: project.clientCountryCode ?? project.clientCountry,
                configuredCountries: profile.countries,
                currency: project.currency?.code,
                configuredCurrencies: profile.currencies,
                language: project.language,
                configuredLanguages: profile.languages,
                projectType: project.type,
                configuredProjectTypes: profile.projectTypes,
                budgetMinimum: project.budget?.minimum,
                budgetMaximum: project.budget?.maximum,
                bidCount: project.bidStats?.bidCount,
                maximumBidCount: profile.maximumBidCount,
              },
              'freelancer project rejected',
            );
            continue;
          }
          matched++;
          try {
            await DetectedProjectModel.create(buildDetectedProjectCreatePayload(profile, project));
            newCount++;
          } catch (e) {
            if (typeof e === 'object' && e && 'code' in e && e.code === 11000) {
              skipReasons.duplicate++;
              continue;
            }
            throw e;
          }
        }
        await DetectedProjectModel.deleteMany({
          detectedAt: {
            $lt: new Date(Date.now() - env.DETECTED_PROJECT_RETENTION_DAYS * 86400_000),
          },
        });
        this.state.lastSuccessfulPoll = new Date();
        this.state.lastPollingError = undefined;
        const skipped = Object.values(skipReasons).reduce((total, count) => total + count, 0);
        logger.info(
          {
            returned: projects.length,
            matched,
            new: newCount,
            duplicatesSkipped: skipReasons.duplicate,
            skipped,
            skipReasons,
            durationMs: Date.now() - started,
            nextPollIntervalSeconds: this.state.currentPollingIntervalSeconds,
            rateLimit: this.client.rateLimitState,
          },
          'poll complete',
        );
        return { returned: projects.length, matched, new: newCount, skipped, skipReasons };
      } catch (e) {
        this.state.lastPollingError = e instanceof Error ? e.message : 'Unknown polling error';
        logger.error(
          {
            err: e,
            durationMs: Date.now() - started,
            nextPollIntervalSeconds: this.state.currentPollingIntervalSeconds,
          },
          'poll failed',
        );
        throw e;
      } finally {
        this.schedule();
      }
    });
  }
}
export const monitor = new ProjectMonitor();
