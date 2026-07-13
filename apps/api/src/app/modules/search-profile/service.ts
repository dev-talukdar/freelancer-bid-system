/* eslint-disable @typescript-eslint/require-await */
import {
  DEFAULT_MAXIMUM_FIXED_BUDGET,
  DEFAULT_MAXIMUM_HOURLY_RATE,
  DEFAULT_MINIMUM_FIXED_BUDGET,
  DEFAULT_MINIMUM_HOURLY_RATE,
  searchProfileSchema,
  type SearchProfileInput,
} from '@fbs/shared';

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
  minimumFixedBudget?: number;
  maximumFixedBudget?: number;
  minimumHourlyRate?: number;
  maximumHourlyRate?: number;
  maximumBidCount?: number | null;
}

type SearchProfileUpdatePayload = Partial<SearchProfileCreatePayload>;

export const TARGET_SKILL_IDS = [
  9, // JavaScript
  335, // HTML
  500, // Node.js
  1088, // Full Stack Development
  1827, // Website Build
  2839, // Website Development
  1031, // Web Development
  759, // React.js
  1092, // Backend Development
  1093, // Frontend Development
  2376, // Next.js
  2382, // Web Application
  979, // TypeScript
] as const;

export const TARGET_COUNTRY_CODES = [
  'tw',
  'hk',
  'nz',
  'il',
  'sa',
  'nl',
  'gr',
  'es',
  'it',
  'ie',
  'sg',
  'pt',
  'kw',
  'qa',
  'ae',
  'no',
  'lu',
  'th',
  'dk',
  'at',
  'bh',
  'lt',
  'jp',
  'hr',
  'ee',
  'ro',
  'se',
  'ch',
  'pl',
  'be',
  'fr',
  'de',
  'gb',
  'au',
  'ca',
  'us',
] as const;

export const TARGET_CURRENCY_CODES = ['USD', 'GBP', 'EUR', 'AUD', 'NZD', 'CAD'] as const;

const targetSkillIds = (): number[] => [...TARGET_SKILL_IDS];

const requiredBudgetDefaults = {
  minimumFixedBudget: DEFAULT_MINIMUM_FIXED_BUDGET,
  maximumFixedBudget: DEFAULT_MAXIMUM_FIXED_BUDGET,
  minimumHourlyRate: DEFAULT_MINIMUM_HOURLY_RATE,
  maximumHourlyRate: DEFAULT_MAXIMUM_HOURLY_RATE,
} as const;

export const syncActiveProfileTargetSkillIds = async (): Promise<boolean> => false;
export const clearLegacyDefaultCountryFilters = async (): Promise<boolean> => {
  // Country is now a required notification gate, so startup must not silently remove
  // configured preferred countries. Keep this legacy hook as a no-op for safe upgrades.
  return false;
};

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

  payload.minimumFixedBudget =
    parsed.minimumFixedBudget ?? requiredBudgetDefaults.minimumFixedBudget;
  payload.maximumFixedBudget =
    parsed.maximumFixedBudget ?? requiredBudgetDefaults.maximumFixedBudget;
  payload.minimumHourlyRate = parsed.minimumHourlyRate ?? requiredBudgetDefaults.minimumHourlyRate;
  payload.maximumHourlyRate = parsed.maximumHourlyRate ?? requiredBudgetDefaults.maximumHourlyRate;
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
    payload.minimumFixedBudget =
      parsed.minimumFixedBudget ?? requiredBudgetDefaults.minimumFixedBudget;
  }

  if (parsed.maximumFixedBudget !== undefined) {
    payload.maximumFixedBudget =
      parsed.maximumFixedBudget ?? requiredBudgetDefaults.maximumFixedBudget;
  }

  if (parsed.minimumHourlyRate !== undefined) {
    payload.minimumHourlyRate =
      parsed.minimumHourlyRate ?? requiredBudgetDefaults.minimumHourlyRate;
  }

  if (parsed.maximumHourlyRate !== undefined) {
    payload.maximumHourlyRate =
      parsed.maximumHourlyRate ?? requiredBudgetDefaults.maximumHourlyRate;
  }

  if (parsed.maximumBidCount !== undefined) {
    payload.maximumBidCount = parsed.maximumBidCount ?? null;
  }

  return payload;
};

export const seedSearchProfile = async (): Promise<void> => {
  const existingProfile = await SearchProfileModel.exists({});

  if (existingProfile) return;

  await SearchProfileModel.create(
    buildSearchProfileCreatePayload({
      name: 'Web development monitoring',
      enabled: true,
      // Detection is skill/country/currency based; keywords are intentionally disabled.
      keywords: [],
      excludedKeywords: [],
      jobIds: targetSkillIds(),
      countries: [...TARGET_COUNTRY_CODES],
      currencies: [...TARGET_CURRENCY_CODES],
      languages: [],
      projectTypes: ['fixed', 'hourly'],
      minimumFixedBudget: requiredBudgetDefaults.minimumFixedBudget,
      maximumFixedBudget: requiredBudgetDefaults.maximumFixedBudget,
      minimumHourlyRate: requiredBudgetDefaults.minimumHourlyRate,
      maximumHourlyRate: requiredBudgetDefaults.maximumHourlyRate,
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

export const enforceActiveProfileBudgetDefaults = async (): Promise<boolean> => {
  const result = await SearchProfileModel.updateMany(
    {
      $or: [
        { minimumFixedBudget: null },
        { minimumFixedBudget: { $exists: false } },
        { maximumFixedBudget: null },
        { maximumFixedBudget: { $exists: false } },
        { minimumHourlyRate: null },
        { minimumHourlyRate: { $exists: false } },
        { maximumHourlyRate: null },
        { maximumHourlyRate: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          minimumFixedBudget: {
            $ifNull: ['$minimumFixedBudget', requiredBudgetDefaults.minimumFixedBudget],
          },
          maximumFixedBudget: {
            $ifNull: ['$maximumFixedBudget', requiredBudgetDefaults.maximumFixedBudget],
          },
          minimumHourlyRate: {
            $ifNull: ['$minimumHourlyRate', requiredBudgetDefaults.minimumHourlyRate],
          },
          maximumHourlyRate: {
            $ifNull: ['$maximumHourlyRate', requiredBudgetDefaults.maximumHourlyRate],
          },
        },
      },
    ],
  );

  return result.modifiedCount > 0;
};

export const getActiveProfile = () =>
  SearchProfileModel.findOne({
    enabled: true,
  })
    .sort({
      updatedAt: -1,
    })
    .lean();
