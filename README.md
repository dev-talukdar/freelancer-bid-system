# Freelancer Project Monitor

Private local-first monitor for Freelancer.com projects. Phase 1 validates a Personal Access Token, polls active projects, filters matches, persists deduplication state, and lets a Chrome Manifest V3 extension display notifications and play a local sound. **Automatic bid submission, proposal generation, messaging, scraping, and browser automation are not implemented.**

## Architecture

Freelancer API → local Node/Express API at `127.0.0.1:4300` → MongoDB persistence/deduplication → Chrome extension popup/service worker/offscreen audio. The extension only calls local routes and never receives the Freelancer token.

## Prerequisites

Node.js 22+, npm 10.13.1, MongoDB, Chrome.

## Setup

1. Install Node.js 22+ with npm 10.13.1.
2. `npm install`
3. Copy `.env.example` to `.env` at the repository root and fill values. Optionally, `apps/api/.env` can override root values for the API workspace only.
4. Start MongoDB locally or provide `MONGODB_URI`.
5. Generate a Freelancer Personal Access Token in Freelancer account settings/developer API settings. Tokens expire after 30 days; set `FREELANCER_TOKEN_EXPIRES_AT`.
6. Start backend: `npm run dev:api`.
7. Validate token: call `GET http://127.0.0.1:4300/api/v1/freelancer/me` with header `X-Local-API-Key: <LOCAL_API_SECRET>`.
8. Build extension: `npm run build:extension`.
9. Load unpacked in Chrome from `apps/extension/dist`, copy its extension ID, set `EXTENSION_ID`, and restart the backend.
10. Enter the same `LOCAL_API_SECRET` in the extension popup.

## Environment variables

See `.env.example`: `NODE_ENV`, `PORT`, `HOST`, `MONGODB_URI`, `FREELANCER_ACCESS_TOKEN`, `FREELANCER_TOKEN_EXPIRES_AT`, `FREELANCER_API_BASE_URL`, `EXTENSION_ID`, `LOCAL_API_SECRET`, `LOG_LEVEL`, `DETECTED_PROJECT_RETENTION_DAYS`.

## Search profile filtering

Search profiles control alert filtering and are intentionally independent from Freelancer bidding eligibility:

- Freelancer profile skills control whether your Freelancer account is eligible to bid on a project.
- `SearchProfile.jobIds` control skill-ID based alert filtering only.
- `SearchProfile.keywords` control text-based alert matching across project title, preview description, full description, and job names.
- `SearchProfile.excludedKeywords` reject unwanted domains across the same title, description, and job-name text.
- Empty `jobIds` means no skill-ID restriction is applied to alerts.
- Empty `keywords` means no keyword restriction is applied to alerts.
- `maximumProjectAgeMinutes` defaults to `720` (12 hours), accepts integer values from `1` to `1440`, and uses `timeSubmitted` (not `timeUpdated`) so old projects updated recently do not trigger new alerts.
- `countries`, `currencies`, and `languages` are local alert filters. Empty arrays mean unrestricted. The default profile leaves `languages` unrestricted because Freelancer API responses can omit language even when the website shows English.
- Budget minimum filters are disabled by default so lower-budget projects can still be detected and reviewed manually.

The default seeded profile excludes these keywords: `casino`, `gambling`, `crypto casino`, `betting`, `slot`, `slots`, `adult`, `academic`, and `homework`.

## Monitoring and duplicate prevention

One in-memory poll lock protects scheduled and manual polls. Polls query the newest submitted active projects without a remote `from_time` cutoff, then apply all profile filters locally before persistence. Local matching rejects missing/invalid submission times, deleted projects, non-open projects, projects older than `maximumProjectAgeMinutes`, local-only projects when disabled, project type mismatches, excluded keywords, keyword mismatches, job ID mismatches, country/language mismatches, budget mismatches, and bid-count mismatches. MongoDB enforces a unique `{ freelancerProjectId, searchProfileId }` index; project ID is authoritative, not `time_updated`.

Manual poll responses include diagnostic skip counts for `invalidShape`, `deleted`, `notOpen`, `tooOld`, `localProject`, `keywordMismatch`, `excludedKeyword`, `jobMismatch`, `countryMismatch`, `languageMismatch`, `projectTypeMismatch`, `currencyMismatch`, `bidCountExceeded`, `fixedBudgetMismatch`, `hourlyRateMismatch`, and `duplicate`.

## Rate limits

The backend parses `RateLimit-Limit` and `RateLimit-Remaining`, tracks state, doubles delay below 20% remaining, and backs off with jitter for HTTP 429/server errors. GET retries are capped at five attempts with request timeout via `AbortController`.

## Notifications and sound

The extension polls unread detected projects, creates `chrome.notifications`, marks successful notifications read/notified through the backend, and keeps a local fallback set in `chrome.storage.local`. Notification clicks open `https://www.freelancer.com/projects/{seo_url}` after path normalization. Sound is played by an offscreen document using the Web Audio API, so no binary audio asset is committed.

## Security warnings

Bind to `127.0.0.1` only. Never commit `.env`. Use a long random `LOCAL_API_SECRET`. Pino redacts auth headers and secrets. CORS is restricted to your Chrome extension origin once `EXTENSION_ID` is configured. The Freelancer token is backend-only and never sent to extension code.

## Troubleshooting

- Disconnected popup: backend stopped, wrong secret, or `EXTENSION_ID`/CORS mismatch.
- Token warning: update the Freelancer token before the 30-day expiration.
- No projects: configure `SearchProfile.jobIds` and/or `SearchProfile.keywords`; leave them empty only when you intentionally want no skill-ID or text restriction.
- Sound missing: verify Chrome allows extension offscreen documents and rebuild the extension.

## Current limitations

Single-process lock only, local MongoDB dependency, one active profile at a time in UI workflow, no deployment config, no bidding/proposals/messaging.
