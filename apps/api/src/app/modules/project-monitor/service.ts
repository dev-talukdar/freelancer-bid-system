import {
  DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES,
  DEFAULT_POLL_INTERVAL_SECONDS,
  type ProjectType,
} from '@fbs/shared';
import type { Types } from 'mongoose';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { FreelancerClient } from '../freelancer-client/client.js';
import { DetectedProjectModel } from '../detected-project/model.js';
import { createSkipReasons, projectActivityDate, projectSkipReason } from './filter.js';
import { PollLock } from './lock.js';
import { ProjectMonitorCheckpointModel } from './checkpoint-model.js';

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

const CHECKPOINT_KEY = 'freelancer-project-monitor';
const OVERLAP_SECONDS = 5 * 60;
const unixSecondsNow = () => Math.floor(Date.now() / 1000);

const hasFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function buildMonitorSearchParams(
  profile: SearchProfileDocument,
  checkpointFromTime?: number,
): ProjectSearchParams {
  const maximumProjectAgeMinutes =
    profile.maximumProjectAgeMinutes ?? DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES;
  const profileFromTime = unixSecondsNow() - maximumProjectAgeMinutes * 60;
  // Always keep the full configured recency window in the Freelancer query.
  // The checkpoint is used only as an overlap optimization; using it as the only
  // lower bound can hide projects that are still within maximumProjectAgeMinutes
  // (for example, projects posted up to 12 hours ago when polling every 30s).
  const fromTime = Math.min(checkpointFromTime ?? profileFromTime, profileFromTime);

  const params: ProjectSearchParams = {
    from_time: fromTime,
    sort_field: 'time_updated',
    reverse_sort: false,
    limit: 100,
    compact: true,
    full_description: true,
    job_details: true,
    user_details: true,
    user_country_details: true,
    user_display_info: true,
    user_employer_reputation: true,
  };

  if (profile.projectTypes.length > 0) params.project_types = profile.projectTypes;
  if (profile.jobIds.length > 0) params.jobs = profile.jobIds;
  if (profile.countries.length > 0) params.countries = profile.countries;
  if (profile.languages.length > 0) params.languages = profile.languages;
  if (hasFiniteNumber(profile.minimumFixedBudget)) params.min_price = profile.minimumFixedBudget;
  if (hasFiniteNumber(profile.maximumFixedBudget)) params.max_price = profile.maximumFixedBudget;
  if (hasFiniteNumber(profile.minimumHourlyRate))
    params.min_hourly_rate = profile.minimumHourlyRate;
  if (hasFiniteNumber(profile.maximumHourlyRate))
    params.max_hourly_rate = profile.maximumHourlyRate;

  return params;
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
            allowedCountryFilter: 'authoritative allowlist',
            allowedCurrencyFilter: 'authoritative allowlist',
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
        // Ask Freelancer for the same newest matching slice that the website search uses, then keep
        // the local matcher as the source of truth for currencies, budgets, excluded keywords, local
        // projects, bid counts, and any response-shape differences. Freelancer documents
        // reverse_sort=true as ascending order, so keep it false for latest-first results.
        const checkpoint = await ProjectMonitorCheckpointModel.findOne({
          key: CHECKPOINT_KEY,
        }).lean();
        const savedFromTime = checkpoint?.lastSuccessfulFromTime;
        const checkpointFromTime =
          typeof savedFromTime === 'number'
            ? Math.max(0, savedFromTime - OVERLAP_SECONDS)
            : undefined;
        const searchParams = buildMonitorSearchParams(profile, checkpointFromTime);
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
                countryFilter: 'authoritative allowlist',
                currency: project.currency?.code,
                currencyFilter: 'authoritative allowlist',
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
        const newestActivity = projects.reduce<Date | undefined>((latest, project) => {
          if (!project) return latest;
          const activityAt = projectActivityDate(project);
          if (activityAt === undefined) return latest;
          return latest === undefined || activityAt > latest ? activityAt : latest;
        }, undefined);
        await ProjectMonitorCheckpointModel.findOneAndUpdate(
          { key: CHECKPOINT_KEY },
          {
            $set: {
              lastSuccessfulFromTime: unixSecondsNow(),
              ...(newestActivity === undefined ? {} : { lastSeenProjectActivity: newestActivity }),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
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
