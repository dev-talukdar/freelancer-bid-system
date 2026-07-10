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
  return header
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const [limitRaw, ...attrs] = part.split(';');
      const limit = Number(limitRaw);
      const win = attrs
        .map((a) => a.trim())
        .find((a) => a.startsWith('window='))
        ?.split('=')[1];
      return Number.isFinite(limit)
        ? { limit, windowSeconds: win ? Number(win) : undefined }
        : undefined;
    })
    .filter((v): v is RateLimitWindow => Boolean(v));
}
export function parseRateLimitHeaders(headers: Headers): RateLimitState {
  const remainingRaw = headers.get('RateLimit-Remaining');
  const remaining = remainingRaw ? Number(remainingRaw) : undefined;
  return {
    windows: parseRateLimitLimit(headers.get('RateLimit-Limit')),
    remaining: Number.isFinite(remaining) ? remaining : undefined,
  };
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
