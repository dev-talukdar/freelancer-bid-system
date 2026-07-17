/* eslint-disable @typescript-eslint/consistent-type-imports */
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DetectedProjectDto, HealthDto } from '@fbs/shared';
import { toFreelancerProjectUrl } from '@fbs/shared';
import { LocalApiClient } from '../services/local-api.js';
import { clearNotifiedIds, getSettings, saveSettings } from '../storage/settings.js';
import './style.css';
import { ApiKeyStatus, buildPopupViewModel, MonitorStatus, trimSecret } from './view-model.js';
import { formatBangladeshDateTime } from '../utils/time.js';

const badgeClass = (tone: 'green' | 'red' | 'amber' | 'slate') => `badge badge-${tone}`;
const statusTone = (status: MonitorStatus) =>
  status === 'running'
    ? 'green'
    : status === 'connecting'
      ? 'amber'
      : status === 'error'
        ? 'red'
        : 'slate';
const apiTone = (status: ApiKeyStatus) =>
  status === 'valid' ? 'green' : status === 'invalid' ? 'red' : 'amber';
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'red' | 'amber' | 'slate';
}) {
  return <span className={badgeClass(tone)}>{label}</span>;
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function RecentProjectCard({ project }: { project: DetectedProjectDto }) {
  const skills = project.jobs.map((job) => job.name).join(', ') || 'No skills listed';
  const budget =
    `${project.currency ?? ''} ${project.budgetMinimum ?? '?'}-${project.budgetMaximum ?? '?'}`.trim();
  return (
    <article className="project-card">
      <div>
        <strong>{project.title}</strong>
        <p>
          {budget} • {project.projectType}
        </p>
        <p>{skills}</p>
        <p>Detected {formatBangladeshDateTime(project.detectedAt)}</p>
      </div>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => {
          void chrome.tabs.create({ url: toFreelancerProjectUrl(project.seoUrl) });
        }}
      >
        Open
      </button>
    </article>
  );
}

function App() {
  const [secret, setSecret] = useState('');
  const [health, setHealth] = useState<HealthDto>();
  const [projects, setProjects] = useState<DetectedProjectDto[]>([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [isClearingProjects, setIsClearingProjects] = useState(false);
  const [isSavingSecret, setIsSavingSecret] = useState(false);

  const load = async () => {
    const settings = await getSettings();
    setSecret(settings.localApiSecret);
    const api = new LocalApiClient(settings);
    if (!settings.localApiSecret) {
      setHealth(await api.health());
      setProjects([]);
      setError('');
      return;
    }
    setHealth(await api.health());
    setProjects((await api.detected(false, 5)).items);
    setError('');
  };

  useEffect(() => {
    void load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Failed to connect'),
    );
  }, []);

  const saveSecret = async (event: React.FormEvent) => {
    event.preventDefault();
    const localApiSecret = trimSecret(secret);
    setIsSavingSecret(true);
    setFeedback('');
    setError('');
    try {
      const settings = await getSettings();
      await saveSettings({ ...settings, localApiSecret });
      setSecret(localApiSecret);
      await load();
      if (localApiSecret) {
        setFeedback('Local API key saved.');
        void chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }).catch(() => undefined);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save the local API key');
    } finally {
      setIsSavingSecret(false);
    }
  };

  const view = useMemo(
    () => buildPopupViewModel({ health, secret, error, isPolling, actionPending }),
    [health, secret, error, isPolling, actionPending],
  );

  const call = async (action: 'start' | 'stop' | 'poll') => {
    setActionPending(true);
    setFeedback('');
    if (action === 'poll') setIsPolling(true);
    try {
      const api = new LocalApiClient(await getSettings());
      const result = await api[action]();
      if (action === 'poll') {
        const poll = result as Awaited<ReturnType<LocalApiClient['poll']>>;
        const reasons = Object.entries(poll.skipReasons)
          .filter(([, count]) => count > 0)
          .map(([reason, count]) => `${reason}: ${count}`)
          .join(', ');
        setFeedback(
          `Poll completed — returned: ${poll.returned}, matched: ${poll.matched}, new: ${poll.new}, skipped: ${poll.skipped}${
            reasons ? ` (${reasons})` : ''
          }.${poll.matched === 0 ? ' No notification because no project matched filters.' : ''}`,
        );
        chrome.runtime.sendMessage({ type: 'CHECK_NOTIFICATIONS' }).catch(() => undefined);
      } else {
        setFeedback(action === 'start' ? 'Monitoring started' : 'Monitoring stopped');
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
      setFeedback(action === 'poll' ? 'Poll failed' : 'Action failed');
    } finally {
      setIsPolling(false);
      setActionPending(false);
    }
  };

  const clearProjects = async () => {
    setIsClearingProjects(true);
    setFeedback('');
    try {
      const api = new LocalApiClient(await getSettings());
      const result = await api.clearDetectedProjects();
      await clearNotifiedIds();
      setProjects([]);
      setFeedback(
        `Cleared ${result.deletedCount} stored projects. New detections will appear only when posted.`,
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Clear failed');
      setFeedback('Clear failed');
    } finally {
      setIsClearingProjects(false);
    }
  };

  const monitoringLabel = view.monitorRunning ? 'Stop monitoring' : 'Start monitoring';

  return (
    <main className="popup-shell">
      <header className="header">
        <div>
          <h1>Freelancer Monitor</h1>
          <p>Project alerts in real time</p>
        </div>
        <div className="live-status" aria-live="polite">
          <span className={`dot dot-${statusTone(view.monitorStatus)}`} />
          {titleCase(view.monitorStatus)}
        </div>
      </header>

      {(error || feedback) && (
        <p className={error ? 'notice notice-error' : 'notice'} aria-live="polite">
          {feedback || error}
        </p>
      )}

      <section className="card status-card" aria-label="Connection and monitoring status">
        <StatusRow label="Backend">
          <StatusBadge
            label={view.backendConnected ? 'Connected' : 'Disconnected'}
            tone={view.backendConnected ? 'green' : 'red'}
          />
        </StatusRow>
        <StatusRow label="Monitoring">
          <StatusBadge
            label={view.monitorRunning ? 'Running' : 'Stopped'}
            tone={view.monitorRunning ? 'green' : 'slate'}
          />
        </StatusRow>
        <StatusRow label="Local API key">
          <StatusBadge label={titleCase(view.apiKeyStatus)} tone={apiTone(view.apiKeyStatus)} />
        </StatusRow>
        <StatusRow label="Freelancer token">
          <StatusBadge
            label={health?.freelancerTokenConfigured ? 'Configured' : 'Missing'}
            tone={health?.freelancerTokenConfigured ? 'green' : 'amber'}
          />
        </StatusRow>
        <StatusRow label="Unread">
          <strong>{view.unreadCount}</strong>
        </StatusRow>
      </section>

      <form className="card" onSubmit={(event) => void saveSecret(event)}>
        <label className="section-title" htmlFor="local-api-secret">
          Local API key
        </label>
        <div className="secret-row">
          <input
            className="secret-input"
            id="local-api-secret"
            type="password"
            autoComplete="off"
            placeholder="LOCAL_API_SECRET"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
          <button className="btn btn-secondary" type="submit" disabled={isSavingSecret}>
            {isSavingSecret ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="hint">Use the same LOCAL_API_SECRET configured in the backend .env file.</p>
      </form>

      <section className="card poll-card" aria-label="Polling information">
        <StatusRow label="Last poll">
          <span>
            {view.lastPollAt
              ? `${formatBangladeshDateTime(view.lastPollAt)}    `
              : 'Not polled yet'}
          </span>
        </StatusRow>
        <StatusRow label="Next poll">
          <span>
            {view.nextPollAt ? ` ${formatBangladeshDateTime(view.nextPollAt)}` : 'Not available'}
          </span>
        </StatusRow>
        <StatusRow label="Interval">
          <span>{view.pollIntervalSeconds ? `${view.pollIntervalSeconds}s` : 'Not available'}</span>
        </StatusRow>
      </section>

      <section className="controls" aria-label="Monitoring controls">
        <button
          className="btn btn-primary btn-wide"
          type="button"
          disabled={view.monitorRunning ? view.stopUnavailable : view.startUnavailable}
          onClick={() => {
            void call(view.monitorRunning ? 'stop' : 'start');
          }}
        >
          {actionPending && !isPolling ? 'Working…' : monitoringLabel}
        </button>
        <button
          className="btn btn-secondary btn-wide"
          type="button"
          disabled={view.pollUnavailable}
          onClick={() => {
            void call('poll');
          }}
        >
          {view.isPolling ? 'Polling…' : 'Poll now'}
        </button>
      </section>

      <section className="recent">
        <div className="recent-header">
          <h2>Recent projects</h2>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              void clearProjects();
            }}
          >
            {isClearingProjects ? 'Clearing…' : 'Clear projects'}
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="empty">
            <strong>No recent projects yet</strong>
            <p>Matching projects will appear here after detection.</p>
          </div>
        ) : (
          projects.map((project) => <RecentProjectCard key={project.id} project={project} />)
        )}
      </section>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
