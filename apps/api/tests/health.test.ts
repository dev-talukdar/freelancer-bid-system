import { afterAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { buildApp } from '../src/app.js';
import { localApiKey } from '../src/app/middleware/security.js';
import { connectMongo } from '../src/app/db/mongoose.js';

async function requestHealth(headers: Record<string, string> = {}) {
  const server = buildApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { headers });
    return { status: res.status, body: await res.json() };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

describe('health route', () => {
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('returns 200 with a valid local API key', async () => {
    const response = await requestHealth({ 'X-Local-API-Key': 'test-local-api-secret' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'degraded', database: 'disconnected' },
    });
  });

  it('returns 401 with a missing local API key', async () => {
    const response = await requestHealth();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INVALID_LOCAL_API_KEY',
    });
  });

  it('returns 401 with an invalid local API key', async () => {
    const response = await requestHealth({ 'X-Local-API-Key': 'wrong-secret' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INVALID_LOCAL_API_KEY',
    });
  });

  it('always sends bounded JSON while the database is disconnected', async () => {
    const response = await Promise.race([
      requestHealth({ 'X-Local-API-Key': 'test-local-api-secret' }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('health timed out')), 500),
      ),
    ]);

    expect(response.status).toBe(200);
    expect(response.body.data.monitoring.unreadCount).toBe(0);
  });

  it('local API-key middleware either advances or returns an error', () => {
    const res = {};
    const validNext = vi.fn();
    localApiKey(
      { path: '/api/v1/health', method: 'GET', header: () => 'test-local-api-secret' } as never,
      res as never,
      validNext,
    );
    expect(validNext).toHaveBeenCalledWith();

    const invalidNext = vi.fn();
    localApiKey(
      { path: '/api/v1/health', method: 'GET', header: () => undefined } as never,
      res as never,
      invalidNext,
    );
    expect(invalidNext.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });

  it('startup MongoDB connection uses a bounded server selection timeout', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    await connectMongo();

    expect(connect).toHaveBeenCalledWith(expect.any(String), { serverSelectionTimeoutMS: 10_000 });
    connect.mockRestore();
  });
});
