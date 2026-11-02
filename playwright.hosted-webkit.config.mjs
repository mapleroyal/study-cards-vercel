import { defineConfig } from "@playwright/test";
import product from "./playwright.config.mjs";

export default defineConfig({
  ...product,
  outputDir: "./test-results/hosted-webkit",
  testMatch: "**/hosted-flow.pw.mjs",
  testIgnore: ["**/foundation.pw.mjs"],
  use: {
    ...product.use,
    browserName: "webkit",
    launchOptions: {},
  },
});
