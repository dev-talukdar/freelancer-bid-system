export const formatBangladeshDateTime = (value: string | number | Date | undefined): string => {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
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
  intervalSeconds: number,
): Date | undefined => {
  if (!lastPollAt || intervalSeconds <= 0) {
    return undefined;
  }

  const date = new Date(lastPollAt);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Date(date.getTime() + intervalSeconds * 1000);
};

export const formatRelativeTime = (
  value: string | number | Date | undefined,
  now = new Date(),
): string => {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);

  if (seconds === 0) return 'Now';

  if (seconds > 0) {
    return `In ${seconds} second${seconds === 1 ? '' : 's'}`;
  }

  const elapsed = Math.abs(seconds);

  return `${elapsed} second${elapsed === 1 ? '' : 's'} ago`;
};
