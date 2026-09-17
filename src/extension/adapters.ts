import type {
  DetectedField,
  FieldAssignment,
  FillResult,
  PageScan,
  Platform,
} from "../shared/types";
import { explicitAnswerKey, normalize, sensitive } from "../shared/matching";
import { platformDefinitions } from "./platforms";
import { isResumeField, acceptsResume, type ResumeAttachment } from '../shared/resume-file';
type Control =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement;
const controlSelector =
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]),select,textarea,[role=combobox],[aria-haspopup=listbox]";
export const visible = (element: Element) =>
  !!(
    Array.from(element.getClientRects()).some(
      (rect) => rect.width > 0 && rect.height > 0,
    ) &&
    getComputedStyle(element).visibility !== "hidden" &&
    !element.closest('[hidden],[aria-hidden="true"],[inert]')
  );
export function labelFor(el: Control): string {
  const labelled = (el.getAttribute("aria-labelledby") || "")
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent || "")
    .join(" ")
    .trim();
  const labels =
    "labels" in el && el.labels
      ? Array.from(el.labels)
          .map((l) => l.textContent || "")
          .join(" ")
      : "";
  const placeholder = el.getAttribute("placeholder");
  const name = el
    .getAttribute("name")
    ?.replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ");
  const container = el.closest(
    '.field,.form-group,[data-automation-id^="formField-"]',
  );
  const nearby = container?.querySelector("label")?.textContent;
  const automation = el
    .getAttribute("data-automation-id")
    ?.replace(/([a-z])([A-Z])/g, "$1 $2");
  return (
    el.getAttribute("aria-label") ||
    labelled ||
    labels ||
    nearby ||
    placeholder ||
    name ||
    automation ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
function uploadScope(input:HTMLInputElement):Element {
  let node=input.parentElement;
  for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
    if(node.querySelectorAll('input[type=file]').length!==1)break;
    if(isResumeField(node.textContent||'')||node.matches('.field,.form-group,[data-automation-id^="formField"],[data-testid*="upload"]'))return node;
  }
  return input.parentElement||input;
}
function uploadLabel(input:HTMLInputElement):string {
  const direct=labelFor(input);
  if(isResumeField(direct)||/cover.?letter|transcript|portfolio/i.test(direct))return direct;
  const scope=uploadScope(input);
  const text=[direct,input.name,input.id,scope.querySelector('label,legend,h2,h3,h4')?.textContent,scope.textContent?.slice(0,700)].filter(Boolean).join(' ');
  return isResumeField(text)?'Resume / CV':direct;
}
function hasAttachment(input:HTMLInputElement):boolean {
  if(input.files?.length)return true;
  const scope=uploadScope(input);
  const named=scope.querySelector('[data-automation-id="fileName"],[data-testid="file-name"],[data-file-name],.file-name,a[download]');
  if(named&&visible(named)&&named.textContent?.trim())return true;
  return Array.from(scope.querySelectorAll('button,[role=button]')).some(button=>visible(button)&&/remove|delete/i.test(button.textContent||button.getAttribute('aria-label')||''))&&/\S+\.(pdf|docx?)\b/i.test(scope.textContent||'');
}
async function attachResume(input:HTMLInputElement,attachment:ResumeAttachment,cancelled:()=>boolean):Promise<boolean> {
  if(cancelled()||hasAttachment(input)||!isResumeField(uploadLabel(input))||!acceptsResume(input.accept,attachment))return false;
  const scope=uploadScope(input);
  const bytes=Uint8Array.from(atob(attachment.base64),char=>char.charCodeAt(0));
  if(bytes.byteLength!==attachment.size)throw new Error('Invalid resume data.');
  const transfer=new DataTransfer();transfer.items.add(new File([bytes],attachment.name,{type:attachment.type}));
  if(cancelled())return false;
  input.files=transfer.files;
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,400));
  if(cancelled())return false;
  if(input.getAttribute('aria-invalid')==='true'||Array.from(scope.querySelectorAll('[role=alert],.field-error')).some(el=>visible(el)&&el.textContent?.trim()))return false;
  return (input.isConnected&&input.files?.[0]?.name===attachment.name)||(scope.isConnected&&!!scope.textContent?.includes(attachment.name));
}
function fieldSection(el: Control): { section: string; index: number } {
  const selector =
    '[data-automation-id^="workExperience"],[data-automation-id^="education"],[data-test="experience"],[data-test="education"],.work-experience,.education-entry,[data-section],fieldset';
  const description = (group: Element) =>
    group.getAttribute("data-section") ||
    group.getAttribute("data-automation-id") ||
    group.getAttribute("data-test") ||
    group.querySelector("legend,h2,h3,h4")?.textContent ||
    (group.classList.contains("work-experience")
      ? "employment"
      : group.classList.contains("education-entry")
        ? "education"
        : "");
  const category = (group: Element) =>
    /educat/i.test(description(group))
      ? "education"
      : /work.?experience|work history|employment|experience/i.test(
            description(group),
          )
        ? "employment"
        : "";
  let group = el.closest(selector);
  while (group && !category(group))
    group = group.parentElement?.closest(selector) || null;
  let section = group ? description(group) : "";
  if (!section) {
    const parent = el.closest("section");
    section =
      parent?.getAttribute("aria-label") ||
      parent?.querySelector("h2,h3")?.textContent ||
      "";
  }
  const kind = /educat/i.test(section)
    ? "education"
    : /work.?experience|work history|employment|experience/i.test(section)
      ? "employment"
      : "";
  if (!kind) return { section, index: 0 };
  const groups = Array.from(document.querySelectorAll(selector)).filter((g) => {
    const text = description(g);
    return (
      (kind === "education"
        ? /educat/i
        : /work.?experience|work history|employment|experience/i
      ).test(text) &&
      visible(g) &&
      g.querySelector(controlSelector) &&
      !Array.from(g.querySelectorAll(selector)).some(
        (child) => category(child) === kind,
      )
    );
  });
  return { section: kind, index: Math.max(0, groups.indexOf(group!)) };
}
export function detectPlatform(host = location.hostname): Platform {
  if (/(^|\.)greenhouse\.io$/.test(host)) return "greenhouse";
  if (/(^|\.)smartrecruiters\.com$/.test(host)) return "smartrecruiters";
  if (/(^|\.)(myworkdayjobs|myworkdaysite)\.com$/.test(host)) return "workday";
  return "generic";
}
export interface PlatformAdapter {
  platform: Platform;
  inspect(): PageScan;
  fill(
    assignments: FieldAssignment[],
    cancelled: () => boolean,
  ): Promise<FillResult>;
  validation(): string[];
  next(): HTMLElement | null;
  prepare(
    counts: { employment: number; education: number },
    cancelled: () => boolean,
  ): Promise<void>;
}
export function createAdapter(
  platform: Platform = detectPlatform(),
): PlatformAdapter {
  const definition = platformDefinitions[platform];
  const elements = new Map<string, Control>();
  const ids = new WeakMap<Element, string>();
  let sequence = 0;
  const validation = () =>
    Array.from(
      document.querySelectorAll(
        '[aria-invalid="true"],[role="alert"],.field-error,[data-automation-id="errorMessage"]',
      ),
    )
      .filter(visible)
      .map((el) =>
        el.getAttribute("aria-invalid") === "true"
          ? `Check ${labelFor(el as Control) || "the highlighted field"}.`
          : (el.textContent || "").trim(),
      )
      .filter(Boolean);
  function inspect(): PageScan {
    elements.clear();
    const radioNames = new Set<string>();
    const fields: DetectedField[] = [];
    for (const el of Array.from(
      document.querySelectorAll<Control>(controlSelector),
    )) {
      if (
        !(visible(el)||(el instanceof HTMLInputElement&&el.type==='file'&&visible(uploadScope(el))&&isResumeField(uploadLabel(el)))) ||
        el.hasAttribute("disabled") ||
        el.hasAttribute("readonly") ||
        el.getAttribute("aria-disabled") === "true"
      )
        continue;
      if (el.getAttribute("role") === "combobox" && el.querySelector("input"))
        continue;
      const input = el as HTMLInputElement;
      if (input.type === "radio" && input.name) {
        if (radioNames.has(input.name)) continue;
        radioNames.add(input.name);
      }
      let id = ids.get(el);
      if (!id) {
        id = `field-${++sequence}`;
        ids.set(el, id);
      }
      elements.set(id, el);
      let label = input.type==='file'?uploadLabel(input):labelFor(el);
      let options: string[] = [];
      let filled = false;
      if(input.type==='file')filled=hasAttachment(input);
      else if (input.type === "radio") {
        const radios = Array.from(
          document.querySelectorAll<HTMLInputElement>("input[type=radio]"),
        ).filter((r) => r.name === input.name && visible(r));
        options = radios.map(labelFor);
        filled = radios.some((r) => r.checked);
        label =
          el.closest("fieldset")?.querySelector("legend")?.textContent ||
          el.closest("[role=radiogroup]")?.getAttribute("aria-label") ||
          label;
      } else if (el instanceof HTMLSelectElement) {
        options = Array.from(el.options)
          .filter((o) => o.value)
          .map((o) => o.text);
        filled =
          !!el.value &&
          !/^(select|choose|please select)/i.test(
            el.selectedOptions[0]?.text || "",
          );
      } else if (input.type === "checkbox") filled = input.checked;
      else if (
        el.getAttribute("role") === "combobox" ||
        el.getAttribute("aria-haspopup") === "listbox"
      ) {
        const value =
          "value" in el
            ? String(el.value).trim()
            : (el.getAttribute("data-value") || el.textContent || "").trim();
        filled =
          !!value && !/^(select|choose|please select|search)/i.test(value);
      } else
        filled = !!("value" in el
          ? String(el.value).trim()
          : el.getAttribute("data-value"));
      fields.push({
        id,
        label: label.trim(),
        ...fieldSection(el),
        type: input.type || el.getAttribute("role") || "text",
        required:
          el.hasAttribute("required") ||
          el.getAttribute("aria-required") === "true",
        filled,
        options,
        ...(input.type==='file'?{accept:input.accept}:{}),
      });
    }
    const blockers: string[] = [];
    if (fields.some((f) => f.type === "password"))
      blockers.push("Complete sign-in, then resume.");
    if (
      Array.from(
        document.querySelectorAll(
          'iframe[src*="recaptcha"],iframe[src*="hcaptcha"],[data-sitekey]',
        ),
      ).some(visible)
    )
      blockers.push("Complete the verification challenge, then resume.");
    if (fields.some((f) => f.type === "file" && !f.filled && f.required))
      blockers.push("Attach the required document, then resume.");
    return { platform, fields, blockers, final: isFinal() };
  }
  function isFinal() {
    return (
      Array.from(document.querySelectorAll("h1,h2,h3"))
        .filter(visible)
        .some((el) =>
          /^(review( your application| application| and submit)?|application review)$/i.test(
            el.textContent?.trim() || "",
          ),
        ) ||
      Array.from(
        document.querySelectorAll("button,input[type=submit],[role=button]"),
      )
        .filter(visible)
        .some((el) =>
          /^(submit( application)?|send application|finish|complete application|apply( now)?)$/i.test(
            buttonText(el),
          ),
        )
    );
  }
  function next(): HTMLElement | null {
    if (platform === "generic") return null;
    const allowed: Record<Exclude<Platform, "generic">, RegExp> = {
      greenhouse: /^(next|continue|save and continue)$/i,
      smartrecruiters: /^(next|continue|save and continue)$/i,
      workday: /^(next|continue|save and continue)$/i,
    };
    const preferred = definition.nextSelector
      ? Array.from(
          document.querySelectorAll<HTMLElement>(definition.nextSelector),
        )
      : [];
    const buttons = preferred.length
      ? preferred
      : Array.from(
          document.querySelectorAll<HTMLElement>(
            "button,input[type=button],input[type=submit],[role=button]",
          ),
        );
    const candidates = buttons.filter(
      (el) =>
        visible(el) &&
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-disabled") !== "true" &&
        allowed[platform].test(buttonText(el)) &&
        !/submit|finish|complete/.test(el.getAttribute("formaction") || ""),
    );
    return candidates.length === 1 ? candidates[0] : null;
  }
  async function fill(
    assignments: FieldAssignment[],
    cancelled: () => boolean,
  ): Promise<FillResult> {
    const result: FillResult = { filled: [], preserved: [], unresolved: [] };
    const scan = inspect();
    for (const field of scan.fields) {
      if (cancelled()) break;
      const el = elements.get(field.id)!;
      if (!el.isConnected) {
        result.unresolved.push({
          label: field.label,
          reason: "The form changed. Rescan this page.",
        });
        continue;
      }
      if (field.filled) {
        result.preserved.push(field.label);
        continue;
      }
      const assignment = assignments.find((a) => a.id === field.id);
      if(field.type==='file'&&assignment?.attachment&&el instanceof HTMLInputElement){
        try {const success=await attachResume(el,assignment.attachment,cancelled);if(cancelled())break;
          if(success){result.filled.push(field.label);(result.attached??=[]).push(assignment.attachment.name);}
          else result.unresolved.push({label:field.label,reason:'The site did not confirm the resume attachment. Check the upload or attach it manually.'});
        }catch{result.unresolved.push({label:field.label,reason:'This uploader needs manual attachment.'});}
        continue;
      }
      if (
        !assignment?.value ||
        (sensitive(field.label) && !explicitAnswerKey(normalize(field.label))) ||
        ["file", "password"].includes(field.type)
      ) {
        result.unresolved.push({
          label: field.label || "Unlabeled field",
          reason: assignment?.reason || "Review this field yourself.",
        });
        continue;
      }
      try {
        const success = await setControl(el, assignment.value, cancelled);
        if (cancelled()) break;
        if (success) result.filled.push(field.label);
        else
          result.unresolved.push({
            label: field.label,
            reason: "No exact option match or the page rejected the value.",
          });
      } catch {
        result.unresolved.push({
          label: field.label,
          reason: "This control needs manual entry.",
        });
      }
    }
    return result;
  }
  async function prepare(
    counts: { employment: number; education: number },
    cancelled: () => boolean,
  ) {
    if (platform === "generic") return;
    for (const kind of ["employment", "education"] as const) {
      for (
        let attempts = 0;
        attempts < Math.min(counts[kind], 20) && !cancelled();
        attempts++
      ) {
        const scan = inspect();
        const existing = scan.fields.filter((f) => f.section === kind);
        const total = existing.length
          ? Math.max(...existing.map((f) => f.index)) + 1
          : 0;
        if (total >= counts[kind]) break;
        const scopes = Array.from(
          document.querySelectorAll(
            kind === "employment"
              ? definition.workSelector
              : definition.educationSelector,
          ),
        );
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>("button,[role=button]"),
        ).filter((el) => {
          if (!visible(el) || el.hasAttribute("disabled")) return false;
          const text = buttonText(el);
          if (
            (kind === "employment"
              ? /^add (work experience|experience|employment)$/i
              : /^add education$/i
            ).test(text)
          )
            return true;
          return (
            /^add( another)?$/i.test(text) &&
            scopes.some((scope) => scope.contains(el)) &&
            new RegExp(
              kind === "employment"
                ? "work.?experience|employment"
                : "education",
              "i",
            ).test(el.closest("section,fieldset")?.textContent || "")
          );
        });
        if (candidates.length !== 1) break;
        candidates[0].click();
        await delay(250);
        if (cancelled()) return;
        if (
          inspect().fields.filter((f) => f.section === kind).length <=
          existing.length
        )
          break;
      }
    }
  }
  return { platform, inspect, fill, validation, next, prepare };
}
function buttonText(el: Element) {
  return (
    el instanceof HTMLInputElement
      ? el.value
      : el.textContent || el.getAttribute("aria-label") || ""
  )
    .trim()
    .replace(/\s+/g, " ");
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function emit(el: HTMLElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}
async function setControl(
  el: Control,
  value: string,
  cancelled: () => boolean,
): Promise<boolean> {
  if (cancelled()) return false;
  if (el instanceof HTMLSelectElement) {
    const options = Array.from(el.options).filter(
      (o) =>
        !o.disabled &&
        (normalize(o.text) === normalize(value) ||
          normalize(o.value) === normalize(value)),
    );
    if (options.length !== 1) return false;
    el.value = options[0].value;
    emit(el);
    return el.value === options[0].value;
  }
  if (el instanceof HTMLInputElement && el.type === "radio") {
    const matches = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=radio]"),
    ).filter(
      (r) =>
        r.name === el.name &&
        visible(r) &&
        !r.disabled &&
        (normalize(labelFor(r)) === normalize(value) ||
          normalize(r.value) === normalize(value)),
    );
    if (matches.length !== 1) return false;
    matches[0].click();
    return matches[0].checked;
  }
  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    if (!/^(yes|no)$/i.test(value)) return false;
    const checked = value === "Yes";
    if (el.checked !== checked) el.click();
    return el.checked === checked;
  }
  if (
    el.getAttribute("role") === "combobox" ||
    el.getAttribute("aria-haspopup") === "listbox"
  ) {
    el.click();
    await delay(200);
    if (cancelled()) return false;
    const controls =
      el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
    const list = controls ? document.getElementById(controls) : null;
    const roots = list
      ? [list]
      : Array.from(document.querySelectorAll("[role=listbox]")).filter(visible);
    if (roots.length !== 1) return false;
    const options = Array.from(
      roots[0].querySelectorAll<HTMLElement>("[role=option]"),
    ).filter(
      (o) => visible(o) && normalize(o.textContent || "") === normalize(value),
    );
    if (options.length !== 1) {
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return false;
    }
    options[0].click();
    await delay(80);
    return (
      normalize("value" in el ? String(el.value) : el.textContent || "") ===
        normalize(value) || options[0].getAttribute("aria-selected") === "true"
    );
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    let formatted = value;
    if (
      el instanceof HTMLInputElement &&
      el.type === "date" &&
      /^\d{4}-\d{2}$/.test(value)
    )
      return false;
    if (el instanceof HTMLInputElement && el.type === "month")
      formatted = value.slice(0, 7);
    const prototype =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      el,
      formatted,
    );
    emit(el);
    await delay(50);
    return el.value === formatted;
  }
  return false;
}
