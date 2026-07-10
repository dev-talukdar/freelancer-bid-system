export interface RateLimitWindow {
  limit: number;
  windowSeconds?: number;
}
export interface RateLimitState {
  windows: RateLimitWindow[];
  remaining?: number;
}

export function parseRateLimitLimit(header: string | null): RateLimitWindow[] {
  if (!header) return [];
  const windows: RateLimitWindow[] = [];
  for (const segment of header.split(',')) {
    const [limitRaw, ...attrs] = segment.split(';').map((part) => part.trim());
    const limit = Number(limitRaw);
    if (!Number.isFinite(limit)) continue;

    const windowAttr = attrs.find((attr) => attr.startsWith('window='));
    const windowRaw = windowAttr?.split('=')[1];
    const parsedWindow = windowRaw === undefined ? undefined : Number(windowRaw);
    const rateLimitWindow: RateLimitWindow = { limit };
    if (parsedWindow !== undefined && Number.isFinite(parsedWindow)) {
      rateLimitWindow.windowSeconds = parsedWindow;
    }
    windows.push(rateLimitWindow);
  }
  return windows;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitState {
  const remainingRaw = headers.get('RateLimit-Remaining');
  const remaining = remainingRaw === null ? undefined : Number(remainingRaw);
  const state: RateLimitState = { windows: parseRateLimitLimit(headers.get('RateLimit-Limit')) };
  if (remaining !== undefined && Number.isFinite(remaining)) {
    state.remaining = remaining;
  }
  return state;
}
export function calculateAdaptiveDelay(
  baseMs: number,
  state: RateLimitState,
  attempt = 0,
  status?: number,
) {
  if (status === 429)
    return Math.min(300_000, baseMs * 2 ** attempt + Math.floor(Math.random() * 1000));
  const minLimit = state.windows.length
    ? Math.min(...state.windows.map((w) => w.limit))
    : undefined;
  if (state.remaining !== undefined && minLimit && state.remaining / minLimit < 0.2)
    return baseMs * 2;
  return baseMs;
}
