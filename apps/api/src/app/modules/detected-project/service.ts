import { DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES, type DetectedProjectDto } from '@fbs/shared';
import { AppError } from '../../error/app-error.js';
import { getActiveProfile } from '../search-profile/service.js';
import { DetectedProjectModel } from './model.js';

const notFound = () =>
  new AppError(404, 'Detected project not found', 'DETECTED_PROJECT_NOT_FOUND');

type LeanDetectedProject = {
  _id: unknown;
  freelancerProjectId: number;
  title: string;
  descriptionPreview?: string;
  projectType: 'fixed' | 'hourly';
  currency?: string;
  budgetMinimum?: number;
  budgetMaximum?: number;
  bidCount?: number;
  averageBid?: number;
  jobs: Array<{ id: number; name: string }>;
  clientCountry?: string;
  seoUrl: string;
  timeSubmitted?: Date;
  timeUpdated?: Date;
  detectedAt: Date;
  notifiedAt?: Date;
  readAt?: Date;
  openedAt?: Date;
};

const serializeProject = (project: LeanDetectedProject): DetectedProjectDto => {
  const dto: DetectedProjectDto = {
    id: String(project._id),
    freelancerProjectId: project.freelancerProjectId,
    title: project.title,
    projectType: project.projectType,
    jobs: project.jobs,
    seoUrl: project.seoUrl,
    detectedAt: project.detectedAt.toISOString(),
  };
  if (project.descriptionPreview !== undefined) dto.descriptionPreview = project.descriptionPreview;
  if (project.currency !== undefined) dto.currency = project.currency;
  if (project.budgetMinimum !== undefined) dto.budgetMinimum = project.budgetMinimum;
  if (project.budgetMaximum !== undefined) dto.budgetMaximum = project.budgetMaximum;
  if (project.bidCount !== undefined) dto.bidCount = project.bidCount;
  if (project.averageBid !== undefined) dto.averageBid = project.averageBid;
  if (project.clientCountry !== undefined) dto.clientCountry = project.clientCountry;
  if (project.timeSubmitted !== undefined) dto.timeSubmitted = project.timeSubmitted.toISOString();
  if (project.timeUpdated !== undefined) dto.timeUpdated = project.timeUpdated.toISOString();
  if (project.notifiedAt !== undefined) dto.notifiedAt = project.notifiedAt.toISOString();
  if (project.readAt !== undefined) dto.readAt = project.readAt.toISOString();
  if (project.openedAt !== undefined) dto.openedAt = project.openedAt.toISOString();
  return dto;
};

const recentProjectFilter = (maximumProjectAgeMinutes = DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES) => {
  const cutoff = new Date(Date.now() - maximumProjectAgeMinutes * 60_000);
  return {
    $or: [
      { timeUpdated: { $gte: cutoff } },
      { timeSubmitted: { $gte: cutoff } },
      {
        timeSubmitted: { $exists: false },
        timeUpdated: { $exists: false },
        detectedAt: { $gte: cutoff },
      },
    ],
  };
};

export async function listDetected(page = 1, pageSize = 20, unreadOnly = false) {
  const activeProfile = await getActiveProfile();
  const filter = {
    ...recentProjectFilter(activeProfile?.maximumProjectAgeMinutes),
    ...(unreadOnly ? { readAt: { $exists: false } } : {}),
  };
  const [items, total, unreadCount] = await Promise.all([
    DetectedProjectModel.find(filter)
      .sort({ detectedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    DetectedProjectModel.countDocuments(filter),
    DetectedProjectModel.countDocuments({ readAt: { $exists: false } }),
  ]);
  return {
    items: items.map((item) => serializeProject(item as LeanDetectedProject)),
    total,
    page,
    pageSize,
    unreadCount,
  };
}

export async function listUnnotified(limit = 50) {
  const activeProfile = await getActiveProfile();
  const notification = {
    enabled: activeProfile?.notificationEnabled ?? false,
    soundEnabled: activeProfile?.soundEnabled ?? false,
  };

  if (!notification.enabled) {
    return { items: [], notification, limit };
  }

  const items = await DetectedProjectModel.find({
    notifiedAt: { $exists: false },
    ...recentProjectFilter(activeProfile?.maximumProjectAgeMinutes),
  })
    .sort({ detectedAt: 1 })
    .limit(limit)
    .lean();

  return {
    items: items.map((item) => serializeProject(item as LeanDetectedProject)),
    notification,
    limit,
  };
}

export async function clearDetectedProjects() {
  const result = await DetectedProjectModel.deleteMany({});
  return { deletedCount: result.deletedCount ?? 0 };
}

export async function pruneOldDetectedProjects() {
  const activeProfile = await getActiveProfile();
  const maximumProjectAgeMinutes =
    activeProfile?.maximumProjectAgeMinutes ?? DEFAULT_MAXIMUM_PROJECT_AGE_MINUTES;
  const staleFilter = { $nor: [recentProjectFilter(maximumProjectAgeMinutes)] };
  const staleCount = await DetectedProjectModel.countDocuments(staleFilter);
  if (staleCount === 0) return { deletedCount: 0, staleCount };
  const deleteCount = Math.ceil(staleCount / 2);
  const oldProjects = await DetectedProjectModel.find(staleFilter)
    .sort({ detectedAt: 1 })
    .limit(deleteCount)
    .select({ _id: 1 })
    .lean();
  const result = await DetectedProjectModel.deleteMany({
    _id: { $in: oldProjects.map((project) => project._id) },
  });
  return { deletedCount: result.deletedCount ?? 0, staleCount };
}

export async function markNotified(id: string) {
  const project = await DetectedProjectModel.findByIdAndUpdate(
    id,
    { $set: { notifiedAt: new Date() } },
    { new: true, runValidators: true },
  ).lean();
  if (!project) throw notFound();
  return serializeProject(project as LeanDetectedProject);
}

export async function markRead(id: string) {
  const project = await DetectedProjectModel.findByIdAndUpdate(
    id,
    { $set: { readAt: new Date() } },
    { new: true, runValidators: true },
  ).lean();
  if (!project) throw notFound();
  return serializeProject(project as LeanDetectedProject);
}

export async function markOpened(id: string) {
  const project = await DetectedProjectModel.findByIdAndUpdate(
    id,
    { $set: { openedAt: new Date(), readAt: new Date() } },
    { new: true, runValidators: true },
  ).lean();
  if (!project) throw notFound();
  return serializeProject(project as LeanDetectedProject);
}
