import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("keeps the first and last warmed resources available offline beyond 100 entries", async () => {
  const origin = "https://study.example";
  const listeners = new Map();
  const entries = new Map();
  let offline = false;
  const cache = {
    keys: async () =>
      [...entries.keys()].map((url) => new globalThis.Request(url)),
    delete: async (request) =>
      entries.delete(
        typeof request === "string"
          ? new URL(request, origin).href
          : request.url,
      ),
    put: async (request, response) => {
      entries.set(request.url, response.clone());
    },
    match: async (request) =>
      entries
        .get(
          typeof request === "string"
            ? new URL(request, origin).href
            : request.url,
        )
        ?.clone(),
  };
  const NativeRequest = globalThis.Request;
  runInNewContext(
    readFileSync(
      new URL("../public/service-worker.js", import.meta.url),
      "utf8",
    ),
    {
      URL,
      Response: globalThis.Response,
      Request: class extends NativeRequest {
        constructor(url, options) {
          super(new URL(url, origin), options);
        }
      },
      caches: { open: async () => cache },
      fetch: async (request) => {
        if (offline) {
          throw new TypeError("Offline");
        }
        return new globalThis.Response(request.url);
      },
      self: {
        location: { origin },
        addEventListener: (name, listener) => listeners.set(name, listener),
      },
    },
  );
  const urls = [
    "/sets/first",
    ...Array.from({ length: 104 }, (_, index) => `/assets/${index}.js`),
  ];
  let warming;
  listeners.get("message")({
    data: { type: "CACHE_URLS", urls },
    waitUntil: (promise) => {
      warming = promise;
    },
  });
  await warming;
  offline = true;
  for (const path of [urls[0], urls.at(-1)]) {
    let response;
    listeners.get("fetch")({
      request: {
        url: new URL(path, origin).href,
        method: "GET",
        mode: path.startsWith("/sets/") ? "navigate" : "cors",
        destination: "script",
      },
      respondWith: (promise) => {
        response = promise;
      },
      waitUntil() {},
    });
    expect((await response).status).toBe(200);
    expect(await (await response).text()).toBe(new URL(path, origin).href);
  }
});
