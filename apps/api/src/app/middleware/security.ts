import crypto from 'node:crypto';

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../error/app-error.js';

const isHealthRequest = (req: Request): boolean => req.originalUrl === '/api/v1/health';

const logHealthStage = (req: Request, stage: string, extra: Record<string, unknown> = {}): void => {
  if (!isHealthRequest(req)) return;

  logger.info(
    {
      method: req.method,
      originalUrl: req.originalUrl,
      path: req.path,
      hasLocalApiKey: Boolean(req.header('X-Local-API-Key')),
      mongooseReadyState: mongoose.connection.readyState,
      ...extra,
    },
    stage,
  );
};

export const requestId: RequestHandler = (_req, res, next) => {
  res.locals.requestId = crypto.randomUUID();
  next();
};

export const securityHeaders = helmet();

const normalizeExtensionOrigin = (extensionIdOrOrigin: string) => {
  const trimmed = extensionIdOrOrigin.trim().replace(/\/+$/, '');
  return trimmed.startsWith('chrome-extension://') ? trimmed : `chrome-extension://${trimmed}`;
};

export const buildAllowedOrigins = (extensionIdOrOrigin?: string) => {
  const origins = new Set(['http://127.0.0.1:4300', 'http://localhost:4300']);

  if (extensionIdOrOrigin?.trim()) {
    origins.add(normalizeExtensionOrigin(extensionIdOrOrigin));
  }

  return origins;
};

const allowedOrigins = buildAllowedOrigins(env.EXTENSION_ID);
const isChromeExtensionOrigin = (origin: string) => /^chrome-extension:\/\/[a-p]{32}$/.test(origin);

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      (!env.EXTENSION_ID?.trim() && isChromeExtensionOrigin(origin))
    ) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, `Origin not allowed: ${origin}`, 'ORIGIN_NOT_ALLOWED'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Local-API-Key'],
});

export const localApiKey: RequestHandler = (req, _res, next): void => {
  logHealthStage(req, 'local API key middleware entered');

  const providedKey = req.header('X-Local-API-Key');

  if (!providedKey || providedKey !== env.LOCAL_API_SECRET) {
    logHealthStage(req, 'local API key rejected');
    next(new AppError(401, 'Invalid local API key', 'INVALID_LOCAL_API_KEY'));
    return;
  }

  logHealthStage(req, 'local API key accepted');
  next();
};

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
