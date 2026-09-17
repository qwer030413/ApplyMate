import { profileStore } from "../shared/storage";
import { matchField } from "../shared/matching";
import type { DetectedField } from "../shared/types";
import { resumeStore, attachmentFor, isResumeField, acceptsResume } from '../shared/resume-file';
const secure = () =>
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void secure();
chrome.runtime.onInstalled.addListener(() => {
  void secure();
});
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    void chrome.sidePanel.open({ tabId: tab.id });
    void inject(tab.id).catch(() => undefined);
  }
});
async function inject(tabId: number) {
  try {
    return await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } catch {
    return await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  async function handle() {
    if (message.type === "RESOLVE" || message.type === "COUNTS") {
      if (!sender.tab || !sender.url?.match(/^https?:/))
        throw new Error("Untrusted request.");
      await chrome.storage.session.set({
        [`target.${sender.tab.id}.${sender.frameId || 0}`]: {
          tabId: sender.tab.id,
          frameId: sender.frameId || 0,
        },
      });
      const profile = await profileStore.get();
      if (message.type === "COUNTS")
        return {
          employment: profile.employment.length,
          education: profile.education.length,
        };
      const fields = message.fields as DetectedField[];
      if (!Array.isArray(fields) || fields.length > 500)
        throw new Error("Too many fields on this page.");
      const resume=fields.some(field=>field.type==='file'&&!field.filled&&isResumeField(field.label))?await resumeStore.get():null;
      let attachment:Awaited<ReturnType<typeof attachmentFor>>|undefined;
      return Promise.all(fields.map(async(field) => {
        if(field.type!=='file'||field.filled||!isResumeField(field.label))return matchField(field,profile);
        if(!resume)return {id:field.id,reason:'Save a resume in ApplyMate or attach one yourself.'};
        if(!acceptsResume(field.accept,resume))return {id:field.id,reason:'The saved resume format is not accepted here. Attach a compatible file.'};
        attachment??=await attachmentFor(resume);
        return {id:field.id,attachment};
      }));
    }
    if (!sender.url?.startsWith(chrome.runtime.getURL("")))
      throw new Error("Use the ApplyMate panel to control applications.");
    if (message.type === "CLEAR_DATA") {
      const targets = await chrome.storage.session.get(null);
      await Promise.allSettled(
        Object.entries(targets)
          .filter(([key]) => key.startsWith("target."))
          .map(([, target]) =>
            chrome.tabs.sendMessage(
              target.tabId,
              { type: "STOP" },
              { frameId: target.frameId },
            ),
          ),
      );
      await chrome.storage.local.clear();
      await resumeStore.clear();
      await chrome.storage.session.clear();
      return { ok: true };
    }
    const tabId = message.tabId as number;
    if (message.type === "CONNECT") {
      const injected = await inject(tabId);
      return injected.map((frame) => ({ frameId: frame.frameId }));
    }
    if (message.type === "FRAME_ORIGINS") {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () =>
          Array.from(document.querySelectorAll("iframe"))
            .map((frame) => frame.src)
            .filter(Boolean),
      });
      return Array.from(
        new Set(
          (results[0]?.result || [])
            .filter((url) => /^https?:/.test(url))
            .map((url) => `${new URL(url).origin}/*`),
        ),
      );
    }
    if (message.type === "COMMAND")
      return chrome.tabs.sendMessage(
        tabId,
        { type: message.command },
        { frameId: message.frameId || 0 },
      );
    throw new Error("Unknown request.");
  }
  void handle()
    .then(respond)
    .catch((error) => respond({ error: error.message }));
  return true;
});
