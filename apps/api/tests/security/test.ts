import { describe, expect, it } from 'vitest';

const { buildAllowedOrigins } = await import('../src/app/middleware/security.js');

describe('api CORS origin allowlist', () => {
  it('allows the configured Chrome extension id as an origin', () => {
    const origins = buildAllowedOrigins('ekoafdkbplhojbmpcgdmecepodobolj');

    expect(origins.has('chrome-extension://ekoafdkbplhojbmpcgdmecepodobolj')).toBe(true);
  });

  it('accepts a full chrome-extension origin and trims whitespace/trailing slashes', () => {
    const origins = buildAllowedOrigins(' chrome-extension://ekoafdkbplhojbmpcgdmecepodobolj/ ');

    expect(origins.has('chrome-extension://ekoafdkbplhojbmpcgdmecepodobolj')).toBe(true);
    expect(
      origins.has('chrome-extension://chrome-extension://ekoafdkbplhojbmpcgdmecepodobolj'),
    ).toBe(false);
  });
});
