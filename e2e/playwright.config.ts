import { defineConfig, devices } from "@playwright/test";

// The harness boots a real ReviewSX inbox (port 4500) + a static server that
// serves a sample prototype with the built overlay (port 5500). Tests drive the
// overlay UI in a real browser and assert feedback lands in the inbox.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5500",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://localhost:5500/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
