import type {
  FreelancerProject,
  FreelancerUser,
  KnownProjectType,
  NormalizedProject,
} from './types.js';

const toKnownProjectType = (value: string | undefined): KnownProjectType | undefined => {
  if (value === 'fixed' || value === 'hourly') return value;
  return undefined;
};

export const normalizeUnixTimestamp = (value: number | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
};

export const normalizeOptionalText = (value: string | undefined): string | undefined => {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
};

const userCountry = (
  user: Pick<FreelancerUser, 'country' | 'location'> | undefined,
): { name?: string; code?: string } | undefined => user?.country ?? user?.location?.country;

export function normalizeFreelancerProject(
  project: FreelancerProject,
  owner?: FreelancerUser,
): NormalizedProject | undefined {
  const type = toKnownProjectType(normalizeOptionalText(project.type));
  const title = typeof project.title === 'string' ? project.title.trim() : undefined;

  if (
    typeof project.id !== 'number' ||
    title === undefined ||
    title.length === 0 ||
    type === undefined
  ) {
    return undefined;
  }

  const normalized: NormalizedProject = {
    id: project.id,
    title,
    type,
    jobs: (project.jobs ?? [])
      .filter((job) => typeof job.id === 'number' && typeof job.name === 'string')
      .map((job) => {
        const normalizedJob = { id: job.id, name: job.name };
        return job.seo_url === undefined
          ? normalizedJob
          : { ...normalizedJob, seoUrl: job.seo_url };
      }),
  };

  if (project.preview_description !== undefined)
    normalized.previewDescription = project.preview_description;
  if (project.description !== undefined) normalized.description = project.description;

  const status = normalizeOptionalText(project.status);
  if (status !== undefined) normalized.status = status;

  const frontendProjectStatus = normalizeOptionalText(project.frontend_project_status);
  if (frontendProjectStatus !== undefined) normalized.frontendProjectStatus = frontendProjectStatus;

  if (project.deleted !== undefined) normalized.deleted = project.deleted;

  const timeSubmitted = normalizeUnixTimestamp(project.time_submitted ?? project.submitdate);
  if (timeSubmitted !== undefined) normalized.timeSubmitted = timeSubmitted;

  const timeUpdated = normalizeUnixTimestamp(project.time_updated);
  if (timeUpdated !== undefined) normalized.timeUpdated = timeUpdated;

  if (project.seo_url !== undefined) normalized.seoUrl = project.seo_url;

  const language = normalizeOptionalText(project.language);
  if (language !== undefined) normalized.language = language;

  if (project.local !== undefined) normalized.local = project.local;
  if (project.currency !== undefined) normalized.currency = project.currency;
  if (project.budget !== undefined) normalized.budget = project.budget;

  if (project.bid_stats !== undefined) {
    const bidStats: NonNullable<NormalizedProject['bidStats']> = {};
    if (project.bid_stats.bid_count !== undefined) bidStats.bidCount = project.bid_stats.bid_count;
    if (project.bid_stats.bid_avg !== undefined) bidStats.bidAvg = project.bid_stats.bid_avg;
    normalized.bidStats = bidStats;
  }

  const fallbackCountry = userCountry(owner) ?? userCountry(project.owner);
  const projectCountry = project.location?.country;

  const clientCountryName = projectCountry?.name ?? fallbackCountry?.name;
  if (clientCountryName !== undefined) normalized.clientCountry = clientCountryName;

  const clientCountryCode = normalizeOptionalText(projectCountry?.code ?? fallbackCountry?.code);
  if (clientCountryCode !== undefined) normalized.clientCountryCode = clientCountryCode;

  const ownerId = project.owner_id ?? project.owner?.id;
  if (ownerId !== undefined) normalized.ownerId = ownerId;

  return normalized;
}
