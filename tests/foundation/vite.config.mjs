import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));

// A separate entry point keeps the component gallery out of application routes.
export default defineConfig({
  root: directory,
  envDir: false,
  cacheDir: path.resolve(directory, "../../.vite/foundation"),
  plugins: [tailwindcss()],
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(directory, "../../app") } },
  build: {
    outDir: path.resolve(directory, "../../.foundation-build"),
    emptyOutDir: true,
    // The fixture intentionally includes every wrapper in one client-only bundle.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
  preview: { host: "127.0.0.1", port: 4181, strictPort: true },
  server: { host: "127.0.0.1", port: 4181, strictPort: true },
});
