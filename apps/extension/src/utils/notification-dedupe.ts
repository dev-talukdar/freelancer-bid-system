export function shouldNotify(previouslyNotified: readonly number[], freelancerProjectId: number): boolean { return !previouslyNotified.includes(freelancerProjectId); }
