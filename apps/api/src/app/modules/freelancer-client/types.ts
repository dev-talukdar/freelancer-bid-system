export type KnownProjectType = 'fixed' | 'hourly';

export interface FreelancerCurrency {
  id?: number;
  code: string;
  sign: string;
  name: string;
  exchange_rate: number;
  country: string;
}

export interface AllowedCountry {
  name: string;
  code: string;
}

export interface FreelancerJob {
  id: number;
  name: string;
  seo_url?: string;
}

export interface FreelancerProject {
  id: number;
  title: string;
  preview_description?: string;
  description?: string;
  type?: string;
  status?: string;
  frontend_project_status?: string;
  deleted?: boolean;
  submitdate?: number;
  time_submitted?: number;
  time_updated?: number;
  seo_url?: string;
  language?: string;
  local?: boolean;
  urgent?: boolean;
  featured?: boolean;
  currency?: { id?: number; code?: string; country?: string };
  budget?: { minimum?: number; maximum?: number };
  bid_stats?: { bid_count?: number; bid_avg?: number };
  jobs?: FreelancerJob[];
  upgrades?: Record<string, unknown>;
  location?: { country?: { name?: string; code?: string } | string };
  owner_id?: number;
  owner?: { id?: number; username?: string };
}

export interface FreelancerUser {
  id?: number;
  username?: string;
  location?: { country?: { name?: string; code?: string } | string };
  country?: { name?: string; code?: string } | string;
}

export interface FreelancerActiveProjectsResult {
  projects?: FreelancerProject[];
  users?: Record<string, FreelancerUser>;
}

export interface NormalizedProjectJob {
  id: number;
  name: string;
  seoUrl?: string;
}

export interface NormalizedProject {
  id: number;
  title: string;
  previewDescription?: string;
  description?: string;
  type: KnownProjectType;
  status?: string;
  frontendProjectStatus?: string;
  deleted?: boolean;
  timeSubmitted?: number;
  timeUpdated?: number;
  seoUrl?: string;
  language?: string;
  local?: boolean;
  currency?: { id?: number; code?: string; country?: string };
  budget?: { minimum?: number; maximum?: number };
  bidStats?: { bidCount?: number; bidAvg?: number };
  jobs: NormalizedProjectJob[];
  clientCountry?: string;
  clientCountryCode?: string;
  ownerId?: number;
}

export interface AlertProcessingResult {
  returned: number;
  matched: number;
  new: number;
  skipped: number;
  skipReasons: Record<string, number>;
}

export interface SynchronizationCheckpoint {
  key: string;
  lastSuccessfulFromTime?: number;
  lastSeenProjectActivity?: Date;
  updatedAt?: Date;
}

export interface ProjectSearchParams {
  query?: string;
  project_types?: string[];
  jobs?: number[];
  countries?: string[];
  languages?: string[];
  min_price?: number;
  max_price?: number;
  min_hourly_rate?: number;
  max_hourly_rate?: number;
  from_time?: number;
  to_time?: number;
  sort_field?: string;
  reverse_sort?: boolean;
  full_description?: boolean;
  job_details?: boolean;
  user_details?: boolean;
  location_details?: boolean;
  user_country_details?: boolean;
  user_display_info?: boolean;
  user_employer_reputation?: boolean;
  user_employer_reputation_extra?: boolean;
  user_status?: boolean;
  limit?: number;
  offset?: number;
  compact?: boolean;
}
