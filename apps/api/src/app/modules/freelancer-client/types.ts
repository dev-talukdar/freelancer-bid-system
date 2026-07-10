export interface FreelancerJob {
  id: number;
  name: string;
  seo_url?: string;
}

export interface FreelancerProject {
  id: number;
  title: string;
  preview_description?: string | undefined;
  description?: string | undefined;
  type: 'fixed' | 'hourly' | string;
  status?: string | undefined;
  frontend_project_status?: string | undefined;
  deleted?: boolean | undefined;
  submitdate?: number;
  time_submitted?: number;
  time_updated?: number;
  seo_url?: string;
  language?: string | undefined;
  local?: boolean | undefined;
  urgent?: boolean;
  featured?: boolean;
  currency?: { code?: string } | undefined;
  budget?: { minimum?: number; maximum?: number } | undefined;
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
  seoUrl?: string | undefined;
}

export interface NormalizedProject {
  id: number;
  title: string;
  previewDescription?: string | undefined;
  description?: string | undefined;
  type: 'fixed' | 'hourly' | string;
  status?: string | undefined;
  frontendProjectStatus?: string | undefined;
  deleted?: boolean | undefined;
  timeSubmitted?: number | undefined;
  timeUpdated?: number | undefined;
  seoUrl?: string | undefined;
  language?: string | undefined;
  local?: boolean | undefined;
  currency?: { code?: string } | undefined;
  budget?: { minimum?: number; maximum?: number } | undefined;
  bidStats?: { bidCount?: number | undefined; bidAvg?: number | undefined } | undefined;
  jobs: NormalizedProjectJob[];
  clientCountry?: string | undefined;
  clientCountryCode?: string | undefined;
  ownerId?: number | undefined;
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
