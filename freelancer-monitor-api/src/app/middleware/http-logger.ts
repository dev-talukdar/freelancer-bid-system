import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

const getRequestId = (res: Response): string | undefined => {
  const value: unknown = res.locals.requestId;

  return typeof value === 'string' ? value : undefined;
};

export const httpLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = process.hrtime.bigint();

  res.once('finish', () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNanoseconds) / 1_000_000;

    logger.info(
      {
        requestId: getRequestId(res),
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        contentLength: res.getHeader('content-length'),
        userAgent: req.get('user-agent'),
      },
      'HTTP request completed',
    );
  });

  res.once('close', () => {
    if (!res.writableEnded) {
      logger.warn(
        {
          requestId: getRequestId(res),
          method: req.method,
          path: req.originalUrl,
        },
        'HTTP request connection closed before response completed',
      );
    }
  });

  next();
};
