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

export async function ensurePollingAlarm() {
  await chrome.alarms.create(alarmName, { periodInMinutes: 0.5 });
}

export async function initializePolling() {
  await ensurePollingAlarm();
  const settings = await getSettings();
  if (!settings.localApiSecret) return;

  const api = new LocalApiClient(settings);
  await api.start();
  await check(api);
}

chrome.runtime.onInstalled.addListener(() => {
  initializePolling().catch((error: unknown) =>
    logAsyncError('Failed to initialize notification polling', error),
  );
});
chrome.runtime.onStartup.addListener(() => {
  initializePolling().catch((error: unknown) =>
    logAsyncError('Failed to initialize notification polling on startup', error),
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

export async function notifyProject(
  api: LocalApiClient,
  project: DetectedProjectDto,
  soundEnabled: boolean,
) {
  if (inFlight.has(project.id) || (await hasNotified(project.id))) return;
  inFlight.add(project.id);
  try {
    console.info('Creating Freelancer project notification', {
      projectId: project.id,
      title: project.title,
    });
    await createProjectNotification(project);
    console.info('Freelancer project notification created', { projectId: project.id });
    clickedProjects.set(`${notificationPrefix}${project.id}`, project);
    await api.markNotified(project.id);
    console.info('Freelancer project marked notified', { projectId: project.id });
    await addNotifiedId(project.id);
    if (soundEnabled) {
      playSound().catch((error: unknown) => logAsyncError('Sound playback failed', error));
    }
  } finally {
    inFlight.delete(project.id);
  }
}

export async function check(api?: LocalApiClient) {
  if (!api) {
    const settings = await getSettings();
    if (!settings.localApiSecret) return;
    api = new LocalApiClient(settings);
  }

  const response = await api.unnotified(10);
  console.info('Fetched unnotified Freelancer projects', {
    count: response.items.length,
    notificationEnabled: response.notification.enabled,
  });
  if (!response.notification.enabled) return;
  await Promise.all(
    response.items.map((project) =>
      notifyProject(api, project, response.notification.soundEnabled),
    ),
  );
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message.type === 'CHECK_NOTIFICATIONS' || message.type === 'SETTINGS_UPDATED')
  ) {
    const action = message.type === 'SETTINGS_UPDATED' ? initializePolling() : check();
    action.catch((error: unknown) => logAsyncError('Manual notification check failed', error));
  }
});

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
