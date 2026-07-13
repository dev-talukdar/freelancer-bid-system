import { describe, expect, it, vi } from 'vitest';
import { LocalApiClient, LocalApiError, mapFetchError, parseApiResponse } from './local-api.js';

describe('LocalApiClient health requests', () => {
  it('sends the health request to the configured backend with a timeout and API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Health check',
          data: {
            status: 'ok',
            database: 'connected',
            monitoring: {
              running: false,
              polling: false,
              currentPollingIntervalSeconds: 30,
              unreadCount: 0,
            },
            freelancerTokenConfigured: true,
            freelancerTokenExpirationWarning: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new LocalApiClient({
      apiBaseUrl: 'http://127.0.0.1:4300',
      localApiSecret: 'saved-secret',
    }).health();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4300/api/v1/health',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'X-Local-API-Key': 'saved-secret',
        }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('maps 401 responses distinctly from timeout and network failures', async () => {
    await expect(
      parseApiResponse(
        new Response(
          JSON.stringify({ success: false, message: 'Invalid local API key', errorCode: 'x' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    ).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });

    expect(mapFetchError(new DOMException('timeout', 'TimeoutError'))).toMatchObject({
      kind: 'timeout',
    });
    expect(mapFetchError(new TypeError('fetch failed'))).toMatchObject({ kind: 'network' });
    expect(mapFetchError(new LocalApiError('http', 'bad', 500))).toMatchObject({ kind: 'http' });
  });
});
