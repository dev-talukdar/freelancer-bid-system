# Freelancer Monitor API

Standalone ESM/TypeScript API for polling Freelancer and serving the Chrome extension.

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

MongoDB must be running and `LOCAL_API_SECRET` must match the key saved in the extension. The API listens on `http://127.0.0.1:4300`; health is available at `GET /api/v1/health`.

## Verification

```sh
npm run typecheck
npm run build
npm test
npm start
```
