# Freelancer Project Monitor

Private monitor for Freelancer.com projects. The backend may run locally or at `https://api.enaema.net`; the Chrome extension stores its backend URL and API key locally. **Automatic bid submission, proposal generation, messaging, scraping, and browser automation are not implemented.**

## Architecture

Freelancer API → Node/Express API → MongoDB persistence/deduplication → Chrome extension popup/service worker/offscreen audio. The extension receives only `LOCAL_API_SECRET`, never the Freelancer token.

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
10. In the extension popup, enter the backend URL and the same `LOCAL_API_SECRET`, then click **Save**.

## Environment variables

See `.env.example`: `NODE_ENV`, `PORT`, `HOST`, `MONGODB_URI`, `FREELANCER_ACCESS_TOKEN`, `FREELANCER_TOKEN_EXPIRES_AT`, `FREELANCER_API_BASE_URL`, `EXTENSION_ID`, `LOCAL_API_SECRET`, `VITE_API_BASE_URL`, `LOG_LEVEL`, `DETECTED_PROJECT_RETENTION_DAYS`.

## Search profile filtering

Search profiles control alert filtering and are intentionally independent from Freelancer bidding eligibility:

- Freelancer profile skills control whether your Freelancer account is eligible to bid on a project.
- `SearchProfile.jobIds` control skill-ID based alert filtering only.
- `SearchProfile.keywords` control text-based alert matching across project title, preview description, full description, and job names.
- `SearchProfile.excludedKeywords` reject unwanted domains across the same title, description, and job-name text.
- Empty `jobIds` means no skill-ID restriction is applied to alerts.
- Empty `keywords` means no keyword restriction is applied to alerts.
- `maximumProjectAgeMinutes` defaults to `600`, accepts integer values from `1` to `1440`, and uses `timeSubmitted` (not `timeUpdated`) so old projects updated recently do not trigger new alerts.

The default seeded profile excludes these keywords: `casino`, `gambling`, `crypto casino`, `betting`, `slot`, `slots`, `adult`, `academic`, and `homework`.

## Monitoring and duplicate prevention

One in-memory poll lock protects scheduled and manual polls. Polls query newest active projects with repeated array query parameters, then apply a second local filter before persistence. Local matching rejects missing/invalid submission times, deleted projects, non-open projects, projects older than `maximumProjectAgeMinutes`, local-only projects when disabled, project type mismatches, excluded keywords, keyword mismatches, job ID mismatches, country/language mismatches, budget mismatches, and bid-count mismatches. MongoDB enforces a unique `{ freelancerProjectId, searchProfileId }` index; project ID is authoritative, not `time_updated`.

Manual poll responses include diagnostic skip counts for `invalidShape`, `deleted`, `notOpen`, `tooOld`, `localProject`, `keywordMismatch`, `excludedKeyword`, `jobMismatch`, `countryMismatch`, `languageMismatch`, `projectTypeMismatch`, and `duplicate`.

## Rate limits

The backend parses `RateLimit-Limit` and `RateLimit-Remaining`, tracks state, doubles delay below 20% remaining, and backs off with jitter for HTTP 429/server errors. GET retries are capped at five attempts with request timeout via `AbortController`.

## Notifications and sound

The extension polls unread detected projects, creates `chrome.notifications`, marks successful notifications read/notified through the backend, and keeps a local fallback set in `chrome.storage.local`. Notification clicks open `https://www.freelancer.com/projects/{seo_url}` after path normalization. Sound is played by an offscreen document using the Web Audio API, so no binary audio asset is committed.

## Security warnings

For local use, bind to `127.0.0.1`. For EC2, put the API behind HTTPS, keep the application port firewalled, and set `EXTENSION_ID` to the ID shown by Chrome for the unpacked extension. Never commit `.env`. Use a long random `LOCAL_API_SECRET`. Pino redacts auth headers and secrets. The Freelancer token is backend-only and never sent to extension code.

## Troubleshooting

- Disconnected popup: save `https://api.enaema.net` and the EC2 `LOCAL_API_SECRET` in the popup; then verify `https://api.enaema.net/api/v1/health`. An `INVALID_LOCAL_API_KEY` response from `/api/v1` is expected because protected routes require the header and `/api/v1` is not the health endpoint.
- CORS failure: set the EC2 `EXTENSION_ID` to the exact ID at `chrome://extensions` and restart the API.
- Token warning: update the Freelancer token before the 30-day expiration.
- No projects: configure `SearchProfile.jobIds` and/or `SearchProfile.keywords`; leave them empty only when you intentionally want no skill-ID or text restriction.
- Sound missing: verify Chrome allows extension offscreen documents and rebuild the extension.

## Current limitations

Single-process lock only, one active profile at a time in UI workflow, no infrastructure-as-code, no bidding/proposals/messaging.
