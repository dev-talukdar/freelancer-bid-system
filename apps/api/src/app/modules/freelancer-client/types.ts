export type KnownProjectType = 'fixed' | 'hourly';

export interface FreelancerJob {
  id: number;
  name: string;
  seo_url?: string;
}

export interface FreelancerUser {
  id: number;
  country?: { name?: string; code?: string };
  location?: { country?: { name?: string; code?: string } };
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
  currency?: { code?: string };
  budget?: { minimum?: number; maximum?: number };
  bid_stats?: { bid_count?: number; bid_avg?: number };
  jobs?: FreelancerJob[];
  upgrades?: Record<string, unknown>;
  location?: { country?: { name?: string; code?: string } };
  owner_id?: number;
  owner?: { id?: number; username?: string };
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
  currency?: { code?: string };
  budget?: { minimum?: number; maximum?: number };
  bidStats?: { bidCount?: number; bidAvg?: number };
  jobs: NormalizedProjectJob[];
  clientCountry?: string;
  clientCountryCode?: string;
  ownerId?: number;
}

export interface ActiveProjectsResponse {
  result?: {
    projects?: FreelancerProject[];
    users?: Record<string, FreelancerUser> | FreelancerUser[];
  };
  projects?: FreelancerProject[];
  users?: Record<string, FreelancerUser> | FreelancerUser[];
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
  user_location_details?: boolean;
  user_country_details?: boolean;
  user_display_info?: boolean;
  user_employer_reputation?: boolean;
  user_employer_reputation_extra?: boolean;
  user_status?: boolean;
  limit?: number;
  offset?: number;
  compact?: boolean;
}
