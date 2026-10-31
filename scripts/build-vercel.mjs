import { execFileSync } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, NITRO_PRESET: "vercel" },
});
// React Router reads its client manifest from build/client during SSR compilation.
// Nitro writes Vercel functions/config directly to the standard Build Output API path.
cpSync("build/client", ".vercel/output/static", { recursive: true });
const config = JSON.parse(readFileSync(".vercel/output/config.json", "utf8"));
if (config.version !== 3) {
  throw new Error("Vercel build output is missing.");
}

// Keep Workflow's generated maxDuration: "max" and queue-trigger configuration.
