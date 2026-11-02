import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const excludedDirectories = new Set([
  ".git",
  ".vercel",
  ".local",
  ".data",
  ".nitro",
  ".swc",
  "node_modules",
  "work",
  "build",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
  ".react-router",
  ".ui-build",
  ".foundation-build",
  ".shared-ui-build",
  ".vite",
  ".vite-child-compiler",
]);

export function isFixtureSourcePath(relative) {
  const parts = relative.split("/");
  return (
    Boolean(relative) &&
    !path.isAbsolute(relative) &&
    !parts.some(
      (part) =>
        part === ".." ||
        excludedDirectories.has(part) ||
        part.startsWith(".env") ||
        part === ".npmrc",
    )
  );
}

export function createFixtureEnvironment(inherited, snapshot, commit) {
  // Deliberately exclude NODE_OPTIONS, DATABASE_URL, Blob/OpenRouter/OIDC tokens,
  // Vercel variables, npm credentials and any caller-provided remote test origin.
  const environment = {};
  for (const key of [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "TERM",
  ]) {
    if (inherited[key]) {
      environment[key] = inherited[key];
    }
  }
  environment.PATH = [
    path.join(snapshot, "node_modules", ".bin"),
    path.dirname(process.execPath),
    environment.PATH || "/usr/bin:/bin",
  ].join(path.delimiter);
  return {
    ...environment,
    CI: "1",
    LUMINA_TEST_FIXTURES: "1",
    LUMINA_TEST_ROOT: snapshot,
    GIT_CEILING_DIRECTORIES: path.dirname(snapshot),
    GITHUB_SHA: commit,
    NPM_CONFIG_USERCONFIG: path.join(snapshot, "work", "empty-npmrc"),
    NPM_CONFIG_GLOBALCONFIG: path.join(snapshot, "work", "empty-global-npmrc"),
    APP_PASSWORD: "playwright-test-owner",
    APP_SECRET: "playwright-only-secret-at-least-thirty-two-characters",
    PLAYWRIGHT_APP_PASSWORD: "playwright-test-owner",
  };
}

export async function copyFixtureSource(root, snapshot, files) {
  const digest = createHash("sha256");
  let count = 0;
  for (const relative of [...new Set(files)].sort()) {
    if (!isFixtureSourcePath(relative)) {
      continue;
    }
    const source = path.join(root, relative);
    let info;
    try {
      info = await lstat(source);
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      } // A tracked file deleted in this change.
      throw error;
    }
    for (
      let current = source;
      current !== root;
      current = path.dirname(current)
    ) {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(
          `Fixture source cannot contain symbolic links: ${relative}`,
        );
      }
    }
    if (!info.isFile()) {
      throw new Error(`Fixture source must be a regular file: ${relative}`);
    }
    const bytes = await readFile(source);
    digest.update(relative).update("\0").update(bytes).update("\0");
    const target = path.join(snapshot, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: info.mode });
    count++;
  }
  return { files: count, sha256: digest.digest("hex") };
}

export async function allocateLoopbackPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => {
    probe.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  return port;
}

async function main() {
  const args = process.argv.slice(2);
  const separator = args.indexOf("--");
  const options = args.slice(0, separator);
  const command = args.slice(separator + 1);
  if (
    separator < 0 ||
    !command.length ||
    options.some((option) => !["--database", "--serve"].includes(option))
  ) {
    throw new Error(
      "Usage: node scripts/test-environment.mjs [--database] [--serve] -- command [args]",
    );
  }
  if (options.includes("--serve") && !options.includes("--database")) {
    throw new Error(
      "--serve requires --database for the hosted fixture server.",
    );
  }
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const snapshot = path.join(repository, "work", "test-snapshots", runId);
  const artifacts = path.join(repository, "work", "modernization", runId);
  await mkdir(path.join(snapshot, "work"), { recursive: true });
  await mkdir(artifacts, { recursive: true });
  await writeFile(path.join(snapshot, "work", "empty-npmrc"), "");
  await writeFile(path.join(snapshot, "work", "empty-global-npmrc"), "");
  const tracked = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  )
    .split("\0")
    .filter(Boolean);
  const identity = await copyFixtureSource(repository, snapshot, tracked);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  await symlink(
    path.join(repository, "node_modules"),
    path.join(snapshot, "node_modules"),
    "dir",
  );
  const environment = createFixtureEnvironment(process.env, snapshot, commit);
  const log = createWriteStream(path.join(artifacts, "run.log"));
  const groups = new Set();
  const docker = [
    ...(environment.PATH || "")
      .split(path.delimiter)
      .map((directory) => path.join(directory, "docker")),
    "/Applications/Docker.app/Contents/Resources/bin/docker",
  ].find((candidate) => existsSync(candidate));
  let container;
  let interrupted = false;
  let result = 1;
  const announce = (message) => {
    process.stdout.write(`${message}\n`);
    log.write(`${message}\n`);
  };
  const execute = (
    executable,
    parameters,
    { capture = false, background = false } = {},
  ) => {
    const child = spawn(executable, parameters, {
      cwd: snapshot,
      env: environment,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (child.pid) {
      groups.add(child.pid);
    }
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      log.write(chunk);
      if (!capture) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on("data", (chunk) => {
      log.write(chunk);
      if (!capture) {
        process.stderr.write(chunk);
      }
    });
    const completion = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => {
        groups.delete(child.pid);
        if (capture && code !== 0) {
          reject(
            new Error(
              `${executable} failed (${code ?? signal}). See fixture run.log.`,
            ),
          );
        } else {
          resolve({ code: code ?? 1, output, signal });
        }
      });
    });
    // Background failures are checked through child.exitCode and readiness.
    if (background) {
      completion.catch(() => {});
    }
    return { child, completion };
  };
  const dockerCommand = async (...parameters) =>
    (
      await execute(docker, parameters, {
        capture: true,
      }).completion
    ).output.trim();
  const stopGroups = (signal = "SIGTERM") => {
    for (const pid of groups) {
      try {
        process.kill(-pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") {
          throw error;
        }
      }
    }
  };
  let interruptDeadline;
  const interrupt = () => {
    if (interrupted) {
      return;
    }
    interrupted = true;
    // Playwright owns detached webServer groups and tears them down on SIGINT.
    // Forwarding SIGTERM bypasses that cleanup and leaves fixture listeners alive.
    stopGroups("SIGINT");
    interruptDeadline = globalThis.setTimeout(
      () => stopGroups("SIGKILL"),
      10000,
    );
    interruptDeadline.unref();
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const description = {
    runId,
    commit,
    source: identity,
    command,
    snapshot,
    artifacts,
    database: options.includes("--database"),
  };
  await writeFile(
    path.join(artifacts, "run.json"),
    `${JSON.stringify(description, null, 2)}\n`,
  );
  await writeFile(
    path.join(repository, "work", "modernization", "latest.json"),
    `${JSON.stringify({ runId, artifacts }, null, 2)}\n`,
  );
  announce(
    `Fixture snapshot ${runId} (${identity.files} source files, ${identity.sha256.slice(0, 12)})`,
  );
  announce(`Artifacts: ${artifacts}`);
  try {
    if (options.includes("--database")) {
      if (!docker) {
        throw new Error(
          "Docker is required for disposable hosted database checks.",
        );
      }
      // Docker Desktop keeps its credential helper beside the CLI binary.
      environment.PATH = [path.dirname(docker), environment.PATH].join(
        path.delimiter,
      );
      const endpoint = await dockerCommand(
        "context",
        "inspect",
        "--format",
        "{{.Endpoints.docker.Host}}",
      );
      if (!endpoint.startsWith("unix://") && !endpoint.startsWith("npipe://")) {
        throw new Error(
          "Fixture databases require a local Docker socket context.",
        );
      }
      container = `lumina-fixture-${randomUUID().slice(0, 12)}`;
      description.container = container;
      await writeFile(
        path.join(artifacts, "run.json"),
        `${JSON.stringify(description, null, 2)}\n`,
      );
      await dockerCommand(
        "run",
        "--detach",
        "--rm",
        "--name",
        container,
        "--publish",
        "127.0.0.1::5432",
        "--tmpfs",
        "/var/lib/postgresql:rw",
        "--env",
        "POSTGRES_USER=lumina_test",
        "--env",
        "POSTGRES_PASSWORD=lumina_fixture_password",
        "--env",
        "POSTGRES_DB=lumina_test",
        "postgres:18.6",
      );
      const databaseEndpoint = await dockerCommand(
        "port",
        container,
        "5432/tcp",
      );
      if (!/^127\.0\.0\.1:\d+$/.test(databaseEndpoint)) {
        throw new Error(
          "Fixture database was not published exclusively on loopback.",
        );
      }
      let ready = false;
      for (let attempt = 0; attempt < 60 && !interrupted; attempt++) {
        try {
          await dockerCommand(
            "exec",
            container,
            "pg_isready",
            "-U",
            "lumina_test",
            "-d",
            "lumina_test",
          );
          ready = true;
          break;
        } catch {
          await delay(500);
        }
      }
      if (!ready) {
        throw new Error("Disposable fixture database did not become ready.");
      }
      environment.DATABASE_URL = `postgresql://lumina_test:lumina_fixture_password@${databaseEndpoint}/lumina_test`;
      announce("Disposable PostgreSQL 18.6 is ready on loopback.");
    }
    if (options.includes("--serve")) {
      const build = await execute("npm", ["run", "build"]).completion;
      if (build.code !== 0) {
        throw new Error("Fixture server build failed.");
      }
      environment.PORT = String(await allocateLoopbackPort());
      environment.HOST = "127.0.0.1";
      environment.PLAYWRIGHT_BASE_URL = `http://127.0.0.1:${environment.PORT}`;
      const server = execute(process.execPath, ["build/server/index.mjs"], {
        background: true,
      });
      let ready = false;
      for (let attempt = 0; attempt < 120 && !interrupted; attempt++) {
        if (server.child.exitCode !== null) {
          throw new Error("Fixture server exited before readiness.");
        }
        try {
          const response = await fetch(
            `${environment.PLAYWRIGHT_BASE_URL}/login`,
            { signal: globalThis.AbortSignal.timeout(1000) },
          );
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {
          /* Wait for the owned process to bind. */
        }
        await delay(250);
      }
      if (!ready) {
        throw new Error("Fixture server did not become ready.");
      }
    }
    if (interrupted) {
      throw new Error("Fixture run interrupted.");
    }
    result = (await execute(command[0], command.slice(1)).completion).code;
  } finally {
    globalThis.clearTimeout(interruptDeadline);
    stopGroups();
    await delay(100);
    stopGroups("SIGKILL");
    if (container) {
      try {
        await dockerCommand("rm", "--force", container);
      } catch {
        announce(`Fixture container cleanup failed; remove only ${container}.`);
        result = result || 1;
      }
    }
    for (const [relative, name] of [
      ["test-results", "test-results"],
      ["playwright-report", "playwright-report"],
      ["coverage", "coverage"],
      ["build", "build"],
      [".vercel/output", "vercel-output"],
      [".shared-ui-build", "shared-ui-build"],
      ["work", "work"],
    ]) {
      const source = path.join(snapshot, relative);
      try {
        await lstat(source);
        await cp(source, path.join(artifacts, name), {
          recursive: true,
          dereference: false,
        });
      } catch (error) {
        if (error.code !== "ENOENT") {
          announce(`Could not collect artifact ${relative}: ${error.message}`);
          result = result || 1;
        }
      }
    }
    await writeFile(
      path.join(artifacts, "result.json"),
      `${JSON.stringify({ exitCode: interrupted ? 130 : result }, null, 2)}\n`,
    );
    if (interrupted) {
      process.exitCode = 130;
    }
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    await new Promise((resolve) => log.end(resolve));
  }
  process.exitCode = interrupted ? 130 : result;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode ||= 1;
  });
}
