import pino from 'pino';
import { env } from './env.js';
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: [
    'req.headers.authorization',
    'req.headers.freelancer-oauth-v1',
    'req.headers.x-local-api-key',
    '*.accessToken',
    '*.refreshToken',
    '*.FREELANCER_ACCESS_TOKEN',
    '*.LOCAL_API_SECRET',
    'req.headers.cookie',
  ],
});
