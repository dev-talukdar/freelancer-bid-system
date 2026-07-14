import { normalizeCountryCode, normalizeCurrencyCode } from './allowlists.js';
import type {
  FreelancerCountryValue,
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

const resolveCountryCode = (
  countries: Array<FreelancerCountryValue | undefined>,
): string | undefined => {
  for (const country of countries) {
    const rawCode = typeof country === 'string' ? country : (country?.code ?? undefined);

    const normalizedCode = normalizeCountryCode(rawCode);

    if (normalizedCode !== undefined) {
      return normalizedCode;
    }
  }

  return undefined;
};

const resolveCountryName = (
  countries: Array<FreelancerCountryValue | undefined>,
): string | undefined => {
  for (const country of countries) {
    if (typeof country === 'string') {
      const value = country.trim();

      if (value.length === 0) continue;

      // A value such as "US" is a code, not a country name.
      if (normalizeCountryCode(value) !== undefined) {
        continue;
      }

      return value;
    }

    const name = country?.name?.trim();

    if (name) {
      return name;
    }
  }

  return undefined;
};

// const ownerCountry = (owner: FreelancerUser | undefined) =>
//   owner?.location?.country ?? owner?.country;

// type FreelancerCountry = { name?: string; code?: string } | string | undefined;

// const countryName = (country: FreelancerCountry) =>
//   typeof country === 'string' ? country : country?.name;

// const countryCode = (country: FreelancerCountry) =>
//   typeof country === 'string' ? undefined : country?.code;

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
  if (project.currency !== undefined) {
    const currencyCode = normalizeCurrencyCode(project.currency.code);
    normalized.currency = { ...project.currency };
    if (currencyCode !== undefined) normalized.currency.code = currencyCode;
  }
  if (project.budget !== undefined) normalized.budget = project.budget;

  if (project.bid_stats !== undefined) {
    const bidStats: NonNullable<NormalizedProject['bidStats']> = {};
    if (project.bid_stats.bid_count !== undefined) bidStats.bidCount = project.bid_stats.bid_count;
    if (project.bid_stats.bid_avg !== undefined) bidStats.bidAvg = project.bid_stats.bid_avg;
    normalized.bidStats = bidStats;
  }

  const countryCandidates: Array<FreelancerCountryValue | undefined> = [
    owner?.country,
    owner?.location?.country,
    project.location?.country,
  ];
  const clientCountryCode = resolveCountryCode(countryCandidates);

  if (clientCountryCode !== undefined) {
    normalized.clientCountryCode = clientCountryCode;
  }
  const clientCountry = resolveCountryName(countryCandidates);

  if (clientCountry !== undefined) {
    normalized.clientCountry = clientCountry;
  }

  const ownerId = project.owner_id ?? project.owner?.id;
  if (ownerId !== undefined) normalized.ownerId = ownerId;

  return normalized;
}
