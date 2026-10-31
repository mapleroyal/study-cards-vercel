import { describe, expect, it, vi } from "vitest";

import {
  canRefreshApp,
  checkForAppUpdate,
  fetchBuildInfo,
  isAppUpdateAvailable,
  normalizeBuildInfo,
  refreshApp,
} from "./app-update";

describe("app update helpers", () => {
  it("normalizes valid build info and rejects invalid values", () => {
    expect(normalizeBuildInfo({ buildId: " latest " })).toMatchObject({
      buildId: "latest",
    });
    expect(normalizeBuildInfo({ buildId: "" })).toBeNull();
    expect(normalizeBuildInfo(null)).toBeNull();
  });

  it("detects an available update when the latest build id differs", () => {
    expect(
      isAppUpdateAvailable({
        currentBuildId: "current",
        latestBuildInfo: { buildId: "latest" },
      }),
    ).toBe(true);
    expect(
      isAppUpdateAvailable({
        currentBuildId: "current",
        latestBuildInfo: { buildId: "current" },
      }),
    ).toBe(false);
  });

  it("fetches build info without using browser caches", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ buildId: "latest" }),
    });

    await expect(
      fetchBuildInfo({ fetcher, now: () => 123 }),
    ).resolves.toMatchObject({ buildId: "latest" });
    expect(fetcher).toHaveBeenCalledWith("/build-info.json?v=123", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: undefined,
    });
  });

  it("checks the latest build against the running build", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ buildId: "latest" }),
    });

    await expect(
      checkForAppUpdate({
        currentBuildId: "current",
        fetcher,
        now: () => 123,
      }),
    ).resolves.toMatchObject({
      currentBuildId: "current",
      latestBuildInfo: { buildId: "latest" },
      updateAvailable: true,
    });
  });

  it("refreshes only when the environment exposes location.reload", () => {
    const windowRef = { location: { reload: vi.fn() } };

    expect(canRefreshApp({ windowRef })).toBe(true);
    expect(refreshApp({ windowRef })).toBe(true);
    expect(windowRef.location.reload).toHaveBeenCalledOnce();
    expect(refreshApp({ windowRef: {} })).toBe(false);
  });
});
