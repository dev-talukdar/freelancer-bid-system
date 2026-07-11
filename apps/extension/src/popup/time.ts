export const BANGLADESH_TIME_ZONE = 'Asia/Dhaka';

export const formatBangladeshDateTime = (value: string | number | Date | undefined): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: BANGLADESH_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

export const calculateNextPollAt = (
  lastPollAt: string | number | Date | undefined,
  pollIntervalSeconds: number,
): Date | undefined => {
  if (!lastPollAt || pollIntervalSeconds <= 0) return undefined;
  const lastPoll = new Date(lastPollAt);
  if (Number.isNaN(lastPoll.getTime())) return undefined;
  return new Date(lastPoll.getTime() + pollIntervalSeconds * 1000);
};

export const formatRelativeTime = (
  value: string | number | Date | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 1) return 'now';
  const unit = abs === 1 ? 'second' : 'seconds';
  return diffSeconds > 0 ? `In ${abs} ${unit}` : `${abs} ${unit} ago`;
};
