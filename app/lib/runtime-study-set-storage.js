import { openDB } from "idb";
import { localStudySetStorage } from "@/lib/local-study-set-storage";
import { deriveSetSlug } from "@/lib/study-sets";
import {
  apiRequest,
  getCapabilities,
  newMutationId,
} from "@/lib/runtime-client";

let cachePromise;
function cache() {
  if (!cachePromise) {
    cachePromise = openDB("lumina-server-cache", 1, {
      blocking(_current, _blocked, event) {
        event.target.close();
      },
      upgrade(db) {
        db.createObjectStore("snapshots");
      },
    });
  }
  return cachePromise;
}
export async function cacheStudySetRecords(records) {
  try {
    await (await cache()).put("snapshots", { records }, "library");
  } catch {
    /* Server remains authoritative when the cache is unavailable. */
  }
}
export async function listStudySetRecords(options) {
  if (!(await getCapabilities()).server) {
    return localStudySetStorage.list(options);
  }
  try {
    const result = await apiRequest("/api/library");
    await cacheStudySetRecords(result.records);
    return result.records;
  } catch (error) {
    if (error.status && error.status < 500) {
      throw error;
    }
    const saved = await (await cache()).get("snapshots", "library");
    if (
      !saved ||
      (options?.requiredSlug &&
        !saved.records.some((record) => record.slug === options.requiredSlug))
    ) {
      throw error;
    }
    options?.onCacheFallback?.(error);
    return saved.records;
  }
}
export async function performLibraryAction(action, args = {}, options = {}) {
  const result = await apiRequest("/api/actions", {
    method: "POST",
    body: { action, args, mutationId: newMutationId(), ...options },
  });
  return result;
}
export async function undoLibraryAction(mutationId, conversationId) {
  return performLibraryAction(
    "library.undo",
    { mutationId },
    { conversationId },
  );
}
export const runtimeStudySetStorage = {
  list: listStudySetRecords,
  async upsert(rawSet, { replaceExisting = false } = {}) {
    if (!(await getCapabilities()).server) {
      return localStudySetStorage.upsert(rawSet, { replaceExisting });
    }
    const records = await listStudySetRecords();
    const slug = deriveSetSlug(rawSet);
    const existing = records.find((record) => record.slug === slug);
    return existing && replaceExisting
      ? performLibraryAction(
          "study_set.update",
          { id: existing.id, patch: rawSet },
          { expectedRevision: existing.revision },
        )
      : performLibraryAction("study_set.create", { rawSet });
  },
  async delete(slug) {
    if (!(await getCapabilities()).server) {
      return localStudySetStorage.delete(slug);
    }
    const records = await listStudySetRecords();
    const record = records.find(
      (item) => item.slug === slug || item.id === slug,
    );
    if (!record) {
      return false;
    }
    return performLibraryAction(
      "study_set.delete",
      { id: record.id },
      { expectedRevision: record.revision },
    );
  },
};

export async function closeStudySetCache() {
  const connection = await cachePromise?.catch(() => null);
  connection?.close();
  cachePromise = undefined;
}
