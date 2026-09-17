import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
  type Page,
} from "@playwright/test";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyProfile, newEmployment } from "../../src/shared/profile";
import { application } from "../fixtures/application";
import { resumePdf, resumeDocx } from "../fixtures/resumes";
let context: BrowserContext, worker: Worker, extensionId: string;
const profilePath = path.resolve(`.cache/test-profile-${Date.now()}`);
const extensionPath = path.resolve(".cache/test-extension");
async function launch() {
  const browser = await chromium.launchPersistentContext(profilePath, {
    channel: "chromium",
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-features=CDPScreenshotNewSurface",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  return browser;
}
const profile = emptyProfile();
profile.personal = {
  ...profile.personal,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "415-555-0100",
};
profile.employment = [
  { ...newEmployment(), company: "Acme", title: "Engineer" },
  { ...newEmployment(), company: "Previous", title: "Developer" },
];
test.beforeAll(async () => {
  // Test-only host grants replace the toolbar's activeTab gesture in headless Chrome.
  const folder = path.resolve(".cache/test-extension");
  await mkdir(folder, { recursive: true });
  await cp("dist", folder, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(folder, "manifest.json"), "utf8"),
  );
  manifest.host_permissions = [
    "https://boards.greenhouse.io/*",
    "https://jobs.smartrecruiters.com/*",
    "https://acme.wd5.myworkdayjobs.com/*",
    "https://example.test/*",
  ];
  await writeFile(path.join(folder, "manifest.json"), JSON.stringify(manifest));
  context = await launch();
  worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
  await worker.evaluate(
    async (p) => chrome.storage.local.set({ "applymate.profile": p }),
    profile,
  );
});
test.afterAll(async () => {
  await context?.close();
});
async function fixture(host: string, variant = "normal") {
  const page = await context.newPage();
  await page.route(`https://${host}/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: application(host, variant),
    }),
  );
  await page.goto(`https://${host}/application`);
  const id = await worker.evaluate(
    async (url) => (await chrome.tabs.query({ url }))[0].id!,
    page.url(),
  );
  await worker.evaluate(
    async (tabId) =>
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      }),
    id,
  );
  return { page, id };
}
async function command(id: number, type: string) {
  return worker.evaluate(
    async ({ id, type }) => chrome.tabs.sendMessage(id, { type }),
    { id, type },
  );
}
for (const host of [
  "boards.greenhouse.io",
  "jobs.smartrecruiters.com",
  "acme.wd5.myworkdayjobs.com",
])
  test(`assisted run fills and advances on ${host}, never submits`, async () => {
    const { page, id } = await fixture(host);
    await command(id, "START");
    await expect(page.locator("#phone")).toHaveValue("415-555-0100");
    await expect
      .poll(async () => (await command(id, "SCAN")).status)
      .toBe("review");
    expect(
      await page.evaluate(() => ({
        submitted: (window as any).submitted,
        advances: (window as any).advances,
      })),
    ).toEqual({ submitted: 0, advances: 1 });
    await page.close();
  });
test("preserves existing values and fills repeated experience and custom dropdowns", async () => {
  const a = await fixture("boards.greenhouse.io");
  await command(a.id, "FILL");
  await expect(a.page.locator("#first")).toHaveValue("Ada");
  await expect(a.page.locator("#last")).toHaveValue("Existing");
  await a.page.close();
  const b = await fixture("acme.wd5.myworkdayjobs.com", "repeated");
  await command(b.id, "FILL");
  await expect(b.page.getByLabel("Company").nth(0)).toHaveValue("Acme");
  await expect(b.page.getByLabel("Company").nth(1)).toHaveValue("Previous");
  await b.page.close();
  const c = await fixture("jobs.smartrecruiters.com", "custom");
  await command(c.id, "FILL");
  await expect(c.page.locator("#country")).toHaveText("United States");
  await c.page.close();
});
for (const variant of ["sensitive", "upload", "unknown"])
  test(`pauses for ${variant} without advancing`, async () => {
    const { page, id } = await fixture("boards.greenhouse.io", variant);
    await command(id, "START");
    await expect
      .poll(async () => (await command(id, "SCAN")).status)
      .toBe("paused");
    expect(await page.evaluate(() => (window as any).advances)).toBe(0);
    if (variant === "sensitive")
      await expect(page.locator("#consent")).not.toBeChecked();
    await page.close();
  });
test("stops during a fill and refuses automatic navigation on unknown sites", async () => {
  const a = await fixture("boards.greenhouse.io");
  await command(a.id, "START");
  await command(a.id, "STOP");
  await expect
    .poll(async () => (await command(a.id, "SCAN")).status)
    .toBe("stopped");
  await a.page.waitForTimeout(600);
  expect(await a.page.evaluate(() => (window as any).advances)).toBe(0);
  await a.page.close();
  const b = await fixture("example.test");
  await command(b.id, "START");
  await expect
    .poll(async () => (await command(b.id, "SCAN")).status)
    .toBe("paused");
  expect(await b.page.evaluate(() => (window as any).advances)).toBe(0);
  await b.page.close();
});
test("profile editor persists edits, shows responsive layouts, and loads the side panel", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByLabel("First name", { exact: true }).fill("Grace");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page.reload();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
    "Grace",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `test-results/profile-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(
    page.getByRole("heading", { name: "Make your next move." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/sidepanel-360.png",
    fullPage: true,
  });
  await page.close();
  await worker.evaluate(
    async (p) => chrome.storage.local.set({ "applymate.profile": p }),
    profile,
  );
});
test("imports actual PDF and DOCX files locally and rejects blank PDFs", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  for (const [name, mimeType, buffer] of [
    ["resume.pdf", "application/pdf", await resumePdf()],
    [
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      await resumeDocx(),
    ],
  ] as const) {
    await page
      .locator('input[type=file][accept=".pdf,.docx"]')
      .setInputFiles({ name, mimeType, buffer });
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel("Also update my profile from this resume")
      .check();
    await dialog.getByRole("button", { name: "Save resume" }).click();
    dialog = page.getByRole("dialog", { name: "Review resume import" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("First name", { exact: true })).toHaveValue(
      "Ada",
    );
    await expect(
      dialog.getByLabel("Email address", { exact: true }),
    ).toHaveValue("ada@example.com");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.locator('input[type=file][accept=".pdf,.docx"]').setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: await resumePdf(true),
  });
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Also update my profile from this resume").check();
  await dialog.getByRole("button", { name: "Save resume" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No readable resume text",
  );
  await page.close();
});
test("attaches a saved resume to a supported upload field and pauses", async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('input[type=file][accept=".pdf,.docx"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: await resumePdf(),
  });
  await options.getByRole("button", { name: "Save resume" }).click();
  await expect(options.getByRole("status")).toContainText(
    "Resume saved for application uploads",
  );
  await options.close();
  const { page, id } = await fixture("boards.greenhouse.io", "upload");
  await command(id, "START");
  await expect
    .poll(() =>
      page.locator('input[type="file"]').evaluate(
        (input) => (input as HTMLInputElement).files?.[0]?.name || "",
      ),
    )
    .toBe("resume.pdf");
  await expect.poll(async () => (await command(id, "SCAN")).status).toBe(
    "paused",
  );
  expect((await command(id, "SCAN")).message).toContain("Resume attached");
  await page.close();
});
test("pauses a stalled transition and cannot click Next twice", async () => {
  const { page, id } = await fixture("acme.wd5.myworkdayjobs.com", "nochange");
  await command(id, "START");
  await expect
    .poll(async () => (await command(id, "SCAN")).status, { timeout: 15000 })
    .toBe("paused");
  expect(await page.evaluate(() => (window as any).advances)).toBe(1);
  await command(id, "START");
  await expect
    .poll(async () => (await command(id, "SCAN")).status)
    .toBe("paused");
  expect(await page.evaluate(() => (window as any).advances)).toBe(1);
  await page.close();
});
test("reload drops an active run and requires an explicit start", async () => {
  const { page, id } = await fixture("acme.wd5.myworkdayjobs.com", "nochange");
  await command(id, "START");
  await expect
    .poll(async () => page.evaluate(() => (window as any).advances))
    .toBe(1);
  await page.reload();
  await worker.evaluate(
    async (tabId) =>
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      }),
    id,
  );
  expect((await command(id, "SCAN")).status).toBe("idle");
  expect(await page.evaluate(() => (window as any).advances)).toBe(0);
  await page.close();
});
test("fills an explicitly selected embedded frame without touching the parent", async () => {
  const page = await context.newPage();
  await page.route("https://example.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<h1>Company careers</h1><input aria-label="First name" id="parent"><iframe src="https://boards.greenhouse.io/embed" style="width:800px;height:600px"></iframe>',
    }),
  );
  await page.route("https://boards.greenhouse.io/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: application("Greenhouse"),
    }),
  );
  await page.goto("https://example.test/embedded");
  const id = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({ url: "https://example.test/embedded" }))[0]
        .id!,
  );
  const frames = await worker.evaluate(
    async (tabId) =>
      chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["content.js"],
      }),
    id,
  );
  const frameId = frames.find((f) => f.frameId !== 0)!.frameId;
  await worker.evaluate(
    async ({ id, frameId }) =>
      chrome.tabs.sendMessage(id, { type: "FILL" }, { frameId }),
    { id, frameId },
  );
  await expect(page.frameLocator("iframe").locator("#first")).toHaveValue(
    "Ada",
  );
  await expect(page.locator("#parent")).toHaveValue("");
  await page.close();
});
test("persists across browser restarts and supports backup restore and deletion", async () => {
  await context.close();
  context = await launch();
  worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
    "Ada",
  );
  await page.getByRole("button", { name: "Data & settings" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const file = await downloaded;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported).toEqual(profile);
  await page
    .getByRole("button", { name: "Delete all data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete all data" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "All saved data deleted",
  );
  expect(
    await worker.evaluate(async () =>
      Object.keys(await chrome.storage.local.get(null)),
    ),
  ).toEqual([]);
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore backup" })
    .click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page
    .getByRole("button", { name: "Personal details", exact: true })
    .click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
    "Ada",
  );
  await page.close();
});

test("adds missing experience rows without shifting Workday row indexes", async () => {
  const { page, id } = await fixture("acme.wd5.myworkdayjobs.com");
  await page.evaluate(() => {
    document.querySelector("main")!.innerHTML =
      '<section data-automation-id="workExperience"><div data-automation-id="workExperience-1"><label>Company<input></label><label>Job title<input></label></div></section><button id="add" type="button">Add experience</button>';
    document.querySelector("#add")!.addEventListener("click", () => {
      const section = document.querySelector("section")!;
      const row = section.firstElementChild!.cloneNode(true) as HTMLElement;
      row.setAttribute(
        "data-automation-id",
        `workExperience-${section.children.length + 1}`,
      );
      section.appendChild(row);
    });
  });
  await command(id, "FILL");
  await expect(page.getByLabel("Company")).toHaveCount(2);
  await expect(page.getByLabel("Company").nth(0)).toHaveValue("Acme");
  await expect(page.getByLabel("Company").nth(1)).toHaveValue("Previous");
  await page.close();
});
test("fills explicit radio answers and month dates, and pauses native validation", async () => {
  const changed = structuredClone(profile);
  changed.answers.authorizedUS = "Yes";
  changed.employment[0].startDate = "2021-03";
  await worker.evaluate(
    async (p) => chrome.storage.local.set({ "applymate.profile": p }),
    changed,
  );
  const { page, id } = await fixture("boards.greenhouse.io");
  await page.evaluate(() => {
    document.querySelector("main")!.innerHTML =
      '<fieldset><legend>Are you authorized to work in the United States?</legend><label><input type="radio" name="authorized" value="Yes">Yes</label><label><input type="radio" name="authorized" value="No">No</label></fieldset><fieldset data-section="employment"><legend>Work experience</legend><label>Start date<input type="month"></label></fieldset>';
  });
  await command(id, "FILL");
  await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Start date")).toHaveValue("2021-03");
  await page.close();
  await worker.evaluate(
    async (p) => chrome.storage.local.set({ "applymate.profile": p }),
    profile,
  );
  const invalid = await fixture("boards.greenhouse.io");
  await invalid.page
    .locator("#first")
    .evaluate((el) => el.setAttribute("pattern", "Z.*"));
  await command(invalid.id, "START");
  await expect
    .poll(async () => (await command(invalid.id, "SCAN")).status)
    .toBe("paused");
  expect(await invalid.page.evaluate(() => (window as any).advances)).toBe(0);
  await invalid.page.close();
});
test("Pause interrupts pending work and resume must be explicitly requested", async () => {
  const { page, id } = await fixture("boards.greenhouse.io");
  await command(id, "START");
  await command(id, "PAUSE");
  await expect.poll(async () => (await command(id, "SCAN")).busy).toBe(false);
  expect((await command(id, "SCAN")).status).toBe("paused");
  expect(await page.evaluate(() => (window as any).advances)).toBe(0);
  await command(id, "START");
  await expect
    .poll(async () => (await command(id, "SCAN")).status)
    .toBe("review");
  expect(await page.evaluate(() => (window as any).submitted)).toBe(0);
  await page.close();
});
