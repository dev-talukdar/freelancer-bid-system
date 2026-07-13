import pino from 'pino';
export const logger = pino({
  enabled: false,
  redact: [
    'req.headers.authorization',
    'req.headers.freelancer-oauth-v1',
    'req.headers.x-local-api-key',
    '*.accessToken',
    '*.refreshToken',
    '*.FREELANCER_ACCESS_TOKEN',
    '*.LOCAL_API_SECRET',
    'req.headers.cookie',
  ],
});
