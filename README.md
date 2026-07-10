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

## Monitoring and duplicate prevention
One in-memory poll lock protects scheduled and manual polls. Polls query newest active projects with repeated array query parameters, then apply a second local filter for keywords, excluded keywords, job IDs, countries, languages, project type, budgets, bid count, local-only, deleted, and non-open projects. MongoDB enforces a unique `{ freelancerProjectId, searchProfileId }` index; project ID is authoritative, not `time_updated`.

## Rate limits
The backend parses `RateLimit-Limit` and `RateLimit-Remaining`, tracks state, doubles delay below 20% remaining, and backs off with jitter for HTTP 429/server errors. GET retries are capped at five attempts with request timeout via `AbortController`.

## Notifications and sound
The extension polls unread detected projects, creates `chrome.notifications`, marks successful notifications read/notified through the backend, and keeps a local fallback set in `chrome.storage.local`. Notification clicks open `https://www.freelancer.com/projects/{seo_url}` after path normalization. Sound is played by an offscreen document using the Web Audio API, so no binary audio asset is committed.

## Security warnings
Bind to `127.0.0.1` only. Never commit `.env`. Use a long random `LOCAL_API_SECRET`. Pino redacts auth headers and secrets. CORS is restricted to your Chrome extension origin once `EXTENSION_ID` is configured. The Freelancer token is backend-only and never sent to extension code.

## Troubleshooting
- Disconnected popup: backend stopped, wrong secret, or `EXTENSION_ID`/CORS mismatch.
- Token warning: update the Freelancer token before the 30-day expiration.
- No projects: configure real Freelancer job IDs in search profiles; defaults are documented placeholders only.
- Sound missing: verify Chrome allows extension offscreen documents and rebuild the extension.

## Current limitations
Single-process lock only, local MongoDB dependency, one active profile at a time in UI workflow, no deployment config, no bidding/proposals/messaging.
