import * as React from "react";

const browserCapabilities = Object.freeze({
  server: true,
  agent: false,
  pdfCleanup: false,
});
let capabilitiesPromise;
let capabilitiesValue = null;
let retryCapabilities = false;
let retryCapabilitiesAt = 0;
const capabilityListeners = new Set();

export async function apiRequest(path, { body, headers, ...options } = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(body !== undefined && !(body instanceof globalThis.Blob)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: body instanceof globalThis.Blob ? body : JSON.stringify(body) }
      : {}),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok || !result) {
    const error = new Error(
      result?.error?.message ??
        result?.error ??
        result?.message ??
        `Request failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return result;
}

export function getCapabilities({ refresh = false } = {}) {
  if (capabilitiesPromise) {
    return capabilitiesPromise;
  }
  if (
    capabilitiesValue &&
    (!retryCapabilities || (!refresh && Date.now() < retryCapabilitiesAt))
  ) {
    return Promise.resolve(capabilitiesValue);
  }
  capabilitiesPromise = apiRequest("/api/capabilities")
    .then((value) => {
      retryCapabilities = false;
      try {
        globalThis.localStorage.setItem(
          "lumina.server-capabilities",
          JSON.stringify(value),
        );
      } catch {
        /* Storage can be unavailable. */
      }
      return value;
    })
    .catch(() => {
      // A hosted app remains server-owned while its API is unavailable.
      retryCapabilities = true;
      retryCapabilitiesAt = Date.now() + 5000;
      try {
        return (
          JSON.parse(
            globalThis.localStorage.getItem("lumina.server-capabilities"),
          ) ?? browserCapabilities
        );
      } catch {
        return browserCapabilities;
      }
    })
    .then((value) => {
      capabilitiesValue = value;
      capabilityListeners.forEach((listener) => listener());
      return value;
    })
    .finally(() => {
      capabilitiesPromise = null;
    });
  return capabilitiesPromise;
}

export function useCapabilities() {
  const value = React.useSyncExternalStore(
    React.useCallback((listener) => {
      capabilityListeners.add(listener);
      return () => capabilityListeners.delete(listener);
    }, []),
    () => capabilitiesValue,
    () => null,
  );
  React.useEffect(() => {
    getCapabilities();
  }, []);
  return value;
}

export function newMutationId() {
  return globalThis.crypto.randomUUID();
}

export async function uploadSource(file) {
  const { source } = await apiRequest("/api/sources", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  return source;
}

export async function prepareSource(id, scope = "") {
  const { source } = await apiRequest(
    `/api/sources/${encodeURIComponent(id)}/prepare`,
    { method: "POST", body: { scope } },
  );
  return source;
}
