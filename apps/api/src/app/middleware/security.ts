import crypto from 'node:crypto'; import type { RequestHandler } from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit'; import { env } from '../config/env.js'; import { AppError } from '../error/app-error.js';
export const requestId: RequestHandler = (_req,res,next)=>{res.locals.requestId=crypto.randomUUID(); next();};
export const securityHeaders = helmet();
export const corsMiddleware = cors({ origin(origin, cb){ const allowed = env.EXTENSION_ID ? `chrome-extension://${env.EXTENSION_ID}` : undefined; if (!origin || origin === allowed) cb(null,true); else cb(new AppError(403,'Origin not allowed','ORIGIN_NOT_ALLOWED')); }});
export const localApiKey: RequestHandler = (req,_res,next)=>{ if (req.path === '/api/v1/health') return next(); if (req.header('X-Local-API-Key') !== env.LOCAL_API_SECRET) return next(new AppError(401,'Invalid local API key','INVALID_LOCAL_API_KEY')); next(); };
export const apiRateLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
