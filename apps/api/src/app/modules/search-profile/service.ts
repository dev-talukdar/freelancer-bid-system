import { searchProfileSchema, type SearchProfileInput } from '@fbs/shared';
import { SearchProfileModel } from './model.js';

type SearchProfileCreatePayload = ReturnType<typeof searchProfileSchema.parse>;

export const buildSearchProfileCreatePayload = (input: unknown): SearchProfileCreatePayload => {
  const parsed = searchProfileSchema.parse(input);
  const payload: SearchProfileCreatePayload = {
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
  };
  if (parsed.minimumFixedBudget !== undefined) payload.minimumFixedBudget = parsed.minimumFixedBudget;
  if (parsed.maximumFixedBudget !== undefined) payload.maximumFixedBudget = parsed.maximumFixedBudget;
  if (parsed.minimumHourlyRate !== undefined) payload.minimumHourlyRate = parsed.minimumHourlyRate;
  if (parsed.maximumHourlyRate !== undefined) payload.maximumHourlyRate = parsed.maximumHourlyRate;
  if (parsed.maximumBidCount !== undefined) payload.maximumBidCount = parsed.maximumBidCount;
  return payload;
};

export const seedSearchProfile = async () => {
  if (await SearchProfileModel.exists({})) return;
  await SearchProfileModel.create(buildSearchProfileCreatePayload({
    name: 'Default monitoring profile - add real Freelancer job IDs',
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
  } satisfies SearchProfileInput));
};
export const listProfiles = () => SearchProfileModel.find().sort({ createdAt: -1 });
export const createProfile = (input: unknown) =>
  SearchProfileModel.create(buildSearchProfileCreatePayload(input));
export const updateProfile = async (id: string, input: unknown) =>
  SearchProfileModel.findByIdAndUpdate(id, searchProfileSchema.partial().parse(input), {
    new: true,
    runValidators: true,
  });
export const activateProfile = async (id: string) => {
  await SearchProfileModel.updateMany({}, { $set: { enabled: false } });
  return SearchProfileModel.findByIdAndUpdate(id, { $set: { enabled: true } }, { new: true });
};
export const activeProfile = () =>
  SearchProfileModel.findOne({ enabled: true }).sort({ updatedAt: -1 });
