/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const MONGOOSE_READY_STATE = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
} as const;

export async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === MONGOOSE_READY_STATE.connected) {
    return;
  }

  await mongoose.connect(env.MONGODB_URI);

  logger.info('mongodb connected');
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState === MONGOOSE_READY_STATE.disconnected) {
    return;
  }

  await mongoose.disconnect();

  logger.info('mongodb disconnected');
}

export function dbStatus(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === MONGOOSE_READY_STATE.connected
    ? 'connected'
    : 'disconnected';
}
