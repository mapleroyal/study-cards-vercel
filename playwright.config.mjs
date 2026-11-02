import { defineConfig } from "@playwright/test";

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!remoteBaseURL && process.env.LUMINA_TEST_FIXTURES !== "1") {
  throw new Error(
    "Use npm run test:ui so local hosted checks run in an isolated fixture snapshot.",
  );
}

export default defineConfig({
  outputDir: "./test-results/product",
  testDir: "./tests/ui",
  testMatch: "**/*.pw.mjs",
  testIgnore: remoteBaseURL ? ["**/foundation.pw.mjs"] : [],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remoteBaseURL || "http://127.0.0.1:4180",
    ...(process.env.PLAYWRIGHT_STORAGE_STATE
      ? { storageState: process.env.PLAYWRIGHT_STORAGE_STATE }
      : {}),
    browserName: "chromium",
    serviceWorkers: "block",
    launchOptions: {
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
      use: {
        colorScheme: "light",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "dark-narrow",
      use: {
        colorScheme: "dark",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: remoteBaseURL
    ? undefined
    : [
        {
          command: "npm run build && node build/server/index.mjs",
          env: {
            PORT: "4180",
            HOST: "127.0.0.1",
            APP_PASSWORD: "playwright-test-owner",
            APP_SECRET: "playwright-only-secret-at-least-thirty-two-characters",
          },
          url: "http://127.0.0.1:4180",
          timeout: 120000,
          reuseExistingServer: false,
        },
        {
          command: "npm run ui:foundation",
          url: "http://127.0.0.1:4181",
          timeout: 120000,
          reuseExistingServer: false,
        },
      ],
});
