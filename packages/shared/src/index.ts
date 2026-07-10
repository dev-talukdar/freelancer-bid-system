import { z } from 'zod';
export const LOCAL_API_BASE_URL = 'http://127.0.0.1:4300';
export const FREELANCER_PROJECT_BASE_URL = 'https://www.freelancer.com/projects/';
export const MIN_POLL_INTERVAL_SECONDS = 20;
export const DEFAULT_POLL_INTERVAL_SECONDS = 30;
export const projectTypeSchema = z.enum(['fixed', 'hourly']);
export type ProjectType = z.infer<typeof projectTypeSchema>;
export const searchProfileSchema = z.object({
  name: z.string().min(1), enabled: z.boolean().default(true), keywords: z.array(z.string()).default([]), excludedKeywords: z.array(z.string()).default([]), jobIds: z.array(z.number().int().positive()).default([]), countries: z.array(z.string().min(2)).default([]), languages: z.array(z.string().min(2)).default([]), projectTypes: z.array(projectTypeSchema).default(['fixed','hourly']), minimumFixedBudget: z.number().nonnegative().optional(), maximumFixedBudget: z.number().nonnegative().optional(), minimumHourlyRate: z.number().nonnegative().optional(), maximumHourlyRate: z.number().nonnegative().optional(), maximumBidCount: z.number().int().nonnegative().optional(), pollIntervalSeconds: z.number().int().min(MIN_POLL_INTERVAL_SECONDS).default(DEFAULT_POLL_INTERVAL_SECONDS), notificationEnabled: z.boolean().default(true), soundEnabled: z.boolean().default(true), allowLocalProjects: z.boolean().default(false),
});
export type SearchProfileInput = z.input<typeof searchProfileSchema>;
export type SearchProfile = z.output<typeof searchProfileSchema> & { id: string; createdAt: string; updatedAt: string };
export const apiResponseSchema = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), message: z.string(), data });
export const apiErrorResponseSchema = z.object({ success: z.literal(false), message: z.string(), errorCode: z.string(), requestId: z.string().optional() });
export interface ApiSuccess<T> { success: true; message: string; data: T }
export interface ApiFailure { success: false; message: string; errorCode: string; requestId?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface DetectedProjectDto { id: string; freelancerProjectId: number; title: string; descriptionPreview?: string; projectType: ProjectType; currency?: string; budgetMinimum?: number; budgetMaximum?: number; bidCount?: number; averageBid?: number; jobs: Array<{ id: number; name: string }>; clientCountry?: string; seoUrl: string; timeSubmitted?: string; timeUpdated?: string; detectedAt: string; notifiedAt?: string; readAt?: string; openedAt?: string }
export interface MonitorStatusDto { running: boolean; polling: boolean; currentPollingIntervalSeconds: number; lastSuccessfulPoll?: string; lastPollingError?: string; unreadCount: number }
export interface HealthDto { status: 'ok'|'degraded'; database: 'connected'|'disconnected'; monitoring: MonitorStatusDto; freelancerTokenConfigured: boolean; freelancerTokenExpiresAt?: string; freelancerTokenExpirationWarning: boolean }
export interface PaginatedDetectedProjectsDto { items: DetectedProjectDto[]; total: number; page: number; pageSize: number; unreadCount: number }
export function normalizeFreelancerSeoUrl(input: string): string { const cleaned = input.trim().replace(/^https?:\/\/(www\.)?freelancer\.com\/projects\//i,'').replace(/^\/+|\/+$/g,''); if (!/^[A-Za-z0-9/_-]+$/.test(cleaned) || cleaned.includes('..')) throw new Error('Invalid Freelancer project path'); return cleaned; }
export function toFreelancerProjectUrl(seoUrl: string): string { return `${FREELANCER_PROJECT_BASE_URL}${normalizeFreelancerSeoUrl(seoUrl)}`; }
