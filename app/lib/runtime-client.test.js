import { afterEach, beforeEach, expect, it, vi } from "vitest";

let fetchRequest;
beforeEach(() => {
  vi.resetModules();
  const values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  fetchRequest = vi.fn();
  vi.stubGlobal("fetch", fetchRequest);
});
afterEach(() => vi.unstubAllGlobals());

it("retries uncertain capabilities on reconnect and shares the in-flight discovery", async () => {
  fetchRequest.mockResolvedValueOnce(
    globalThis.Response.json({ error: "Unavailable" }, { status: 503 }),
  );
  const { getCapabilities } = await import("./runtime-client");
  expect(await getCapabilities()).toMatchObject({ server: true });
  expect(await getCapabilities()).toMatchObject({ server: true });
  expect(fetchRequest).toHaveBeenCalledTimes(1);
  fetchRequest.mockResolvedValueOnce(
    globalThis.Response.json({ server: true, agent: true }),
  );
  const reconnect = getCapabilities({ refresh: true });
  expect(getCapabilities({ refresh: true })).toBe(reconnect);
  expect(await reconnect).toMatchObject({ server: true, agent: true });
  expect(await getCapabilities()).toMatchObject({ server: true });
  expect(fetchRequest).toHaveBeenCalledTimes(2);
});

it("keeps known server capabilities available offline", async () => {
  globalThis.localStorage.setItem(
    "lumina.server-capabilities",
    JSON.stringify({ server: true, agent: true }),
  );
  fetchRequest.mockRejectedValueOnce(new TypeError("Offline"));
  const { getCapabilities } = await import("./runtime-client");
  expect(await getCapabilities()).toMatchObject({ server: true });
});

it("keeps server storage and retries a temporarily missing API", async () => {
  fetchRequest.mockResolvedValueOnce(
    new globalThis.Response("Not found", { status: 404 }),
  );
  const { getCapabilities } = await import("./runtime-client");
  expect(await getCapabilities()).toMatchObject({ server: true });
  fetchRequest.mockResolvedValueOnce(
    globalThis.Response.json({ server: true, authenticated: true }),
  );
  expect(await getCapabilities({ refresh: true })).toMatchObject({
    server: true,
    authenticated: true,
  });
  expect(fetchRequest).toHaveBeenCalledTimes(2);
});

it("retries an HTML login response after authentication recovers", async () => {
  fetchRequest.mockResolvedValueOnce(
    new globalThis.Response("<html>Sign in</html>", {
      headers: { "Content-Type": "text/html" },
    }),
  );
  const { getCapabilities } = await import("./runtime-client");
  expect(await getCapabilities()).toMatchObject({ server: true });
  fetchRequest.mockResolvedValueOnce(
    globalThis.Response.json({ server: true }),
  );
  expect(await getCapabilities({ refresh: true })).toMatchObject({
    server: true,
  });
  expect(fetchRequest).toHaveBeenCalledTimes(2);
});
