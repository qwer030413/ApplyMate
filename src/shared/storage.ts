import { emptyProfile, parseBackup, type ApplicantProfile } from "./profile";
import { resumeStore } from './resume-file';
const key = "applymate.profile";
const extension = () =>
  typeof chrome !== "undefined" && !!chrome.storage?.local;
export const profileStore = {
  async get(): Promise<ApplicantProfile> {
    const value = extension()
      ? (await chrome.storage.local.get(key))[key]
      : JSON.parse(localStorage.getItem(key) || "null");
    return value ? parseBackup(value) : emptyProfile();
  },
  async set(profile: ApplicantProfile) {
    const valid = parseBackup(profile);
    if (extension()) await chrome.storage.local.set({ [key]: valid });
    else localStorage.setItem(key, JSON.stringify(valid));
  },
  async clear() {
    if (extension()) {
      const result = await chrome.runtime.sendMessage({ type: "CLEAR_DATA" });
      if (result?.error) throw new Error(result.error);
    } else {await resumeStore.clear();localStorage.removeItem(key);}
  },
};
