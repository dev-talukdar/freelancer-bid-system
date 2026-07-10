import { DetectedProjectModel } from './model.js';
export async function listDetected(page = 1, pageSize = 20, unreadOnly = false) {
  const filter = unreadOnly ? { readAt: { $exists: false } } : {};
  const [items, total, unreadCount] = await Promise.all([
    DetectedProjectModel.find(filter)
      .sort({ detectedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    DetectedProjectModel.countDocuments(filter),
    DetectedProjectModel.countDocuments({ readAt: { $exists: false } }),
  ]);
  return { items, total, page, pageSize, unreadCount };
}
export const markRead = (id: string) =>
  DetectedProjectModel.findByIdAndUpdate(
    id,
    { $set: { readAt: new Date(), notifiedAt: new Date() } },
    { new: true },
  );
export const markOpened = (id: string) =>
  DetectedProjectModel.findByIdAndUpdate(id, { $set: { openedAt: new Date() } }, { new: true });
