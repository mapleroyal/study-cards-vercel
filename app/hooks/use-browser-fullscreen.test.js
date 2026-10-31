import { describe, expect, it, vi } from "vitest";

import {
  exitBrowserFullscreen,
  getFullscreenElement,
  getFullscreenTarget,
  isBrowserFullscreenSupported,
  requestBrowserFullscreen,
} from "./use-browser-fullscreen";

describe("browser fullscreen helpers", () => {
  it("detects standard fullscreen support", () => {
    const documentElement = {
      requestFullscreen: vi.fn(),
    };
    const documentRef = {
      documentElement,
      fullscreenEnabled: true,
      exitFullscreen: vi.fn(),
    };

    expect(isBrowserFullscreenSupported(documentRef)).toBe(true);
  });

  it("detects webkit-prefixed fullscreen support", () => {
    const documentElement = {
      webkitRequestFullscreen: vi.fn(),
    };
    const documentRef = {
      documentElement,
      webkitFullscreenEnabled: true,
      webkitExitFullscreen: vi.fn(),
    };

    expect(isBrowserFullscreenSupported(documentRef)).toBe(true);
  });

  it("does not report support when the document disables fullscreen", () => {
    const documentElement = {
      requestFullscreen: vi.fn(),
    };
    const documentRef = {
      documentElement,
      fullscreenEnabled: false,
      exitFullscreen: vi.fn(),
    };

    expect(isBrowserFullscreenSupported(documentRef)).toBe(false);
  });

  it("requests standard fullscreen with hidden browser navigation UI", async () => {
    const requestFullscreen = vi.fn();
    const elementRef = {
      requestFullscreen,
    };

    await requestBrowserFullscreen(elementRef);

    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("requests prefixed fullscreen without unsupported options", async () => {
    const webkitRequestFullscreen = vi.fn();
    const elementRef = {
      webkitRequestFullscreen,
    };

    await requestBrowserFullscreen(elementRef);

    expect(webkitRequestFullscreen).toHaveBeenCalledWith();
  });

  it("exits fullscreen through the available document API", async () => {
    const exitFullscreen = vi.fn();
    const documentRef = {
      exitFullscreen,
    };

    await exitBrowserFullscreen(documentRef);

    expect(exitFullscreen).toHaveBeenCalledWith();
  });

  it("reads standard and prefixed fullscreen elements", () => {
    const standardElement = {};
    const prefixedElement = {};

    expect(getFullscreenElement({ fullscreenElement: standardElement })).toBe(
      standardElement,
    );
    expect(
      getFullscreenElement({ webkitFullscreenElement: prefixedElement }),
    ).toBe(prefixedElement);
  });

  it("uses the document element as the fullscreen target", () => {
    const documentElement = {};

    expect(getFullscreenTarget({ documentElement })).toBe(documentElement);
  });
});
