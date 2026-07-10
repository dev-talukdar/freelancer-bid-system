import { searchProfileSchema, type SearchProfileInput } from '@fbs/shared';

import { SearchProfileModel } from './model.js';

interface SearchProfileCreatePayload {
  name: string;
  enabled: boolean;
  keywords: string[];
  excludedKeywords: string[];
  jobIds: number[];
  countries: string[];
  languages: string[];
  projectTypes: Array<'fixed' | 'hourly'>;
  pollIntervalSeconds: number;
  notificationEnabled: boolean;
  soundEnabled: boolean;
  allowLocalProjects: boolean;
  maximumProjectAgeMinutes: number;
  minimumFixedBudget: number | null;
  maximumFixedBudget: number | null;
  minimumHourlyRate: number | null;
  maximumHourlyRate: number | null;
  maximumBidCount: number | null;
}

type SearchProfileUpdatePayload = Partial<SearchProfileCreatePayload>;

export const buildSearchProfileCreatePayload = (input: unknown): SearchProfileCreatePayload => {
  const parsed = searchProfileSchema.parse(input);

  return {
    name: parsed.name,
    enabled: parsed.enabled,
    keywords: parsed.keywords,
    excludedKeywords: parsed.excludedKeywords,
    jobIds: parsed.jobIds,
    countries: parsed.countries,
    languages: parsed.languages,
    projectTypes: parsed.projectTypes,
    pollIntervalSeconds: parsed.pollIntervalSeconds,
    notificationEnabled: parsed.notificationEnabled,
    soundEnabled: parsed.soundEnabled,
    allowLocalProjects: parsed.allowLocalProjects,
    maximumProjectAgeMinutes: parsed.maximumProjectAgeMinutes,
    minimumFixedBudget: parsed.minimumFixedBudget ?? null,
    maximumFixedBudget: parsed.maximumFixedBudget ?? null,
    minimumHourlyRate: parsed.minimumHourlyRate ?? null,
    maximumHourlyRate: parsed.maximumHourlyRate ?? null,
    maximumBidCount: parsed.maximumBidCount ?? null,
  };
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
    return;
  }

  await SearchProfileModel.create(
    buildSearchProfileCreatePayload({
      name: 'Default monitoring profile - add real Freelancer job IDs',
      enabled: true,
      keywords: ['typescript', 'node', 'react'],
      excludedKeywords: [
        'casino',
        'gambling',
        'crypto casino',
        'betting',
        'slot',
        'slots',
        'adult',
        'academic',
        'homework',
      ],
      jobIds: [],
      countries: [],
      languages: ['en'],
      projectTypes: ['fixed', 'hourly'],
      pollIntervalSeconds: 30,
      maximumProjectAgeMinutes: 10,
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
