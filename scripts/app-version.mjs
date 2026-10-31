import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
// Full-history local builds derive minor from Git. Source builds without full
// history use the package release version and commit identity instead.
const appVersionBaseCommitCount = 45;

function firstNonEmpty(...values) {
  return values
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}

function getPackageVersion() {
  const packageJson = JSON.parse(
    readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );

  return packageJson.version;
}

function getGitCommitCount() {
  try {
    const shallow = execFileSync(
      "git",
      ["rev-parse", "--is-shallow-repository"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    if (shallow === "true") {
      return null;
    }

    const count = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return Number.parseInt(count, 10);
  } catch {
    return null;
  }
}

function getBuildCommitId() {
  const vercelCommit = firstNonEmpty(process.env.VERCEL_GIT_COMMIT_SHA);

  if (vercelCommit && /^[a-f\d]{40}$/i.test(vercelCommit)) {
    return vercelCommit.slice(0, 12);
  }

  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function getAppVersion() {
  const explicitVersion = firstNonEmpty(
    process.env.LUMINA_APP_VERSION,
    process.env.VITE_LUMINA_APP_VERSION,
  );

  if (explicitVersion) {
    return explicitVersion;
  }

  const packageVersion = getPackageVersion();
  const [, major, , patch] =
    packageVersion.match(/^(\d+)\.(\d+)\.(\d+)$/) ?? [];
  const commitCount = getGitCommitCount();

  if (
    major === undefined ||
    patch === undefined ||
    !Number.isFinite(commitCount)
  ) {
    const commitId = getBuildCommitId();

    return commitId ? `${packageVersion}+${commitId}` : packageVersion;
  }

  const minor = Math.max(0, commitCount - appVersionBaseCommitCount);

  return `${major}.${minor}.${patch}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(`${getAppVersion()}\n`);
}
