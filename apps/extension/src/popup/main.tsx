import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DetectedProjectDto, HealthDto } from '@fbs/shared';
import { toFreelancerProjectUrl } from '@fbs/shared';
import { LocalApiClient } from '../services/local-api.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import './style.css';

function App() {
  const [secret, setSecret] = useState('');
  const [health, setHealth] = useState<HealthDto>();
  const [projects, setProjects] = useState<DetectedProjectDto[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    const settings = await getSettings();
    setSecret(settings.localApiSecret);
    if (!settings.localApiSecret) return;
    const api = new LocalApiClient(settings);
    setHealth(await api.health());
    setProjects((await api.detected(false, 5)).items);
  };

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  const call = async (action: 'start' | 'stop' | 'poll') => {
    const api = new LocalApiClient(await getSettings());
    await api[action]();
    await load();
  };

  const save = async () => {
    await saveSettings({ apiBaseUrl: 'http://127.0.0.1:4300', localApiSecret: secret });
    await load();
  };

  return (
    <main className="p-4 w-96 text-sm">
      <h1 className="text-lg font-bold">Freelancer Monitor</h1>
      <label>
        Local API Secret
        <input className="border w-full" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      </label>
      <button onClick={() => { void save(); }}>Save</button>
      {error && <p className="text-red-600">{error}</p>}
      <section>
        <p>Backend: {health ? 'connected' : 'disconnected'}</p>
        <p>Monitor: {health?.monitoring.running ? 'running' : 'stopped'}</p>
        <p>Token warning: {health?.freelancerTokenExpirationWarning ? 'yes' : 'no'}</p>
        <p>Last poll: {health?.monitoring.lastSuccessfulPoll ?? 'never'}</p>
        <p>Interval: {health?.monitoring.currentPollingIntervalSeconds ?? '-'}s</p>
        <p>Unread: {health?.monitoring.unreadCount ?? 0}</p>
        <button onClick={() => { void call('start'); }}>Start monitoring</button>
        <button onClick={() => { void call('stop'); }}>Stop monitoring</button>
        <button onClick={() => { void call('poll'); }}>Manual poll</button>
      </section>
      <h2>Recent projects</h2>
      {projects.map((p) => (
        <article key={p.id} className="border-t py-2">
          <strong>{p.title}</strong>
          <p>{p.currency} {p.budgetMinimum ?? '?'}-{p.budgetMaximum ?? '?'} • {p.projectType}</p>
          <button onClick={() => { void chrome.tabs.create({ url: toFreelancerProjectUrl(p.seoUrl) }); }}>Open project</button>
        </article>
      ))}
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
