import { defaultSettings, type ExtensionSettings } from '../services/local-api.js';

const keys = { settings: 'settings', notified: 'notifiedDetectedProjectIds' };
export const clearNotifiedIds = () => chrome.storage.local.set({ [keys.notified]: [] });
const maxDedupeEntries = 500;

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(keys.settings);
  const stored = data[keys.settings] as Partial<ExtensionSettings> | undefined;
  return {
    ...defaultSettings,
    ...stored,
    localApiSecret: defaultSettings.localApiSecret || stored?.localApiSecret || '',
  };
}
export const saveSettings = (settings: ExtensionSettings) =>
  chrome.storage.local.set({ [keys.settings]: settings });

export async function getNotifiedIds(): Promise<string[]> {
  const data = await chrome.storage.local.get(keys.notified);
  return Array.isArray(data[keys.notified]) ? (data[keys.notified] as string[]) : [];
}
export async function addNotifiedId(id: string) {
  const ids = new Set(await getNotifiedIds());
  ids.add(id);
  await chrome.storage.local.set({ [keys.notified]: [...ids].slice(-maxDedupeEntries) });
}
export async function hasNotified(id: string) {
  return (await getNotifiedIds()).includes(id);
}
