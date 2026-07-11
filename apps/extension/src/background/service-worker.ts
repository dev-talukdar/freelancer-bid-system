import { toFreelancerProjectUrl, type DetectedProjectDto } from '@fbs/shared';
import { LocalApiClient } from '../services/local-api.js';
import { addNotifiedId, getSettings, hasNotified } from '../storage/settings.js';
import { createProjectNotification } from './notifications.js';

const alarmName = 'pollBackend';
const notificationPrefix = 'detected-project:';
const inFlight = new Set<string>();
const clickedProjects = new Map<string, DetectedProjectDto>();

const logAsyncError = (context: string, error: unknown) => {
  console.error(context, error instanceof Error ? error.message : error);
};

async function ensurePollingAlarm() {
  await chrome.alarms.create(alarmName, { periodInMinutes: 0.5 });
}

chrome.runtime.onInstalled.addListener(() => {
  ensurePollingAlarm().catch((error: unknown) =>
    logAsyncError('Failed to create polling alarm', error),
  );
});
chrome.runtime.onStartup.addListener(() => {
  ensurePollingAlarm().catch((error: unknown) =>
    logAsyncError('Failed to create polling alarm', error),
  );
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
  await chrome.runtime.sendMessage({ type: 'PLAY_ALERT_SOUND' });
}

async function notifyProject(
  api: LocalApiClient,
  project: DetectedProjectDto,
  soundEnabled: boolean,
) {
  if (inFlight.has(project.id) || (await hasNotified(project.id))) return;
  inFlight.add(project.id);
  try {
    await createProjectNotification(project);
    clickedProjects.set(`${notificationPrefix}${project.id}`, project);
    await api.markNotified(project.id);
    await addNotifiedId(project.id);
    if (soundEnabled) {
      playSound().catch((error: unknown) => logAsyncError('Sound playback failed', error));
    }
  } finally {
    inFlight.delete(project.id);
  }
}

async function check() {
  const settings = await getSettings();
  if (!settings.localApiSecret) return;
  const api = new LocalApiClient(settings);
  const response = await api.unnotified(10);
  if (!response.notification.enabled) return;
  await Promise.all(
    response.items.map((project) =>
      notifyProject(api, project, response.notification.soundEnabled),
    ),
  );
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) {
    check().catch((error: unknown) => logAsyncError('Backend polling failed', error));
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    if (!notificationId.startsWith(notificationPrefix)) return;
    const projectId = notificationId.slice(notificationPrefix.length);
    const settings = await getSettings();
    const api = new LocalApiClient(settings);
    let project = clickedProjects.get(notificationId);
    if (!project) {
      project = (await api.detected(false, 50)).items.find((item) => item.id === projectId);
    }
    if (!project) return;
    await chrome.tabs.create({
      url: toFreelancerProjectUrl(project.seoUrl || String(project.freelancerProjectId)),
    });
    await api.opened(project.id);
    await chrome.notifications.clear(notificationId);
  })().catch((error: unknown) => logAsyncError('Notification click handling failed', error));
});
