export function shouldNotify(
  previouslyNotified: readonly string[],
  detectedProjectId: string,
): boolean {
  return !previouslyNotified.includes(detectedProjectId);
}
