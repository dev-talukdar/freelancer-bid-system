import { Schema, model, type InferSchemaType } from 'mongoose';

const schema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    lastSuccessfulFromTime: Number,
    lastSeenProjectActivity: Date,
  },
  { timestamps: true },
);

export type ProjectMonitorCheckpointDocument = InferSchemaType<typeof schema>;
export const ProjectMonitorCheckpointModel = model('ProjectMonitorCheckpoint', schema);
