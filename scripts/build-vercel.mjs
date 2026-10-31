import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";

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

// Workflow defaults to the plan maximum. Keep a consistent five-minute ceiling
// even on larger plans; the initial provider request and repair share 240 seconds.
const flowConfigPath =
  ".vercel/output/functions/.well-known/workflow/v1/flow.func/.vc-config.json";
const flowConfig = JSON.parse(readFileSync(flowConfigPath, "utf8"));
flowConfig.maxDuration = 300;
writeFileSync(flowConfigPath, `${JSON.stringify(flowConfig, null, 2)}\n`);
