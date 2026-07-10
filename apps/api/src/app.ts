import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './app/config/logger.js';
import {
  apiRateLimit,
  corsMiddleware,
  localApiKey,
  requestId,
  securityHeaders,
} from './app/middleware/security.js';
import { errorMiddleware } from './app/middleware/error.js';
import { v1Router } from './app/routes/v1.js';
export function buildApp() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(requestId);
  app.use(pinoHttp({ logger }));
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(apiRateLimit);
  app.use(localApiKey);
  app.use('/api/v1', v1Router);
  app.use(errorMiddleware);
  return app;
}
