import { toFreelancerProjectUrl } from '@fbs/shared';
import { LocalApiClient } from '../services/local-api.js';
import { addNotifiedId, getSettings, hasNotified } from '../storage/settings.js';
import { createProjectNotification } from './notifications.js';

const logAsyncError = (context: string, error: unknown) => {
  console.error(context, error instanceof Error ? error.message : error);
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollBackend', { periodInMinutes: 0.5 }).catch((error: unknown) => {
    logAsyncError('Failed to create polling alarm', error);
  });
});

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play local alert sound for new Freelancer project notifications',
  });
}
async function playSound() {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'PLAY_ALERT_SOUND' }).catch((error: unknown) => {
    logAsyncError('Failed to send alert sound message', error);
  });
}
async function check() {
  const settings = await getSettings();
  if (!settings.localApiSecret) return;
  const api = new LocalApiClient(settings);
  const projects = await api.detected(true, 10);
  for (const p of projects.items) {
    if (await hasNotified(p.freelancerProjectId)) continue;
    await createProjectNotification(p);
    await addNotifiedId(p.freelancerProjectId);
    await api.markRead(p.id);
    await playSound();
  }
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollBackend') {
    check().catch((error: unknown) => {
      logAsyncError('Backend polling failed', error);
    });
  }
});
chrome.notifications.onClicked.addListener((id) => {
  const projectId = id.replace('project:', '');
  void (async () => {
    const settings = await getSettings();
    const api = new LocalApiClient(settings);
    const found = (await api.detected(false, 50)).items.find((p) => p.id === projectId);
    if (found) {
      await chrome.tabs.create({ url: toFreelancerProjectUrl(found.seoUrl) });
      await api.opened(found.id);
    }
  })().catch((error: unknown) => {
    logAsyncError('Notification click handling failed', error);
  });
});
