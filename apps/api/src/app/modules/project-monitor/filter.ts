import type { SearchProfileDocument } from '../search-profile/model.js';
import type { NormalizedProject } from '../freelancer-client/types.js';
import { logger } from '../../config/logger.js';

export type SkipReason =
  | 'invalidShape'
  | 'deleted'
  | 'notOpen'
  | 'tooOld'
  | 'localProject'
  | 'keywordMismatch'
  | 'excludedKeyword'
  | 'jobMismatch'
  | 'countryMismatch'
  | 'languageMismatch'
  | 'currencyMismatch'
  | 'projectTypeMismatch'
  | 'bidCountExceeded'
  | 'fixedBudgetMismatch'
  | 'hourlyRateMismatch'
  | 'duplicate';

export const createSkipReasons = (): Record<SkipReason, number> => ({
  invalidShape: 0,
  deleted: 0,
  notOpen: 0,
  tooOld: 0,
  localProject: 0,
  keywordMismatch: 0,
  excludedKeyword: 0,
  jobMismatch: 0,
  countryMismatch: 0,
  languageMismatch: 0,
  currencyMismatch: 0,
  projectTypeMismatch: 0,
  bidCountExceeded: 0,
  fixedBudgetMismatch: 0,
  hourlyRateMismatch: 0,
  duplicate: 0,
});

export type ProjectFilterProfile = Pick<
  SearchProfileDocument,
  | 'keywords'
  | 'excludedKeywords'
  | 'jobIds'
  | 'countries'
  | 'currencies'
  | 'languages'
  | 'projectTypes'
  | 'allowLocalProjects'
  | 'maximumProjectAgeMinutes'
  | 'maximumBidCount'
  | 'minimumFixedBudget'
  | 'maximumFixedBudget'
  | 'minimumHourlyRate'
  | 'maximumHourlyRate'
>;

export const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalized = normalize;
const compact = (value: string): string => value.replace(/\s+/g, '');
const includesNormalized = (source: string, normalizedNeedle: string): boolean =>
  source.includes(normalizedNeedle) || compact(source).includes(compact(normalizedNeedle));

const COUNTRY_ALIAS_GROUPS = [
  ['tw', 'taiwan'],
  ['hk', 'hong kong'],
  ['nz', 'new zealand'],
  ['il', 'israel'],
  ['sa', 'saudi arabia'],
  ['nl', 'netherlands', 'the netherlands', 'holland'],
  ['gr', 'greece'],
  ['es', 'spain'],
  ['it', 'italy'],
  ['ie', 'ireland'],
  ['sg', 'singapore'],
  ['pt', 'portugal'],
  ['kw', 'kuwait'],
  ['qa', 'qatar'],
  ['ae', 'united arab emirates', 'uae', 'u a e'],
  ['no', 'norway'],
  ['lu', 'luxembourg'],
  ['th', 'thailand'],
  ['dk', 'denmark'],
  ['at', 'austria'],
  ['bh', 'bahrain'],
  ['lt', 'lithuania'],
  ['jp', 'japan'],
  ['hr', 'croatia'],
  ['ee', 'estonia'],
  ['ro', 'romania'],
  ['se', 'sweden'],
  ['ch', 'switzerland'],
  ['pl', 'poland'],
  ['be', 'belgium'],
  ['fr', 'france'],
  ['de', 'germany'],
  ['gb', 'united kingdom', 'uk', 'u k', 'great britain', 'england'],
  ['au', 'australia'],
  ['ca', 'canada'],
  ['us', 'united states', 'united states of america', 'usa', 'u s a', 'america'],
] as const;

const countryTokens = (value: string | undefined): string[] => {
  if (value === undefined) return [];
  const token = normalized(value);
  const aliasGroup = COUNTRY_ALIAS_GROUPS.find((group) =>
    (group as readonly string[]).includes(token),
  );
  return aliasGroup === undefined ? [token] : [...aliasGroup];
};

const isDefinedNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const OPEN_STATUS_PATTERNS = [/\bactive\b/i, /\bopen\b/i];
const CLOSED_STATUS_PATTERNS = [
  /\bclosed\b/i,
  /\bcomplete(d)?\b/i,
  /\bcancel(l)?ed\b/i,
  /\bdeleted\b/i,
];

const statusLooksOpen = (value: string | undefined): boolean => {
  if (value === undefined) return false;
  const normalizedStatus = normalize(value);
  if (normalizedStatus.length === 0) return false;
  return (
    OPEN_STATUS_PATTERNS.some((pattern) => pattern.test(normalizedStatus)) &&
    !CLOSED_STATUS_PATTERNS.some((pattern) => pattern.test(normalizedStatus))
  );
};

export function isProjectOpen(project: NormalizedProject): boolean {
  if (project.deleted === true) return false;
  return statusLooksOpen(project.frontendProjectStatus) || statusLooksOpen(project.status);
}

const projectDateFromUnixTimestamp = (timestamp: number | undefined): Date | undefined => {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0)
    return undefined;
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

export function projectSubmissionDate(project: NormalizedProject): Date | undefined {
  return projectDateFromUnixTimestamp(project.timeSubmitted);
}

export function projectActivityDate(project: NormalizedProject): Date | undefined {
  const submittedAt = projectDateFromUnixTimestamp(project.timeSubmitted);
  const updatedAt = projectDateFromUnixTimestamp(project.timeUpdated);
  if (submittedAt === undefined) return updatedAt;
  if (updatedAt === undefined) return submittedAt;
  return updatedAt > submittedAt ? updatedAt : submittedAt;
}

export function projectSkipReason(
  profile: ProjectFilterProfile,
  project: NormalizedProject,
): SkipReason | undefined {
  const activityAt = projectActivityDate(project);
  if (activityAt === undefined) return 'invalidShape';

  if (project.deleted === true) return 'deleted';
  if (!isProjectOpen(project)) return 'notOpen';
  const maximumAgeMinutes = profile.maximumProjectAgeMinutes ?? 10;
  const maximumAgeMs = maximumAgeMinutes * 60 * 1000;
  if (Date.now() - activityAt.getTime() > maximumAgeMs) return 'tooOld';
  if (project.local === true && !profile.allowLocalProjects) return 'localProject';

  const matchesProjectType =
    profile.projectTypes.length === 0 || profile.projectTypes.includes(project.type);
  if (!matchesProjectType) return 'projectTypeMismatch';

  const projectText = [project.title, project.previewDescription, project.description]
    .filter((value): value is string => typeof value === 'string')
    .map(normalize)
    .join(' ');
  const projectSkillIds = project.jobs.map((job) => job.id);
  const projectSkillNames = project.jobs.map((job) => normalize(job.name));

  const excludedKeywordMatch = profile.excludedKeywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);

    return (
      includesNormalized(projectText, normalizedKeyword) ||
      projectSkillNames.some((skillName) => includesNormalized(skillName, normalizedKeyword))
    );
  });
  if (excludedKeywordMatch) return 'excludedKeyword';

  const hasJobFilters = profile.jobIds.length > 0;
  const jobMatch =
    !hasJobFilters || projectSkillIds.some((jobId) => profile.jobIds.includes(jobId));

  const hasKeywordFilters = profile.keywords.length > 0;
  const keywordMatch =
    !hasKeywordFilters ||
    profile.keywords.some((keyword) => {
      const normalizedKeyword = normalize(keyword);

      return (
        includesNormalized(projectText, normalizedKeyword) ||
        projectSkillNames.some((skillName) => includesNormalized(skillName, normalizedKeyword))
      );
    });

  const relevanceMatch = (!hasJobFilters && !hasKeywordFilters) || jobMatch || keywordMatch;
  if (!relevanceMatch) {
    logger.debug(
      {
        projectId: project.id,
        title: project.title,
        projectSkillIds,
        projectSkillNames: project.jobs.map((job) => job.name),
        configuredJobIds: profile.jobIds,
        keywordMatch,
        jobMatch,
        reason: 'jobMismatch',
      },
      'freelancer project rejected for relevance',
    );
    return 'jobMismatch';
  }

  const profileCountries = profile.countries.flatMap(countryTokens);
  const clientCountries = [project.clientCountryCode, project.clientCountry].flatMap(countryTokens);

  const matchesCountry =
    profileCountries.length === 0 ||
    clientCountries.some((clientCountry) => profileCountries.includes(clientCountry));
  if (!matchesCountry) return 'countryMismatch';

  const profileCurrencies = profile.currencies.map(normalized);
  const projectCurrency = project.currency?.code;
  const matchesCurrency =
    profileCurrencies.length === 0 ||
    (projectCurrency !== undefined && profileCurrencies.includes(normalized(projectCurrency)));
  if (!matchesCurrency) return 'currencyMismatch';

  const profileLanguages = profile.languages.map(normalized);
  const matchesLanguage =
    profileLanguages.length === 0 ||
    (project.language !== undefined && profileLanguages.includes(normalized(project.language)));
  if (!matchesLanguage) return 'languageMismatch';

  if (
    isDefinedNumber(profile.maximumBidCount) &&
    (project.bidStats?.bidCount ?? 0) > profile.maximumBidCount
  )
    return 'bidCountExceeded';

  const min = project.budget?.minimum;
  const max = project.budget?.maximum;
  if (project.type === 'fixed') {
    if (isDefinedNumber(profile.minimumFixedBudget) && (max ?? 0) < profile.minimumFixedBudget)
      return 'fixedBudgetMismatch';
    if (isDefinedNumber(profile.maximumFixedBudget) && (min ?? 0) > profile.maximumFixedBudget)
      return 'fixedBudgetMismatch';
  } else {
    if (isDefinedNumber(profile.minimumHourlyRate) && (max ?? 0) < profile.minimumHourlyRate)
      return 'hourlyRateMismatch';
    if (isDefinedNumber(profile.maximumHourlyRate) && (min ?? 0) > profile.maximumHourlyRate)
      return 'hourlyRateMismatch';
  }

  return undefined;
}

export function projectMatches(profile: ProjectFilterProfile, project: NormalizedProject): boolean {
  return projectSkipReason(profile, project) === undefined;
}
