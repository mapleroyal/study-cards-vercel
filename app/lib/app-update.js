import * as React from "react";

export const APP_BUILD_ID = import.meta.env.VITE_LUMINA_BUILD_ID ?? "local";
export const BUILD_INFO_PATH = "/build-info.json";
export const APP_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function getDefaultFetch() {
  return typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;
}

function getBuildInfoRequestUrl(
  path = BUILD_INFO_PATH,
  cacheBust = Date.now(),
) {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}v=${encodeURIComponent(cacheBust)}`;
}

export function normalizeBuildInfo(buildInfo) {
  if (!buildInfo || typeof buildInfo !== "object") {
    return null;
  }

  const buildId =
    typeof buildInfo.buildId === "string" ? buildInfo.buildId.trim() : "";

  if (!buildId) {
    return null;
  }

  return { ...buildInfo, buildId };
}

export function isAppUpdateAvailable({
  currentBuildId = APP_BUILD_ID,
  latestBuildInfo,
} = {}) {
  const normalizedCurrentBuildId =
    typeof currentBuildId === "string" ? currentBuildId.trim() : "";
  const normalizedLatestBuildInfo = normalizeBuildInfo(latestBuildInfo);

  return Boolean(
    normalizedCurrentBuildId &&
    normalizedLatestBuildInfo &&
    normalizedLatestBuildInfo.buildId !== normalizedCurrentBuildId,
  );
}

export async function fetchBuildInfo({
  fetcher = getDefaultFetch(),
  path = BUILD_INFO_PATH,
  now = Date.now,
  signal,
} = {}) {
  if (typeof fetcher !== "function") {
    throw new Error("Build info cannot be fetched in this environment.");
  }

  const response = await fetcher(getBuildInfoRequestUrl(path, now()), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response?.ok) {
    throw new Error("Build info request failed.");
  }

  const buildInfo = normalizeBuildInfo(await response.json());

  if (!buildInfo) {
    throw new Error("Build info response was invalid.");
  }

  return buildInfo;
}

export async function checkForAppUpdate({
  currentBuildId = APP_BUILD_ID,
  fetcher,
  path,
  now,
  signal,
} = {}) {
  const latestBuildInfo = await fetchBuildInfo({ fetcher, path, now, signal });

  return {
    currentBuildId,
    latestBuildInfo,
    updateAvailable: isAppUpdateAvailable({
      currentBuildId,
      latestBuildInfo,
    }),
  };
}

export function canRefreshApp({ windowRef = globalThis.window } = {}) {
  return typeof windowRef?.location?.reload === "function";
}

export function refreshApp({ windowRef = globalThis.window } = {}) {
  if (!canRefreshApp({ windowRef })) {
    return false;
  }

  windowRef.location.reload();
  return true;
}

export function useAppUpdate({
  currentBuildId = APP_BUILD_ID,
  fetcher,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  pollIntervalMs = APP_UPDATE_CHECK_INTERVAL_MS,
} = {}) {
  const [state, setState] = React.useState(() => ({
    latestBuildInfo: null,
    refreshSupported: canRefreshApp({ windowRef }),
    status: "idle",
    updateAvailable: false,
  }));

  React.useEffect(() => {
    const resolvedFetcher = fetcher ?? getDefaultFetch();

    if (!currentBuildId || typeof resolvedFetcher !== "function") {
      setState((previousState) => ({
        ...previousState,
        refreshSupported: canRefreshApp({ windowRef }),
        status: "unsupported",
      }));
      return undefined;
    }

    let disposed = false;
    let activeController = null;
    let checkSequence = 0;

    async function check() {
      activeController?.abort();
      activeController =
        typeof globalThis.AbortController === "function"
          ? new globalThis.AbortController()
          : null;
      const sequence = ++checkSequence;

      setState((previousState) => ({
        ...previousState,
        refreshSupported: canRefreshApp({ windowRef }),
        status: previousState.updateAvailable ? "stale" : "checking",
      }));

      try {
        const result = await checkForAppUpdate({
          currentBuildId,
          fetcher: resolvedFetcher,
          signal: activeController?.signal,
        });

        if (disposed || sequence !== checkSequence) {
          return;
        }

        setState({
          latestBuildInfo: result.latestBuildInfo,
          refreshSupported: canRefreshApp({ windowRef }),
          status: result.updateAvailable ? "stale" : "current",
          updateAvailable: result.updateAvailable,
        });
      } catch {
        if (disposed || sequence !== checkSequence) {
          return;
        }

        setState((previousState) => ({
          ...previousState,
          refreshSupported: canRefreshApp({ windowRef }),
          status: previousState.updateAvailable ? "stale" : "unknown",
        }));
      }
    }

    function checkWhenVisible() {
      if (documentRef?.visibilityState !== "hidden") {
        check();
      }
    }

    check();

    const intervalId =
      pollIntervalMs > 0
        ? windowRef?.setInterval?.(check, pollIntervalMs)
        : null;

    windowRef?.addEventListener?.("focus", check);
    documentRef?.addEventListener?.("visibilitychange", checkWhenVisible);

    return () => {
      disposed = true;
      activeController?.abort();

      if (intervalId !== null && intervalId !== undefined) {
        windowRef?.clearInterval?.(intervalId);
      }

      windowRef?.removeEventListener?.("focus", check);
      documentRef?.removeEventListener?.("visibilitychange", checkWhenVisible);
    };
  }, [currentBuildId, documentRef, fetcher, pollIntervalMs, windowRef]);

  const refresh = React.useCallback(
    () => refreshApp({ windowRef }),
    [windowRef],
  );

  return { ...state, refresh };
}
