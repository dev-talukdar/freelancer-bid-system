import type { ProjectSearchParams } from './types.js';
export function buildFreelancerQuery(params: ProjectSearchParams): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) qs.append(`${key}[]`, String(item));
    else qs.set(key, String(value));
  }
  return qs;
}
