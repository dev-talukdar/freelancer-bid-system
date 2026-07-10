import mongoose, { ConnectionStates } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export async function connectMongo() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('mongodb connected');
}
export async function disconnectMongo() {
  await mongoose.disconnect();
}
export function dbStatus() {
  return mongoose.connection.readyState === ConnectionStates.connected ? 'connected' : 'disconnected';
}
