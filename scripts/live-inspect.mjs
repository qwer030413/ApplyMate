import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".cache/browsers");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu", "--disable-features=CDPScreenshotNewSurface"],
});
const urls = [
  "https://job-boards.greenhouse.io/clear/jobs/8043865",
  "https://job-boards.greenhouse.io/jobcorpsandbox/jobs/5829867002",
  "https://jobs.smartrecruiters.com/ServiceNow/744000149338366-software-engineer",
  "https://jobs.smartrecruiters.com/Experian/744000143860629-software-engineer-i",
  "https://kbr.wd5.myworkdayjobs.com/en-US/KBR_Careers/job/Software-Engineer_R2114022",
  "https://finastra.wd3.myworkdayjobs.com/en-US/FINC/job/Software-Engineer_REQ0326_0036639",
];
const results = [];
try {
  for (const url of urls) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        fields: Array.from(
          document.querySelectorAll(
            "input:not([type=hidden]),select,textarea,[role=combobox]",
          ),
        ).map((el) => ({
          label:
            el.getAttribute("aria-label") ||
            Array.from(el.labels || [])
              .map((l) => l.textContent)
              .join(" ") ||
            el.getAttribute("placeholder") ||
            el.getAttribute("name"),
          type: el.type || el.getAttribute("role"),
          automation: el.getAttribute("data-automation-id"),
          visible: !!el.getClientRects().length,
        })),
        actions: Array.from(document.querySelectorAll("button,a"))
          .map((e) => ({
            text: e.textContent?.trim().slice(0, 80),
            href: e.getAttribute("href"),
          }))
          .filter((e) => /apply|continue/i.test(e.text || "")),
      }));
      results.push({ requested: url, ...info });
      console.log(
        JSON.stringify({
          url,
          title: info.title,
          fields: info.fields.length,
          actions: info.actions,
        }),
      );
    } catch (error) {
      results.push({ requested: url, error: error.message });
      console.log(JSON.stringify({ url, error: error.message }));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/live-inspection.json",
    JSON.stringify(results, null, 2),
  );
}
