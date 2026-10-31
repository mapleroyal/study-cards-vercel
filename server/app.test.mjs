import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApplication } from "./app.mjs";
import { createSessionCookie } from "./auth.mjs";
import { createSourceService } from "./sources.mjs";
import { createLoginLimiter } from "./login-rate-limit.mjs";
import { createTestStore } from "./test-helpers/store.mjs";

// The injected runtime below exercises real PostgreSQL library and rate-limit
// adapters without loading Workflow or connecting to paid services.
vi.mock("./runtime.mjs", () => ({ getRuntime: vi.fn() }));

const resources = [];
beforeEach(() => {
  vi.stubEnv(
    "APP_SECRET",
    "test-session-secret-more-than-thirty-two-characters",
  );
  vi.stubEnv("APP_PASSWORD", "test-owner-password");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_only");
});
afterEach(async () => {
  for (const { server, store } of resources.splice(0)) {
    await new Promise((resolve) => server.close(resolve));
    await store.close();
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function fixture({ consumeError } = {}) {
  const store = createTestStore();
  await store.initialize();
  const loginLimiter = await createLoginLimiter(store.pool);
  if (consumeError) {
    vi.spyOn(loginLimiter, "consume").mockRejectedValue(consumeError);
  }
  const blob = {
    get: vi.fn(),
    put: vi.fn(),
    head: vi.fn(),
    del: vi.fn(),
  };
  const sources = createSourceService({ store, blob });
  const generation = { router: express.Router() };
  generation.router.get("/", (_req, res) => res.json({ jobs: [] }));
  const settings = {
    read: vi.fn(async () => ({
      openRouterConfigured: false,
      model: "fixture",
    })),
    update: vi.fn(async () => ({
      openRouterConfigured: true,
      model: "fixture",
    })),
  };
  const runtime = vi.fn(async () => ({
    store,
    loginLimiter,
    sources,
    generation,
    settings,
  }));
  const server = createApplication({ runtime }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  resources.push({ server, store });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (
    path,
    { body, method = body === undefined ? "GET" : "POST", headers = {} } = {},
  ) => {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      headers: response.headers,
      data: await response.json(),
    };
  };
  return { request, runtime, store, blob, settings, loginLimiter, origin };
}

it("keeps library, settings, sources and jobs private before runtime initialization", async () => {
  const { request, runtime, settings } = await fixture();
  for (const path of ["/library", "/settings", "/sources", "/generation"]) {
    expect((await request(path)).status).toBe(401);
  }
  expect(
    (
      await request("/sources/upload", {
        body: { type: "blob.generate-client-token", payload: {} },
      })
    ).status,
  ).toBe(401);
  expect(runtime).not.toHaveBeenCalled();
  expect(settings.read).not.toHaveBeenCalled();
  expect((await request("/health")).data.ok).toBe(true);
  expect((await request("/capabilities")).data.authenticated).toBe(false);
});

it("logs in with a private owner cookie, serves the canonical library and clears browser storage on logout", async () => {
  const { request, origin } = await fixture();
  const incorrect = await request("/session", { body: { password: "wrong" } });
  expect(incorrect.status).toBe(401);
  expect(incorrect.headers.get("set-cookie")).toBeNull();
  const login = await request("/session", {
    body: { password: "test-owner-password" },
    headers: { origin },
  });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Strict");
  const headers = { cookie };
  const library = await request("/library", { headers });
  expect(library.status).toBe(200);
  expect(library.data.records).toEqual([]);
  expect(library.headers.get("cache-control")).toBe("no-store");
  expect((await request("/capabilities", { headers })).data.authenticated).toBe(
    true,
  );
  expect((await request("/settings", { headers })).data).toEqual({
    openRouterConfigured: false,
    model: "fixture",
  });
  const logout = await request("/session", { method: "DELETE", headers });
  expect(logout.status).toBe(200);
  expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(logout.headers.get("clear-site-data")).toBe('"cache", "storage"');
});

it("rejects cross-origin mutation attempts and invalidates sessions after password rotation", async () => {
  const { request, runtime } = await fixture();
  const cookie = await createSessionCookie();
  expect(
    (
      await request("/settings", {
        method: "PUT",
        body: { openRouterKey: "fixture" },
        headers: { cookie, origin: "https://another-app.example" },
      })
    ).status,
  ).toBe(403);
  expect(runtime).not.toHaveBeenCalled();
  vi.stubEnv("APP_PASSWORD", "rotated-password");
  expect((await request("/library", { headers: { cookie } })).status).toBe(401);
  expect(runtime).not.toHaveBeenCalled();
});

it("enforces the shared login budget and supplies a retry delay", async () => {
  const { request } = await fixture();
  for (let i = 0; i < 20; i++) {
    expect(
      (await request("/session", { body: { password: "wrong" } })).status,
    ).toBe(401);
  }
  const limited = await request("/session", {
    body: { password: "test-owner-password" },
  });
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(limited.headers.get("set-cookie")).toBeNull();
});

it("fails closed when the shared limiter database is unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { request } = await fixture({
    consumeError: new Error("database fixture unavailable"),
  });
  const response = await request("/session", {
    body: { password: "test-owner-password" },
  });
  expect(response.status).toBe(503);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.data.error).not.toContain("database fixture");
});

it("requires the Blob SDK signature on the only unauthenticated source callback", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { request, store, blob } = await fixture();
  const response = await request("/sources/upload", {
    body: {
      type: "blob.upload-completed",
      payload: {
        tokenPayload: JSON.stringify({ sourceId: "forged" }),
        blob: { url: "https://forged.example/file.pdf" },
      },
    },
  });
  expect(response.status).toBe(500);
  expect(await store.listRecords("sources")).toEqual([]);
  expect(blob.del).not.toHaveBeenCalled();
  expect(blob.head).not.toHaveBeenCalled();
});
