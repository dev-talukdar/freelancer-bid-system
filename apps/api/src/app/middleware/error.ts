import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../error/app-error.js';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, next): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = res.locals.requestId as string | undefined;

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      requestId,
    });
    return;
  }

  const appError =
    error instanceof AppError
      ? error
      : new AppError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR');

  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    errorCode: appError.errorCode,
    requestId,
  });
};
