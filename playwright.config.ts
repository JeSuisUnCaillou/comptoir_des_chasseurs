import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Same environment as the app (.env.local in development, real env vars in CI).
loadEnvConfig(process.cwd());

// When BASE_URL is set (e.g. a Vercel deployment), tests run against it.
// Otherwise a local production build is started.
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

// e2e/fake-discord.mjs
const FAKE_DISCORD = "http://localhost:3999";

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
    : [
        // A fake Discord, for signing in with Discord (e2e/discord.spec.ts).
        {
          command: "node e2e/fake-discord.mjs",
          url: `${FAKE_DISCORD}/health`,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: "npm run start",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          env: {
            DISCORD_CLIENT_ID: "comptoir-e2e",
            DISCORD_CLIENT_SECRET: "comptoir-e2e-secret",
            DISCORD_AUTHORIZE_URL: `${FAKE_DISCORD}/oauth2/authorize`,
            DISCORD_API_URL: `${FAKE_DISCORD}/api`,
          },
        },
      ],
});
