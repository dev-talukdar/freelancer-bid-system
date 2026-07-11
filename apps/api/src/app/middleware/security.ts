import crypto from 'node:crypto';

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

import { env } from '../config/env.js';
import { AppError } from '../error/app-error.js';

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

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, `Origin not allowed: ${origin}`, 'ORIGIN_NOT_ALLOWED'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Local-API-Key'],
});

export const localApiKey: RequestHandler = (req, _res, next) => {
  if (req.path === '/api/v1/health') {
    next();
    return;
  }

  if (req.header('X-Local-API-Key') !== env.LOCAL_API_SECRET) {
    next(new AppError(401, 'Invalid local API key', 'INVALID_LOCAL_API_KEY'));
    return;
  }

  next();
};

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
