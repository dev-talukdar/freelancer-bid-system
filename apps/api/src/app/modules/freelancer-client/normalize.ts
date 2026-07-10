import type { FreelancerProject, KnownProjectType, NormalizedProject } from './types.js';

const toKnownProjectType = (type: string | undefined): KnownProjectType | undefined => {
  if (type === 'fixed' || type === 'hourly') return type;
  return undefined;
};

export function normalizeFreelancerProject(
  project: FreelancerProject,
): NormalizedProject | undefined {
  const type = toKnownProjectType(project.type);
  if (typeof project.id !== 'number' || typeof project.title !== 'string' || type === undefined) {
    return undefined;
  }

  const normalized: NormalizedProject = {
    id: project.id,
    title: project.title,
    type,
    jobs: (project.jobs ?? [])
      .filter((job) => typeof job.id === 'number' && typeof job.name === 'string')
      .map((job) => {
        const normalizedJob = { id: job.id, name: job.name };
        return job.seo_url === undefined ? normalizedJob : { ...normalizedJob, seoUrl: job.seo_url };
      }),
  };
  if (project.preview_description !== undefined) normalized.previewDescription = project.preview_description;
  if (project.description !== undefined) normalized.description = project.description;
  if (project.status !== undefined) normalized.status = project.status;
  if (project.frontend_project_status !== undefined) normalized.frontendProjectStatus = project.frontend_project_status;
  if (project.deleted !== undefined) normalized.deleted = project.deleted;
  const timeSubmitted = project.time_submitted ?? project.submitdate;
  if (timeSubmitted !== undefined) normalized.timeSubmitted = timeSubmitted;
  if (project.time_updated !== undefined) normalized.timeUpdated = project.time_updated;
  if (project.seo_url !== undefined) normalized.seoUrl = project.seo_url;
  if (project.language !== undefined) normalized.language = project.language;
  if (project.local !== undefined) normalized.local = project.local;
  if (project.currency !== undefined) normalized.currency = project.currency;
  if (project.budget !== undefined) normalized.budget = project.budget;
  if (project.bid_stats !== undefined) {
    const bidStats: NonNullable<NormalizedProject['bidStats']> = {};
    if (project.bid_stats.bid_count !== undefined) bidStats.bidCount = project.bid_stats.bid_count;
    if (project.bid_stats.bid_avg !== undefined) bidStats.bidAvg = project.bid_stats.bid_avg;
    normalized.bidStats = bidStats;
  }
  if (project.location?.country?.name !== undefined) normalized.clientCountry = project.location.country.name;
  if (project.location?.country?.code !== undefined) normalized.clientCountryCode = project.location.country.code;
  const ownerId = project.owner_id ?? project.owner?.id;
  if (ownerId !== undefined) normalized.ownerId = ownerId;
  return normalized;
}
