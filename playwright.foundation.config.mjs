import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "./test-results/foundation",
  testDir: "./tests/shared-ui",
  // Keep browser tests out of Vitest's default *.test/ *.spec discovery.
  testMatch: "**/*.pw.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4182",
    browserName: "chromium",
    launchOptions: {
      // Native overflow styling is part of the shared UI contract.
      ignoreDefaultArgs: ["--hide-scrollbars"],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "light-desktop",
      use: { colorScheme: "light", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "dark-desktop",
      use: { colorScheme: "dark", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "light-narrow",
      use: { colorScheme: "light", viewport: { width: 390, height: 844 } },
    },
    {
      name: "dark-narrow",
      use: { colorScheme: "dark", viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run foundation:build && npm run foundation:preview",
    url: "http://127.0.0.1:4182",
    reuseExistingServer: false,
  },
});
