import { Schema, model, type InferSchemaType } from 'mongoose';
const jobSchema = new Schema({ id: Number, name: String }, { _id: false });
const schema = new Schema(
  {
    freelancerProjectId: { type: Number, required: true },
    searchProfileId: { type: Schema.Types.ObjectId, required: true, ref: 'SearchProfile' },
    title: { type: String, required: true },
    descriptionPreview: String,
    projectType: { type: String, enum: ['fixed', 'hourly'], required: true },
    currency: String,
    budgetMinimum: Number,
    budgetMaximum: Number,
    bidCount: Number,
    averageBid: Number,
    jobs: { type: [jobSchema], default: [] },
    clientCountry: String,
    seoUrl: { type: String, required: true },
    timeSubmitted: Date,
    timeUpdated: Date,
    detectedAt: { type: Date, default: Date.now, index: true },
    notifiedAt: Date,
    readAt: Date,
    openedAt: Date,
    rawSnapshot: Schema.Types.Mixed,
  },
  { timestamps: true },
);
schema.index({ freelancerProjectId: 1, searchProfileId: 1 }, { unique: true });
export type DetectedProjectDocument = InferSchemaType<typeof schema> & { _id: string };
export const DetectedProjectModel = model('DetectedProject', schema);
