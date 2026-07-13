import express, { type Request, type RequestHandler } from 'express';
import mongoose from 'mongoose';
import {
  apiRateLimit,
  corsMiddleware,
  localApiKey,
  requestId,
  securityHeaders,
} from './app/middleware/security.js';
import { errorMiddleware } from './app/middleware/error.js';
import { v1Router } from './app/routes/v1.js';
import { httpLogger } from './app/middleware/http-logger.js';
import { logger } from './app/config/logger.js';

const isHealthRequest = (req: Request): boolean => req.originalUrl === '/api/v1/health';

const healthStage =
  (stage: string): RequestHandler =>
  (req, _res, next) => {
    if (isHealthRequest(req)) {
      logger.info(
        {
          method: req.method,
          originalUrl: req.originalUrl,
          path: req.path,
          hasLocalApiKey: Boolean(req.header('X-Local-API-Key')),
          mongooseReadyState: mongoose.connection.readyState,
        },
        stage,
      );
    }

    next();
  };

export function buildApp() {
  const app = express();

  app.use(healthStage('request entered Express'));
  app.use(express.json({ limit: '256kb' }));
  app.use(requestId);
  app.use(healthStage('requestId middleware passed'));
  app.use(httpLogger);
  app.use(healthStage('httpLogger middleware passed'));
  app.use(securityHeaders);
  app.use(healthStage('securityHeaders middleware passed'));
  app.use(corsMiddleware);
  app.use(healthStage('CORS middleware passed'));
  app.use(apiRateLimit);
  app.use(healthStage('rate limiter passed'));
  app.use(localApiKey);
  app.use('/api/v1', v1Router);
  app.use(errorMiddleware);

  return app;
}
