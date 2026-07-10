import type { SearchProfileDocument } from '../search-profile/model.js';
import type { NormalizedProject } from '../freelancer-client/types.js';

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
  | 'projectTypeMismatch'
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
  projectTypeMismatch: 0,
  duplicate: 0,
});

const normalized = (value: string) => value.trim().toLowerCase();

export function isProjectOpen(project: NormalizedProject): boolean {
  if (project.deleted === true) return false;
  if (project.frontendProjectStatus) return project.frontendProjectStatus === 'open';
  return project.status === 'active';
}

export function projectSubmissionDate(project: NormalizedProject): Date | undefined {
  if (typeof project.timeSubmitted !== 'number' || !Number.isFinite(project.timeSubmitted) || project.timeSubmitted <= 0) return undefined;
  const submittedAt = new Date(project.timeSubmitted * 1000);
  if (Number.isNaN(submittedAt.getTime())) return undefined;
  return submittedAt;
}

export function projectSkipReason(profile: SearchProfileDocument, project: NormalizedProject): SkipReason | undefined {
  const submittedAt = projectSubmissionDate(project);
  if (submittedAt === undefined) return 'invalidShape';
  if (project.deleted === true) return 'deleted';
  if (!isProjectOpen(project)) return 'notOpen';
  const maximumAgeMinutes = profile.maximumProjectAgeMinutes ?? 10;
  const maximumAgeMs = maximumAgeMinutes * 60 * 1000;
  if (Date.now() - submittedAt.getTime() > maximumAgeMs) return 'tooOld';
  if (project.local === true && !profile.allowLocalProjects) return 'localProject';

  const matchesProjectType = profile.projectTypes.length === 0 || profile.projectTypes.includes(project.type as 'fixed' | 'hourly');
  if (!matchesProjectType) return 'projectTypeMismatch';

  const searchableText = [project.title, project.previewDescription, project.description, ...project.jobs.map((job) => job.name)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const excludedKeywordMatch = (profile.excludedKeywords as string[]).some((keyword) => searchableText.includes(normalized(keyword)));
  if (excludedKeywordMatch) return 'excludedKeyword';

  const keywordMatch =
    profile.keywords.length === 0 || (profile.keywords as string[]).some((keyword) => searchableText.includes(normalized(keyword)));
  if (!keywordMatch) return 'keywordMismatch';

  const matchesJobs = profile.jobIds.length === 0 || project.jobs.some((job) => profile.jobIds.includes(job.id));
  if (!matchesJobs) return 'jobMismatch';

  const profileCountries = (profile.countries as string[]).map(normalized);
  const clientCountry = project.clientCountryCode ?? project.clientCountry;
  const matchesCountry = profileCountries.length === 0 || (clientCountry !== undefined && profileCountries.includes(normalized(clientCountry)));
  if (!matchesCountry) return 'countryMismatch';

  const profileLanguages = (profile.languages as string[]).map(normalized);
  const matchesLanguage = profileLanguages.length === 0 || (project.language !== undefined && profileLanguages.includes(normalized(project.language)));
  if (!matchesLanguage) return 'languageMismatch';

  if (profile.maximumBidCount !== undefined && (project.bidStats?.bidCount ?? 0) > profile.maximumBidCount) return 'keywordMismatch';

  const min = project.budget?.minimum;
  const max = project.budget?.maximum;
  if (project.type === 'fixed') {
    if (profile.minimumFixedBudget !== undefined && (max ?? 0) < profile.minimumFixedBudget) return 'projectTypeMismatch';
    if (profile.maximumFixedBudget !== undefined && (min ?? 0) > profile.maximumFixedBudget) return 'projectTypeMismatch';
  } else {
    if (profile.minimumHourlyRate !== undefined && (max ?? 0) < profile.minimumHourlyRate) return 'projectTypeMismatch';
    if (profile.maximumHourlyRate !== undefined && (min ?? 0) > profile.maximumHourlyRate) return 'projectTypeMismatch';
  }

  return undefined;
}

export function projectMatches(profile: SearchProfileDocument, project: NormalizedProject): boolean {
  return projectSkipReason(profile, project) === undefined;
}
