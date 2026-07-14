/* eslint-disable @typescript-eslint/require-await */
import { searchProfileSchema, type SearchProfileInput } from '@fbs/shared';

import { ALLOWED_COUNTRIES } from '../freelancer-client/allowlists.js';
import { SearchProfileModel } from './model.js';

interface SearchProfileCreatePayload {
  name: string;
  enabled: boolean;
  keywords: string[];
  excludedKeywords: string[];
  jobIds: number[];
  countries: string[];
  currencies: string[];
  languages: string[];
  projectTypes: Array<'fixed' | 'hourly'>;
  pollIntervalSeconds: number;
  notificationEnabled: boolean;
  soundEnabled: boolean;
  allowLocalProjects: boolean;
  maximumProjectAgeMinutes: number;
  minimumFixedBudget?: number | null;
  maximumFixedBudget?: number | null;
  minimumHourlyRate?: number | null;
  maximumHourlyRate?: number | null;
  maximumBidCount?: number | null;
}

type SearchProfileUpdatePayload = Partial<SearchProfileCreatePayload>;

export const TARGET_SKILL_IDS = [
  9, // JavaScript
  335, // HTML
  500, // Node.js
  759, // React.js
  1031, // Web Development
  1088, // Full Stack Development
  1092, // Backend Development
  1093, // Frontend Development
  1827, // Website Build
  2376, // Next.js
  2382, // Web Application
  2695, // SaaS
  2839, // Website Development
] as const;

const targetSkillIds = (): number[] => [...TARGET_SKILL_IDS];
export const DEFAULT_PROFILE_FILTERS = {
  languages: ['en'],
  minimumFixedBudget: 50,
  maximumFixedBudget: 50000,
  minimumHourlyRate: 20,
  maximumHourlyRate: 100,
  maximumBidCount: 200,
} as const;
export const defaultCountryCodes = (): string[] => ALLOWED_COUNTRIES.map((country) => country.code);
export const syncActiveProfileTargetSkillIds = async (): Promise<boolean> => false;
export const buildSearchProfileCreatePayload = (input: unknown): SearchProfileCreatePayload => {
  const parsed = searchProfileSchema.parse(input);

  const payload: SearchProfileCreatePayload = {
    name: parsed.name,
    enabled: parsed.enabled,
    keywords: parsed.keywords,
    excludedKeywords: parsed.excludedKeywords,
    jobIds: parsed.jobIds,
    countries: parsed.countries,
    currencies: parsed.currencies,
    languages: parsed.languages,
    projectTypes: parsed.projectTypes,
    pollIntervalSeconds: parsed.pollIntervalSeconds,
    notificationEnabled: parsed.notificationEnabled,
    soundEnabled: parsed.soundEnabled,
    allowLocalProjects: parsed.allowLocalProjects,
    maximumProjectAgeMinutes: parsed.maximumProjectAgeMinutes,
  };

  if (parsed.minimumFixedBudget !== undefined)
    payload.minimumFixedBudget = parsed.minimumFixedBudget;
  if (parsed.maximumFixedBudget !== undefined)
    payload.maximumFixedBudget = parsed.maximumFixedBudget;
  if (parsed.minimumHourlyRate !== undefined) payload.minimumHourlyRate = parsed.minimumHourlyRate;
  if (parsed.maximumHourlyRate !== undefined) payload.maximumHourlyRate = parsed.maximumHourlyRate;
  if (parsed.maximumBidCount !== undefined) payload.maximumBidCount = parsed.maximumBidCount;

  return payload;
};

export const buildSearchProfileUpdatePayload = (input: unknown): SearchProfileUpdatePayload => {
  const parsed = searchProfileSchema.partial().parse(input);

  const payload: SearchProfileUpdatePayload = {};

  if (parsed.name !== undefined) {
    payload.name = parsed.name;
  }

  if (parsed.enabled !== undefined) {
    payload.enabled = parsed.enabled;
  }

  if (parsed.keywords !== undefined) {
    payload.keywords = parsed.keywords;
  }

  if (parsed.excludedKeywords !== undefined) {
    payload.excludedKeywords = parsed.excludedKeywords;
  }

  if (parsed.jobIds !== undefined) {
    payload.jobIds = parsed.jobIds;
  }

  if (parsed.countries !== undefined) {
    payload.countries = parsed.countries;
  }

  if (parsed.currencies !== undefined) {
    payload.currencies = parsed.currencies;
  }

  if (parsed.languages !== undefined) {
    payload.languages = parsed.languages;
  }

  if (parsed.projectTypes !== undefined) {
    payload.projectTypes = parsed.projectTypes;
  }

  if (parsed.pollIntervalSeconds !== undefined) {
    payload.pollIntervalSeconds = parsed.pollIntervalSeconds;
  }

  if (parsed.notificationEnabled !== undefined) {
    payload.notificationEnabled = parsed.notificationEnabled;
  }

  if (parsed.soundEnabled !== undefined) {
    payload.soundEnabled = parsed.soundEnabled;
  }

  if (parsed.allowLocalProjects !== undefined) {
    payload.allowLocalProjects = parsed.allowLocalProjects;
  }

  if (parsed.maximumProjectAgeMinutes !== undefined) {
    payload.maximumProjectAgeMinutes = parsed.maximumProjectAgeMinutes;
  }

  if (parsed.minimumFixedBudget !== undefined) {
    payload.minimumFixedBudget = parsed.minimumFixedBudget ?? null;
  }

  if (parsed.maximumFixedBudget !== undefined) {
    payload.maximumFixedBudget = parsed.maximumFixedBudget ?? null;
  }

  if (parsed.minimumHourlyRate !== undefined) {
    payload.minimumHourlyRate = parsed.minimumHourlyRate ?? null;
  }

  if (parsed.maximumHourlyRate !== undefined) {
    payload.maximumHourlyRate = parsed.maximumHourlyRate ?? null;
  }

  if (parsed.maximumBidCount !== undefined) {
    payload.maximumBidCount = parsed.maximumBidCount ?? null;
  }

  return payload;
};

export const seedSearchProfile = async (): Promise<void> => {
  const existingProfile = await SearchProfileModel.exists({});

  if (existingProfile) {
    await SearchProfileModel.updateMany(
      {},
      {
        $set: {
          ...DEFAULT_PROFILE_FILTERS,
          countries: defaultCountryCodes(),
          currencies: [],
        },
      },
    );
    return;
  }

  await SearchProfileModel.create(
    buildSearchProfileCreatePayload({
      name: 'Web development monitoring',
      enabled: true,
      // Detection is skill/country/currency based; keywords are intentionally disabled.
      keywords: [],
      excludedKeywords: [],
      jobIds: targetSkillIds(),
      countries: defaultCountryCodes(),
      currencies: [],
      languages: [...DEFAULT_PROFILE_FILTERS.languages],
      projectTypes: ['fixed', 'hourly'],
      minimumFixedBudget: DEFAULT_PROFILE_FILTERS.minimumFixedBudget,
      maximumFixedBudget: DEFAULT_PROFILE_FILTERS.maximumFixedBudget,
      minimumHourlyRate: DEFAULT_PROFILE_FILTERS.minimumHourlyRate,
      maximumHourlyRate: DEFAULT_PROFILE_FILTERS.maximumHourlyRate,
      maximumBidCount: DEFAULT_PROFILE_FILTERS.maximumBidCount,
      pollIntervalSeconds: 30,
      maximumProjectAgeMinutes: 720,
      notificationEnabled: true,
      soundEnabled: true,
      allowLocalProjects: false,
    } satisfies SearchProfileInput),
  );
};

export const listProfiles = () => SearchProfileModel.find().sort({ createdAt: -1 }).lean();

export const createProfile = (input: unknown) =>
  SearchProfileModel.create(buildSearchProfileCreatePayload(input));

export const updateProfile = async (id: string, input: unknown) => {
  const payload = buildSearchProfileUpdatePayload(input);

  return SearchProfileModel.findByIdAndUpdate(
    id,
    {
      $set: payload,
    },
    {
      new: true,
      runValidators: true,
    },
  ).lean();
};

export const activateProfile = async (id: string) => {
  await SearchProfileModel.updateMany(
    {},
    {
      $set: {
        enabled: false,
      },
    },
  );

  return SearchProfileModel.findByIdAndUpdate(
    id,
    {
      $set: {
        enabled: true,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).lean();
};

export const getActiveProfile = () =>
  SearchProfileModel.findOne({
    enabled: true,
  })
    .sort({
      updatedAt: -1,
    })
    .lean();
