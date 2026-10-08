import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests run against the production build served by `vite preview`, or against an already deployed
 * site when SMOKE_BASE_URL is set (the deploy workflow uses this to check the live page).
 */
const deployedUrl = process.env["SMOKE_BASE_URL"];
const PREVIEW_PORT = 4173;

export default defineConfig({
  testDir: "tests/smoke",
  timeout: 60_000,
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: deployedUrl ?? `http://localhost:${String(PREVIEW_PORT)}/acid-road/`,
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  ...(deployedUrl === undefined
    ? { webServer: { command: `npx vite preview --port ${String(PREVIEW_PORT)} --strictPort`, port: PREVIEW_PORT, reuseExistingServer: !process.env["CI"] } }
    : {}),
});
