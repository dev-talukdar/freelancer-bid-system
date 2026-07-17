import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES, DEFAULT_POLL_INTERVAL_SECONDS } from '../../interfaces/contracts.js';
const schema = new Schema(
  {
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true, index: true },
    keywords: { type: [String], default: [] },
    excludedKeywords: { type: [String], default: [] },
    jobIds: { type: [Number], default: [] },
    countries: { type: [String], default: [] },
    currencies: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    projectTypes: { type: [String], enum: ['fixed', 'hourly'], default: ['fixed', 'hourly'] },
    minimumFixedBudget: { type: Number, default: null },
    maximumFixedBudget: { type: Number, default: null },
    minimumHourlyRate: { type: Number, default: null },
    maximumHourlyRate: { type: Number, default: null },
    maximumBidCount: { type: Number, default: null },
    pollIntervalSeconds: { type: Number, default: DEFAULT_POLL_INTERVAL_SECONDS, min: 20 },
    notificationEnabled: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    allowLocalProjects: { type: Boolean, default: false },
    maximumProjectAgeMinutes: {
      type: Number,
      default: DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES,
      min: 1,
      max: 1440,
    },
  },
  { timestamps: true },
);
export type SearchProfileDocument = InferSchemaType<typeof schema> & { _id: Types.ObjectId };
export const SearchProfileModel = model('SearchProfile', schema);
