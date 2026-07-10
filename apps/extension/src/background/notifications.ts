import type { DetectedProjectDto } from '@fbs/shared';

export function buildNotificationMessage(project: DetectedProjectDto): string {
  const budget =
    project.currency && (project.budgetMinimum !== undefined || project.budgetMaximum !== undefined)
      ? `${project.currency} ${project.budgetMinimum ?? '?'}-${project.budgetMaximum ?? '?'}`
      : 'Budget not listed';
  const skills = project.jobs
    .slice(0, 3)
    .map((job) => job.name)
    .join(', ') || 'Skills not listed';
  const bids = project.bidCount !== undefined ? `${project.bidCount} bids` : 'Bid count unavailable';
  const country = project.clientCountry ? ` • ${project.clientCountry}` : '';

  return `${budget} • ${project.projectType} • ${skills} • ${bids}${country}`;
}

export async function createProjectNotification(project: DetectedProjectDto): Promise<void> {
  await chrome.notifications.create(`project:${project.id}`, {
    type: 'basic',
    title: project.title,
    message: buildNotificationMessage(project),
    priority: 2,
  });
}
