import { createAdapter, visible } from "./adapters";
import type { ApplicationRun, FieldAssignment } from "../shared/types";

declare global {
  interface Window {
    __applymate?: boolean;
  }
}
if (!window.__applymate) {
  window.__applymate = true;
  const adapter = createAdapter();
  let generation = 0,
    busy = false;
  const run: ApplicationRun = {
    status: "idle",
    platform: adapter.platform,
    step: 0,
    message: "Ready to inspect this application.",
    result: { filled: [], preserved: [], unresolved: [] },
    documentId: crypto.randomUUID(),
  };
  const signatures = new Set<string>();
  const signature = () =>
    JSON.stringify(
      adapter
        .inspect()
        .fields.map((f) => [f.label, f.section, f.index, f.type]),
    );
  const pause = (message: string) => {
    run.status = "paused";
    run.message = message;
  };
  async function execute(assisted: boolean) {
    if (busy) return;
    busy = true;
    const token = ++generation;
    const cancelled = () => generation !== token;
    run.status = "running";
    run.message = "Matching saved information to this page.";
    if (!assisted) signatures.clear();
    try {
      for (let count = 0; count < 20 && !cancelled(); count++) {
        const counts = await chrome.runtime.sendMessage({ type: "COUNTS" });
        if (cancelled()) break;
        await adapter.prepare(counts, cancelled);
        if (cancelled()) break;
        const scan = adapter.inspect();
        if (!scan.fields.length) {
          if (scan.final) {
            run.status = "review";
            run.message =
              "Ready for final review. Submit the application yourself.";
          } else pause("No editable application fields found in this frame.");
          break;
        }
        if (scan.fields.some((field) => field.type === "password")) {
          pause("Complete sign-in, then resume.");
          break;
        }
        const assignments = (await chrome.runtime.sendMessage({
          type: "RESOLVE",
          fields: scan.fields,
        })) as FieldAssignment[];
        if (cancelled()) break;
        if (!Array.isArray(assignments))
          throw new Error(
            "Could not read the saved profile. Reopen the editor and check your data.",
          );
        run.result = await adapter.fill(assignments, cancelled);
        if (cancelled()) break;
        run.step++;
        if (!assisted) {
          run.status = "idle";
          run.message = "Page filled. Review the results before continuing.";
          break;
        }
        if (adapter.platform === "generic") {
          pause(
            "Automatic navigation is available only on supported platforms.",
          );
          break;
        }
        if(run.result.attached?.length){pause('Resume attached. Review the site\'s upload status, then resume.');break;}
        const after = adapter.inspect();
        const unresolved = run.result.unresolved;
        if (unresolved.length || after.blockers.length) {
          pause("Review the remaining fields, then resume.");
          break;
        }
        if (adapter.validation().length) {
          pause(adapter.validation().join(" "));
          break;
        }
        if (after.final) {
          run.status = "review";
          run.message =
            "Ready for your final review. ApplyMate will not submit this application.";
          break;
        }
        const next = adapter.next();
        if (!next) {
          pause(
            "No unambiguous next step found. Continue manually, then resume.",
          );
          break;
        }
        // Required native constraints must pass before an intermediate action can run.
        const invalid = Array.from(
          document.querySelectorAll<HTMLInputElement>("input,select,textarea"),
        )
          .filter(visible)
          .some((el) => !el.checkValidity());
        if (invalid) {
          pause("Complete the fields highlighted by the application.");
          break;
        }
        const before = signature();
        if (signatures.has(before)) {
          pause("This step was already visited. Continue manually.");
          break;
        }
        signatures.add(before);
        if (cancelled()) break;
        run.message = "Moving to the next application step.";
        next.click();
        let changed = false;
        for (let wait = 0; wait < 32 && !cancelled(); wait++) {
          await new Promise((r) => setTimeout(r, 250));
          if (signature() !== before) {
            changed = true;
            break;
          }
          if (adapter.validation().length) break;
        }
        if (cancelled()) break;
        if (!changed) {
          pause(
            "The page did not advance. Check its messages and continue manually.",
          );
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      if (run.status === "running" && !cancelled())
        pause("Step limit reached. Review the application before resuming.");
    } catch (error) {
      if (!cancelled())
        pause(
          error instanceof Error
            ? error.message
            : "The connection was lost. Rescan and resume.",
        );
    } finally {
      busy = false;
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "SCAN") {
      respond({ ...run, scan: adapter.inspect(), busy });
      return;
    }
    if (message.type === "PAUSE" || message.type === "STOP") {
      generation++;
      run.status = message.type === "STOP" ? "stopped" : "paused";
      run.message =
        message.type === "STOP"
          ? "Stopped. No further actions will run."
          : "Paused. Review the page before resuming.";
      if (message.type === "STOP") signatures.clear();
      respond(run);
      return;
    }
    if (message.type === "FILL" || message.type === "START") {
      if (!busy) {
        void execute(message.type === "START");
      }
      respond({ accepted: !busy || run.status === "running" });
    }
  });
}
