import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { nitro } from "nitro/vite";
import { workflow } from "workflow/vite";
import { getAppVersion } from "./scripts/app-version.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildTime = new Date().toISOString();
const appVersion = getAppVersion();
const buildInfo = {
  appVersion,
  buildId: [getBuildCommitId(), buildTime].join(":"),
  buildTime,
};

function firstNonEmpty(...values) {
  return values
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}

function getBuildCommitId() {
  return (
    firstNonEmpty(
      process.env.VERCEL_GIT_COMMIT_SHA,
      process.env.CF_PAGES_COMMIT_SHA,
      process.env.RENDER_GIT_COMMIT,
      process.env.GITHUB_SHA,
    ) ?? "local"
  );
}

function luminaBuildInfoPlugin() {
  const source = `${JSON.stringify(buildInfo, null, 2)}\n`;

  return {
    name: "lumina-build-info",
    configureServer(server) {
      server.middlewares.use("/build-info.json", (_, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store, max-age=0");
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source,
      });
    },
  };
}

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.git/**", "tests/ui/**"],
  },
  define: {
    "import.meta.env.VITE_LUMINA_APP_VERSION": JSON.stringify(appVersion),
    "import.meta.env.VITE_LUMINA_BUILD_ID": JSON.stringify(buildInfo.buildId),
  },
  plugins: [
    luminaBuildInfoPlugin(),
    devtoolsJson(),
    reactRouter(),
    nitro({
      serverDir: "./server",
      vercel: { functions: { maxDuration: "max" } },
      ...(process.env.NITRO_PRESET === "vercel"
        ? { output: { publicDir: "build/client" } }
        : {
            output: {
              dir: "build",
              serverDir: "build/server",
              publicDir: "build/client",
            },
          }),
      routeRules: { "/api/**": { headers: { "cache-control": "no-store" } } },
    }),
    workflow({ dirs: ["workflows"] }),
    tailwindcss(),
  ],
  environments: {
    ssr: { build: { rollupOptions: { input: "./server/ssr.ts" } } },
  },
  server: { host: "127.0.0.1" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
  },
});
