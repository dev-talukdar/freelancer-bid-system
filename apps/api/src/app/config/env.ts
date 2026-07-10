import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDir, '../../../../..');
const apiRoot = resolve(currentDir, '../../..');

for (const envFile of [resolve(repositoryRoot, '.env'), resolve(apiRoot, '.env')]) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile, override: envFile.startsWith(apiRoot) });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4300),
  HOST: z.string().default('127.0.0.1'),
  MONGODB_URI: z.string().min(1),
  FREELANCER_ACCESS_TOKEN: z.string().min(1).optional(),
  FREELANCER_TOKEN_EXPIRES_AT: z.string().datetime().optional(),
  FREELANCER_API_BASE_URL: z.string().url().default('https://www.freelancer.com/api'),
  EXTENSION_ID: z.string().optional(),
  LOCAL_API_SECRET: z.string().min(16),
  LOG_LEVEL: z.string().default('info'),
  DETECTED_PROJECT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export const env = envSchema.parse(process.env);
export const isTokenExpiringSoon = () =>
  env.FREELANCER_TOKEN_EXPIRES_AT
    ? Date.now() + 3 * 24 * 60 * 60 * 1000 > Date.parse(env.FREELANCER_TOKEN_EXPIRES_AT)
    : false;
