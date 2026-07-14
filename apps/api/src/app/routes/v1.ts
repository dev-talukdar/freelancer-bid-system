import { Router, type Response } from 'express';
import { env, isTokenExpiringSoon } from '../config/env.js';
import { dbStatus } from '../db/mongoose.js';
import { FreelancerClient } from '../modules/freelancer-client/client.js';
import {
  createProfile,
  listProfiles,
  updateProfile,
  activateProfile,
} from '../modules/search-profile/service.js';
import {
  clearDetectedProjects,
  listDetected,
  listUnnotified,
  markNotified,
  markOpened,
  markRead,
} from '../modules/detected-project/service.js';
import {
  detectedProjectsQuerySchema,
  objectIdParamSchema,
  unnotifiedProjectsQuerySchema,
} from '../modules/detected-project/validation.js';
import { monitor } from '../modules/project-monitor/service.js';
import { DetectedProjectModel } from '../modules/detected-project/model.js';

export const v1Router = Router();
const ok = (res: Response, message: string, data: unknown) =>
  res.json({ success: true, message, data });

v1Router.get('/health', async (_req, res) =>
  ok(res, 'Health check', {
    status: dbStatus() === 'connected' ? 'ok' : 'degraded',
    database: dbStatus(),
    monitoring: {
      ...monitor.state,
      polling: monitor.lock.isLocked(),
      unreadCount: await DetectedProjectModel.countDocuments({ readAt: { $exists: false } }),
    },
    freelancerTokenConfigured: Boolean(env.FREELANCER_ACCESS_TOKEN),
    freelancerTokenExpiresAt: env.FREELANCER_TOKEN_EXPIRES_AT,
    freelancerTokenExpirationWarning: isTokenExpiringSoon(),
  }),
);
v1Router.get('/freelancer/me', async (_req, res, next) => {
  try {
    const me = await new FreelancerClient().self();
    ok(res, 'Freelancer user loaded', {
      id: me.id,
      username: me.username,
      displayName: me.display_name,
      emailVerified: me.email_verified,
    });
  } catch (e) {
    next(e);
  }
});
v1Router.get('/search-profiles', async (_req, res) =>
  ok(res, 'Search profiles loaded', await listProfiles()),
);
v1Router.post('/search-profiles', async (req, res, next) => {
  try {
    ok(res, 'Search profile created', await createProfile(req.body));
  } catch (e) {
    next(e);
  }
});
v1Router.patch('/search-profiles/:id', async (req, res, next) => {
  try {
    ok(res, 'Search profile updated', await updateProfile(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
});
v1Router.post('/search-profiles/:id/activate', async (req, res) =>
  ok(res, 'Search profile activated', await activateProfile(req.params.id)),
);
v1Router.post('/monitor/start', (_req, res) => {
  monitor.start();
  ok(res, 'Monitor started', monitor.state);
});
v1Router.post('/monitor/stop', (_req, res) => {
  monitor.stop();
  ok(res, 'Monitor stopped', monitor.state);
});
v1Router.get('/monitor/status', async (_req, res) =>
  ok(res, 'Monitor status', {
    ...monitor.state,
    polling: monitor.lock.isLocked(),
    unreadCount: await DetectedProjectModel.countDocuments({ readAt: { $exists: false } }),
  }),
);
v1Router.post('/monitor/poll', async (_req, res, next) => {
  try {
    ok(res, 'Poll completed', await monitor.poll());
  } catch (e) {
    next(e);
  }
});
v1Router.get('/detected-projects', async (req, res, next) => {
  try {
    const query = detectedProjectsQuerySchema.parse(req.query);
    ok(
      res,
      'Detected projects loaded',
      await listDetected(query.page, query.pageSize, query.unreadOnly),
    );
  } catch (e) {
    next(e);
  }
});
v1Router.get('/detected-projects/unnotified', async (req, res, next) => {
  try {
    const query = unnotifiedProjectsQuerySchema.parse(req.query);
    ok(res, 'Unnotified detected projects loaded', await listUnnotified(query.limit));
  } catch (e) {
    next(e);
  }
});
v1Router.delete('/detected-projects', async (_req, res, next) => {
  try {
    ok(res, 'Detected projects cleared', await clearDetectedProjects());
  } catch (e) {
    next(e);
  }
});
v1Router.patch('/detected-projects/:id/notified', async (req, res, next) => {
  try {
    const params = objectIdParamSchema.parse(req.params);
    ok(res, 'Detected project marked notified', await markNotified(params.id));
  } catch (e) {
    next(e);
  }
});
v1Router.patch('/detected-projects/:id/read', async (req, res, next) => {
  try {
    const params = objectIdParamSchema.parse(req.params);
    ok(res, 'Detected project marked read', await markRead(params.id));
  } catch (e) {
    next(e);
  }
});
v1Router.patch('/detected-projects/:id/opened', async (req, res, next) => {
  try {
    const params = objectIdParamSchema.parse(req.params);
    ok(res, 'Detected project marked opened', await markOpened(params.id));
  } catch (e) {
    next(e);
  }
});
