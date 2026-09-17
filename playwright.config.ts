import { defineConfig } from "@playwright/test";
import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(".cache/browsers");
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  outputDir: "test-results",
});
