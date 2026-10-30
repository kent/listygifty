import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

if (!process.env.CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const phone = {
  ...devices["Desktop Chrome"],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
};

const shared = { dependencies: ["setup"], testMatch: /(journeys|paths)\/.*\.spec\.ts/ };

// One shared local database, so every journey runs alone and in order.
export default defineConfig({
  testDir: ".",
  outputDir: "../test-results/ux-audit",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    timezoneId: "America/Toronto",
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "setup", testDir: "../e2e", testMatch: /global\.setup\.ts/ },
    { name: "desktop-festive", ...shared, use: desktop, metadata: { theme: "festive" } },
    { name: "desktop-apple", ...shared, use: desktop, metadata: { theme: "apple" } },
    { name: "mobile-festive", ...shared, use: phone, metadata: { theme: "festive" } },
    { name: "mobile-apple", ...shared, use: phone, metadata: { theme: "apple" } },
  ],
});
