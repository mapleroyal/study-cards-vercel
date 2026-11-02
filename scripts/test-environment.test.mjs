import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import {
  allocateLoopbackPort,
  copyFixtureSource,
  createFixtureEnvironment,
  isFixtureSourcePath,
} from "./test-environment.mjs";

describe("fixture isolation", () => {
  it("excludes dotenv, hosted metadata, private runtime and generated inputs", () => {
    for (const file of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.example",
      "server/.env",
      ".vercel/project.json",
      ".local/state",
      "work/secret",
      "node_modules/pkg/a.js",
      "../outside",
      "/absolute",
      ".npmrc",
    ]) {
      expect(isFixtureSourcePath(file)).toBe(false);
    }
    expect(isFixtureSourcePath("app/routes/generate.jsx")).toBe(true);
  });
  it("allows only host tooling variables and generates fixture-only service settings", () => {
    const environment = createFixtureEnvironment(
      {
        PATH: "/usr/bin",
        HOME: "/fixture-user",
        DATABASE_URL: "private-db",
        OPENROUTER_API_KEY: "private-key",
        BLOB_READ_WRITE_TOKEN: "private-token",
        VERCEL_OIDC_TOKEN: "private-oidc",
        NODE_OPTIONS: "--import private",
        PLAYWRIGHT_BASE_URL: "https://production.example",
        APP_SECRET: "private-secret",
      },
      "/fixture/snapshot",
      "abc",
    );
    expect(environment).not.toHaveProperty("DATABASE_URL");
    expect(environment).not.toHaveProperty("OPENROUTER_API_KEY");
    expect(environment).not.toHaveProperty("BLOB_READ_WRITE_TOKEN");
    expect(environment).not.toHaveProperty("VERCEL_OIDC_TOKEN");
    expect(environment).not.toHaveProperty("NODE_OPTIONS");
    expect(environment).not.toHaveProperty("PLAYWRIGHT_BASE_URL");
    expect(environment.APP_SECRET).not.toBe("private-secret");
    expect(environment.LUMINA_TEST_FIXTURES).toBe("1");
  });
  it("copies real source bytes, ignores deleted files, and refuses symlinks", async () => {
    await mkdir("work", { recursive: true });
    const root = await mkdtemp(path.resolve("work/isolation-contract-"));
    const snapshot = `${root}-snapshot`;
    try {
      await mkdir(snapshot);
      await writeFile(
        path.join(root, "source.js"),
        "export const fixture = true;",
      );
      await writeFile(path.join(root, ".env.local"), "PRIVATE=must-not-copy");
      const result = await copyFixtureSource(root, snapshot, [
        "source.js",
        ".env.local",
        "deleted.js",
      ]);
      expect(result.files).toBe(1);
      expect(await readFile(path.join(snapshot, "source.js"), "utf8")).toBe(
        "export const fixture = true;",
      );
      await expect(
        readFile(path.join(snapshot, ".env.local")),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await symlink(path.join(root, "source.js"), path.join(root, "link.js"));
      await expect(
        copyFixtureSource(root, snapshot, ["link.js"]),
      ).rejects.toThrow("symbolic links");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(snapshot, { recursive: true, force: true });
    }
  });
  it("allocates an unused loopback port without reusing an active listener", async () => {
    const occupied = createServer();
    await new Promise((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    try {
      const port = await allocateLoopbackPort();
      expect(port).toBeGreaterThan(0);
      expect(port).not.toBe(occupied.address().port);
      const claimed = createServer();
      await new Promise((resolve, reject) => {
        claimed.once("error", reject);
        claimed.listen(port, "127.0.0.1", resolve);
      });
      await new Promise((resolve) => claimed.close(resolve));
    } finally {
      await new Promise((resolve) => occupied.close(resolve));
    }
  });
});
