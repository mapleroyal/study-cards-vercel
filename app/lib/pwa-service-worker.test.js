import { describe, expect, it, vi } from "vitest";

import {
  getLoadedAppAssetUrls,
  registerLuminaServiceWorker,
} from "./pwa-service-worker";

function createAssetElement(localName, attributes) {
  return {
    localName,
    getAttribute: (name) => attributes[name] ?? null,
  };
}

function createNavigatorRef() {
  return {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("registerLuminaServiceWorker", () => {
  it("registers immediately when the load event already fired", () => {
    const navigatorRef = createNavigatorRef();
    const windowRef = {
      document: { readyState: "complete" },
      location: { protocol: "https:" },
      addEventListener: vi.fn(),
    };

    expect(registerLuminaServiceWorker({ navigatorRef, windowRef })).toBe(true);
    expect(navigatorRef.serviceWorker.register).toHaveBeenCalledWith(
      "/service-worker.js",
      { updateViaCache: "none" },
    );
    expect(windowRef.addEventListener).not.toHaveBeenCalled();
  });

  it("waits for load when the page is still loading", () => {
    const navigatorRef = createNavigatorRef();
    const windowRef = {
      document: { readyState: "loading" },
      location: { protocol: "https:" },
      addEventListener: vi.fn(),
    };

    expect(registerLuminaServiceWorker({ navigatorRef, windowRef })).toBe(true);
    expect(navigatorRef.serviceWorker.register).not.toHaveBeenCalled();
    expect(windowRef.addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      { once: true },
    );

    const loadHandler = windowRef.addEventListener.mock.calls[0][1];
    loadHandler();

    expect(navigatorRef.serviceWorker.register).toHaveBeenCalledWith(
      "/service-worker.js",
      { updateViaCache: "none" },
    );
  });

  it("caches loaded assets and the current SSR document for first-visit offline reload", async () => {
    const worker = { postMessage: vi.fn() };
    const registration = { active: worker };
    const navigatorRef = {
      serviceWorker: {
        ready: Promise.resolve(registration),
        register: vi.fn().mockResolvedValue(registration),
      },
    };
    const windowRef = {
      document: {
        readyState: "complete",
        querySelectorAll: vi
          .fn()
          .mockReturnValue([
            createAssetElement("script", { src: "/assets/app.js?v=1" }),
            createAssetElement("link", { href: "/assets/app.css" }),
            createAssetElement("link", { href: "/assets/route.js" }),
          ]),
      },
      location: {
        href: "https://lumina.example/sets/biology",
        pathname: "/sets/biology",
        search: "",
        origin: "https://lumina.example",
        protocol: "https:",
      },
    };

    registerLuminaServiceWorker({ navigatorRef, windowRef });

    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: "CACHE_URLS",
        urls: [
          "/assets/app.js?v=1",
          "/assets/app.css",
          "/assets/route.js",
          "/sets/biology",
        ],
      });
    });
  });

  it("does not register without service worker support or over file protocol", () => {
    expect(
      registerLuminaServiceWorker({
        navigatorRef: {},
        windowRef: { location: { protocol: "https:" } },
      }),
    ).toBe(false);
    expect(
      registerLuminaServiceWorker({
        navigatorRef: createNavigatorRef(),
        windowRef: { location: { protocol: "file:" } },
      }),
    ).toBe(false);
  });
});

describe("getLoadedAppAssetUrls", () => {
  it("deduplicates same-origin app assets and rejects other origins", () => {
    const elements = [
      createAssetElement("script", { src: "/assets/app.js" }),
      createAssetElement("script", {
        src: "https://lumina.example/assets/app.js",
      }),
      createAssetElement("link", { href: "styles/app.css" }),
      createAssetElement("link", { href: "/assets/route.js" }),
      createAssetElement("script", {
        src: "https://third-party.example/analytics.js",
      }),
      createAssetElement("script", { src: "/service-worker.js" }),
    ];

    expect(
      getLoadedAppAssetUrls({
        documentRef: { querySelectorAll: () => elements },
        locationRef: {
          href: "https://lumina.example/sets/biology",
          origin: "https://lumina.example",
        },
      }),
    ).toEqual(["/assets/app.js", "/sets/styles/app.css", "/assets/route.js"]);
  });
});
