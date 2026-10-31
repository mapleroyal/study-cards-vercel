const SERVICE_WORKER_PATH = "/service-worker.js";
const SERVICE_WORKER_OPTIONS = { updateViaCache: "none" };
const CACHE_URLS_MESSAGE_TYPE = "CACHE_URLS";

export function getLoadedAppAssetUrls({
  documentRef = globalThis.document,
  locationRef = globalThis.location,
} = {}) {
  if (
    typeof documentRef?.querySelectorAll !== "function" ||
    !locationRef?.origin
  ) {
    return [];
  }

  const baseUrl = locationRef.href ?? `${locationRef.origin}/`;
  const urls = new Set();
  const elements = documentRef.querySelectorAll(
    'script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]',
  );

  for (const element of elements) {
    const attribute = element.localName === "script" ? "src" : "href";
    const value = element.getAttribute?.(attribute);

    if (!value) {
      continue;
    }

    try {
      const url = new URL(value, baseUrl);

      if (
        url.origin === locationRef.origin &&
        url.pathname !== SERVICE_WORKER_PATH
      ) {
        urls.add(`${url.pathname}${url.search}`);
      }
    } catch {
      // Ignore malformed resource URLs rather than failing registration.
    }
  }

  return [...urls];
}

function requestLoadedAssetCaching({ navigatorRef, windowRef, registration }) {
  const urls = getLoadedAppAssetUrls({
    documentRef: windowRef.document,
    locationRef: windowRef.location,
  });

  const location = windowRef.location;
  if (location?.pathname && location.pathname !== "/login") {
    urls.push(`${location.pathname}${location.search || ""}`);
  }
  if (!urls.length) {
    return;
  }

  Promise.resolve(navigatorRef.serviceWorker.ready ?? registration)
    .then((readyRegistration) => {
      const worker =
        readyRegistration?.active ??
        registration?.active ??
        navigatorRef.serviceWorker.controller;

      worker?.postMessage?.({
        type: CACHE_URLS_MESSAGE_TYPE,
        urls,
      });
    })
    .catch(() => {
      // Cache warming is best-effort.
    });
}

export function registerLuminaServiceWorker({
  navigatorRef = globalThis?.navigator,
  windowRef = globalThis?.window,
} = {}) {
  if (
    !navigatorRef?.serviceWorker ||
    !windowRef ||
    windowRef.location?.protocol === "file:"
  ) {
    return false;
  }

  const registerServiceWorker = () => {
    try {
      Promise.resolve(
        navigatorRef.serviceWorker.register(
          SERVICE_WORKER_PATH,
          SERVICE_WORKER_OPTIONS,
        ),
      )
        .then((registration) => {
          requestLoadedAssetCaching({ navigatorRef, windowRef, registration });
        })
        .catch(() => {
          // Registration is best-effort; the app remains usable without it.
        });
    } catch {
      // Registration is best-effort; the app remains usable without it.
    }
  };

  if (windowRef.document?.readyState === "complete") {
    registerServiceWorker();
  } else if (typeof windowRef.addEventListener === "function") {
    windowRef.addEventListener("load", registerServiceWorker, { once: true });
  } else {
    registerServiceWorker();
  }

  return true;
}
