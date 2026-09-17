import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      input: { options: "options.html", sidepanel: "sidepanel.html" },
    },
  },
  test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts"] },
});
