import { DEFAULT_POLL_INTERVAL_SECONDS, type ProjectType } from '@fbs/shared';
import type { Types } from 'mongoose';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { FreelancerClient } from '../freelancer-client/client.js';
import { DetectedProjectModel } from '../detected-project/model.js';
import { activeProfile } from '../search-profile/service.js';
import { createSkipReasons, projectSkipReason } from './filter.js';
import { PollLock } from './lock.js';

import type { NormalizedProject } from '../freelancer-client/types.js';
import type { SearchProfileDocument } from '../search-profile/model.js';

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
  if (project.previewDescription !== undefined) payload.descriptionPreview = project.previewDescription;
  if (project.currency?.code !== undefined) payload.currency = project.currency.code;
  if (project.budget?.minimum !== undefined) payload.budgetMinimum = project.budget.minimum;
  if (project.budget?.maximum !== undefined) payload.budgetMaximum = project.budget.maximum;
  if (project.bidStats?.bidCount !== undefined) payload.bidCount = project.bidStats.bidCount;
  if (project.bidStats?.bidAvg !== undefined) payload.averageBid = project.bidStats.bidAvg;
  if (project.timeSubmitted !== undefined) payload.timeSubmitted = new Date(project.timeSubmitted * 1000);
  if (project.timeUpdated !== undefined) payload.timeUpdated = new Date(project.timeUpdated * 1000);
  return payload;
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
    void this.poll();
  }

  stop() {
    this.state.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule() {
    if (!this.state.running) return;
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
        const profile = await activeProfile();
        if (!profile) return { returned: 0, matched: 0, new: 0, skipped: 0, skipReasons };
        this.state.currentPollingIntervalSeconds = Math.max(20, profile.pollIntervalSeconds);
        const projects = await this.client.activeProjects({
          project_types: profile.projectTypes,
          jobs: profile.jobIds,
          countries: profile.countries,
          languages: profile.languages,
          sort_field: 'time_updated',
          reverse_sort: false,
          limit: 50,
          compact: true,
          full_description: true,
          job_details: true,
          user_details: true,
          user_country_details: true,
          user_display_info: true,
          user_employer_reputation: true,
        });
        if (env.NODE_ENV === 'development' && projects[0])
          logger.debug({ project: projects[0] }, 'first normalized freelancer project sample');
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
                language: project.language,
                type: project.type,
                reason,
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
            skipped,
            skipReasons,
            durationMs: Date.now() - started,
            rateLimit: this.client.rateLimitState,
          },
          'poll complete',
        );
        return { returned: projects.length, matched, new: newCount, skipped, skipReasons };
      } catch (e) {
        this.state.lastPollingError = e instanceof Error ? e.message : 'Unknown polling error';
        logger.error({ err: e }, 'poll failed');
        throw e;
      } finally {
        this.schedule();
      }
    });
  }
}
export const monitor = new ProjectMonitor();
