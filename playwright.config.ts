import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Same environment as the app (.env.local in development, real env vars in CI).
loadEnvConfig(process.cwd());

// When BASE_URL is set (e.g. a Vercel deployment), tests run against it.
// Otherwise a local production build is started.
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.apres\.spec\.ts$/ },
    // Tests that change what every page of the shop shows (a shop-wide setting)
    // run once the others are done, so they never see it half-changed.
    {
      name: "apres",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /\.apres\.spec\.ts$/,
      dependencies: ["chromium"],
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
