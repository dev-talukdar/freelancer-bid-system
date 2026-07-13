import express from 'express';
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
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(apiRateLimit);
  app.use(localApiKey);
  app.use('/api/v1', v1Router);
  app.use(errorMiddleware);
  return app;
}
