import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  envDir: false,
  cacheDir: fileURLToPath(new URL("./.vite/vitest", import.meta.url)),
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./app", import.meta.url)) } },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "tests/ui/**",
      "tests/shared-ui/**",
      "tests/foundation/**",
      "work/**",
      ".shared-ui-build/**",
      ".foundation-build/**",
      ".ui-build/**",
      "build/**",
      ".vercel/**",
    ],
  },
});
