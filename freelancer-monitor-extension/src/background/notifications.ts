import type { DetectedProjectDto } from '../types/api-contracts.js';

export function buildNotificationMessage(project: DetectedProjectDto): string {
  const budget =
    project.currency && (project.budgetMinimum !== undefined || project.budgetMaximum !== undefined)
      ? `${project.currency} ${project.budgetMinimum ?? '?'}-${project.budgetMaximum ?? '?'}`
      : 'Budget not listed';
  const skills =
    project.jobs
      .slice(0, 3)
      .map((job) => job.name)
      .join(', ') || 'Skills not listed';
  const bids =
    project.bidCount !== undefined ? `${project.bidCount} bids` : 'Bid count unavailable';
  const country = project.clientCountry ? ` • ${project.clientCountry}` : '';

  return `${budget} • ${project.projectType} • ${skills} • ${bids}${country}`;
}

export async function createProjectNotification(project: DetectedProjectDto): Promise<void> {
  const permission = await chrome.notifications.getPermissionLevel();
  if (permission !== 'granted') {
    throw new Error(`Chrome notification permission is ${permission}`);
  }

  const notificationId = await chrome.notifications.create(`detected-project:${project.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: project.title,
    message: buildNotificationMessage(project),
    priority: 2,
  });

  if (!notificationId) {
    throw new Error('Chrome did not create a notification');
  }
}
