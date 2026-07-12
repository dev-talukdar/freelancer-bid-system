/* eslint-disable @typescript-eslint/consistent-type-imports */
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DetectedProjectDto, HealthDto } from '@fbs/shared';
import { toFreelancerProjectUrl } from '@fbs/shared';
import { LocalApiClient } from '../services/local-api.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import './style.css';
import { ApiKeyStatus, buildPopupViewModel, MonitorStatus, trimSecret } from './view-model.js';
import { formatBangladeshDateTime, formatRelativeTime } from '../utils/time.js';

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

function SecretField({
  value,
  savedValue,
  saving,
  onChange,
  onSave,
}: {
  value: string;
  savedValue: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const trimmed = trimSecret(value);
  const dirty = trimmed !== savedValue;
  return (
    <section className="card secret-card">
      <div className="section-title">Local API secret</div>
      <div className="secret-row">
        <input
          aria-label="Local API secret"
          className="secret-input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter local API secret"
        />
        <button
          aria-label={visible ? 'Hide API secret' : 'Show API secret'}
          className="btn btn-ghost"
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!dirty || !trimmed || saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="hint">
        {dirty ? 'Unsaved changes' : savedValue ? 'Saved and masked' : 'Secret required'}
      </p>
    </section>
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
  const [savedSecret, setSavedSecret] = useState('');
  const [health, setHealth] = useState<HealthDto>();
  const [projects, setProjects] = useState<DetectedProjectDto[]>([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [isSavingSecret, setIsSavingSecret] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = async () => {
    const settings = await getSettings();
    setSecret(settings.localApiSecret);
    setSavedSecret(settings.localApiSecret);
    if (!settings.localApiSecret) {
      setHealth(undefined);
      setProjects([]);
      return;
    }
    const api = new LocalApiClient(settings);
    setHealth(await api.health());
    setProjects((await api.detected(false, 5)).items);
    setError('');
  };

  useEffect(() => {
    void load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Failed to connect'),
    );
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const save = async () => {
    const trimmed = trimSecret(secret);
    if (!trimmed || trimmed === savedSecret) return;
    setIsSavingSecret(true);
    setFeedback('');
    try {
      await saveSettings({ apiBaseUrl: 'http://127.0.0.1:4300', localApiSecret: trimmed });
      setSecret(trimmed);
      setSavedSecret(trimmed);
      setFeedback('Secret saved');
      await load();
    } catch {
      setFeedback('Secret save failed');
    } finally {
      setIsSavingSecret(false);
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

      <SecretField
        value={secret}
        savedValue={savedSecret}
        saving={isSavingSecret}
        onChange={setSecret}
        onSave={() => {
          void save();
        }}
      />

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
        <StatusRow label="API key">
          <StatusBadge label={titleCase(view.apiKeyStatus)} tone={apiTone(view.apiKeyStatus)} />
        </StatusRow>
        <StatusRow label="Unread">
          <strong>{view.unreadCount}</strong>
        </StatusRow>
      </section>

      <section className="card poll-card" aria-label="Polling information">
        <StatusRow label="Last poll">
          <span>
            {view.lastPollAt
              ? `${formatBangladeshDateTime(view.lastPollAt)} • ${formatRelativeTime(view.lastPollAt, now)}`
              : 'Not polled yet'}
          </span>
        </StatusRow>
        <StatusRow label="Next poll">
          <span>
            {view.nextPollAt
              ? `${formatRelativeTime(view.nextPollAt, now)} • ${formatBangladeshDateTime(view.nextPollAt)}`
              : 'Not available'}
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
        <h2>Recent projects</h2>
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
