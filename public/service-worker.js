/* global Request, Response, caches, self */

const CACHE_PREFIX = "lumina-app-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const MAX_CACHE_ENTRIES = 100;
const APP_SHELL_URLS = [
  "/",
  "/favicon.svg",
  "/site.webmanifest",
  "/theme-init.js",
];
const NETWORK_ONLY_PATHS = new Set([
  "/build-info.json",
  "/service-worker.js",
  "/login",
]);
const RUNTIME_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

function isCacheable(response) {
  return (
    response?.status === 200 &&
    response.type !== "opaque" &&
    !response.redirected &&
    (!response.url || new URL(response.url).pathname !== "/login")
  );
}

async function trimCache(cache) {
  const keys = await cache.keys();

  if (keys.length <= MAX_CACHE_ENTRIES) {
    return;
  }

  const protectedPaths = new Set(APP_SHELL_URLS);
  const removableKeys = keys.filter(
    (request) => !protectedPaths.has(new URL(request.url).pathname),
  );
  const overflow = keys.length - MAX_CACHE_ENTRIES;

  await Promise.all(
    removableKeys.slice(0, overflow).map((request) => cache.delete(request)),
  );
}

async function cacheResponse(cache, request, response) {
  if (!isCacheable(response)) {
    return;
  }

  try {
    await cache.put(request, response.clone());
    await trimCache(cache);
  } catch {
    // Cache quota or storage failures must never hide a valid network response.
  }
}

async function warmAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    APP_SHELL_URLS.map(async (url) => {
      try {
        const request = new Request(url, { cache: "reload" });
        const response = await fetch(request);

        await cacheResponse(cache, request, response);
      } catch {
        // One unavailable resource must not prevent the worker from installing.
      }
    }),
  );
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    await cacheResponse(cache, request, response);
    return response;
  } catch (networkError) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackUrl) {
      const fallbackResponse = await cache.match(fallbackUrl);

      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    throw networkError;
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      await cacheResponse(cache, request, response);
      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    event.waitUntil(networkResponsePromise);
    return cachedResponse;
  }

  return (await networkResponsePromise) ?? Response.error();
}

async function cacheRequestedUrls(urls) {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    urls.slice(0, MAX_CACHE_ENTRIES).map(async (value) => {
      try {
        const url = new URL(value, self.location.origin);

        if (
          url.origin !== self.location.origin ||
          NETWORK_ONLY_PATHS.has(url.pathname) ||
          url.pathname.startsWith("/api/")
        ) {
          return;
        }

        const request = new Request(url.href, { cache: "reload" });
        const response = await fetch(request);

        await cacheResponse(cache, request, response);
      } catch {
        // Runtime cache warming is best-effort.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([warmAppShell(), self.skipWaiting()]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) {
    return;
  }

  event.waitUntil(cacheRequestedUrls(event.data.urls));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    NETWORK_ONLY_PATHS.has(url.pathname) ||
    url.pathname.startsWith("/api/")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (RUNTIME_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
