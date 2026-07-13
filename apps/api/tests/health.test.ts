import { afterAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { localApiKey } from '../src/app/middleware/security.js';
import { httpLogger } from '../src/app/middleware/http-logger.js';
import { errorMiddleware } from '../src/app/middleware/error.js';
import { connectMongo } from '../src/app/db/mongoose.js';
import { AppError } from '../src/app/error/app-error.js';
import { DetectedProjectModel } from '../src/app/modules/detected-project/model.js';

async function requestApi(path: string, headers: Record<string, string> = {}) {
  const server = buildApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    return {
      status: res.status,
      headers: res.headers,
      body: (await res.json()) as Record<string, unknown>,
    };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const validKey = { 'X-Local-API-Key': 'test-local-api-secret' };

describe('health route', () => {
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('returns 200 with a valid local API key', async () => {
    const response = await requestApi('/api/v1/health', validKey);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'degraded', database: 'disconnected' },
    });
  });

  it('returns 401 with a missing local API key', async () => {
    const response = await requestApi('/api/v1/health');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INVALID_LOCAL_API_KEY',
    });
  });

  it('returns 401 with an invalid local API key', async () => {
    const response = await requestApi('/api/v1/health', { 'X-Local-API-Key': 'wrong-secret' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INVALID_LOCAL_API_KEY',
    });
  });

  it('does not perform a MongoDB count query from health', async () => {
    const countDocuments = vi.spyOn(DetectedProjectModel, 'countDocuments');

    await requestApi('/api/v1/health', validKey);

    expect(countDocuments).not.toHaveBeenCalled();
    countDocuments.mockRestore();
  });

  it('responds while the database is disconnected', async () => {
    const response = await Promise.race([
      requestApi('/api/v1/health', validKey),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('health timed out')), 500),
      ),
    ]);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { database: 'disconnected' } });
  });

  it('sends Cache-Control: no-store', async () => {
    const response = await requestApi('/api/v1/health', validKey);

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('httpLogger always calls next', () => {
    const res = {
      locals: {},
      once: vi.fn(),
      getHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    httpLogger(
      { method: 'GET', originalUrl: '/api/v1/health', get: vi.fn() } as unknown as Request,
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it('local API-key middleware either advances or forwards an error', () => {
    const res = {};
    const validNext = vi.fn();
    localApiKey(
      {
        originalUrl: '/api/v1/health',
        path: '/api/v1/health',
        method: 'GET',
        header: () => 'test-local-api-secret',
      } as never,
      res as never,
      validNext,
    );
    expect(validNext).toHaveBeenCalledWith();

    const invalidNext = vi.fn();
    localApiKey(
      {
        originalUrl: '/api/v1/health',
        path: '/api/v1/health',
        method: 'GET',
        header: () => undefined,
      } as never,
      res as never,
      invalidNext,
    );
    expect(invalidNext.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });

  it('error middleware serializes errors to JSON', () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = {
      headersSent: false,
      locals: { requestId: 'request-1' },
      status,
      json,
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorMiddleware(
      new AppError(401, 'Invalid local API key', 'INVALID_LOCAL_API_KEY'),
      {} as Request,
      res,
      next,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid local API key',
      errorCode: 'INVALID_LOCAL_API_KEY',
      requestId: 'request-1',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('monitor status uses a bounded unread-count query', async () => {
    const maxTimeMS = vi.fn().mockResolvedValue(7);
    const countDocuments = vi
      .spyOn(DetectedProjectModel, 'countDocuments')
      .mockReturnValue({ maxTimeMS } as never);
    const readyState = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

    const response = await requestApi('/api/v1/monitor/status', validKey);

    expect(response.status).toBe(200);
    expect(countDocuments).toHaveBeenCalledWith({ readAt: { $exists: false } });
    expect(maxTimeMS).toHaveBeenCalledWith(3_000);
    expect(response.body).toMatchObject({ data: { unreadCount: 7 } });

    countDocuments.mockRestore();
    readyState.mockRestore();
  });

  it('startup MongoDB connection uses a bounded server selection timeout', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    await connectMongo();

    expect(connect).toHaveBeenCalledWith(expect.any(String), { serverSelectionTimeoutMS: 10_000 });
    connect.mockRestore();
  });
});
