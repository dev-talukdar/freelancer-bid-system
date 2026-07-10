import type { FreelancerProject, NormalizedProject } from './types.js';

export function normalizeFreelancerProject(
  project: FreelancerProject,
): NormalizedProject | undefined {
  if (typeof project.id !== 'number' || typeof project.title !== 'string') return undefined;

  return {
    id: project.id,
    title: project.title,
    previewDescription: project.preview_description,
    description: project.description,
    type: project.type,
    status: project.status,
    frontendProjectStatus: project.frontend_project_status,
    deleted: project.deleted,
    timeSubmitted: project.time_submitted ?? project.submitdate,
    timeUpdated: project.time_updated,
    seoUrl: project.seo_url,
    language: project.language,
    local: project.local,
    currency: project.currency,
    budget: project.budget,
    bidStats: project.bid_stats
      ? { bidCount: project.bid_stats.bid_count, bidAvg: project.bid_stats.bid_avg }
      : undefined,
    jobs: (project.jobs ?? [])
      .filter((job) => typeof job.id === 'number' && typeof job.name === 'string')
      .map((job) => ({ id: job.id, name: job.name, seoUrl: job.seo_url })),
    clientCountry: project.location?.country?.name,
    clientCountryCode: project.location?.country?.code,
    ownerId: project.owner_id ?? project.owner?.id,
  };
}
