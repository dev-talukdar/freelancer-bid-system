import { defaultSettings, type ExtensionSettings } from '../services/local-api.js';
const keys={settings:'settings',notified:'notifiedFreelancerProjectIds'};
export async function getSettings():Promise<ExtensionSettings>{ const data=await chrome.storage.local.get(keys.settings); return {...defaultSettings,...(data[keys.settings] as Partial<ExtensionSettings>|undefined)}; }
export const saveSettings=(settings:ExtensionSettings)=>chrome.storage.local.set({[keys.settings]:settings});
export async function getNotifiedIds():Promise<number[]>{ const data=await chrome.storage.local.get(keys.notified); return Array.isArray(data[keys.notified]) ? data[keys.notified] as number[] : []; }
export async function addNotifiedId(id:number){ const ids=new Set(await getNotifiedIds()); ids.add(id); await chrome.storage.local.set({[keys.notified]:[...ids].slice(-500)}); }
export async function hasNotified(id:number){ return (await getNotifiedIds()).includes(id); }
