import {
  STUDY_PACK_DEFAULTS_STORAGE_KEY,
  STUDY_PACKS_STORAGE_KEY,
} from "@/lib/app-config";
import { getBundledStudyPacks, getStudyPackById } from "@/lib/study-sets";

export { STUDY_PACK_DEFAULTS_STORAGE_KEY, STUDY_PACKS_STORAGE_KEY };

function resolveStorage(storage) {
  return storage ?? globalThis?.window?.localStorage;
}

function normalizeStudyPackIds(packIds) {
  if (!Array.isArray(packIds)) {
    return [];
  }

  const seenIds = new Set();
  const normalizedPackIds = [];

  for (const packId of packIds) {
    if (typeof packId !== "string") {
      continue;
    }

    const normalizedPackId = packId.trim();

    if (
      !normalizedPackId ||
      seenIds.has(normalizedPackId) ||
      !getStudyPackById(normalizedPackId)
    ) {
      continue;
    }

    seenIds.add(normalizedPackId);
    normalizedPackIds.push(normalizedPackId);
  }

  return normalizedPackIds;
}

export function getStoredStudyPackIds(storage) {
  const resolvedStorage = resolveStorage(storage);

  if (typeof resolvedStorage?.getItem !== "function") {
    return [];
  }

  const storedValue = resolvedStorage.getItem(STUDY_PACKS_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    return normalizeStudyPackIds(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

export function setStoredStudyPackIds(packIds, storage) {
  const resolvedStorage = resolveStorage(storage);
  const normalizedPackIds = normalizeStudyPackIds(packIds);

  if (typeof resolvedStorage?.setItem === "function") {
    resolvedStorage.setItem(
      STUDY_PACKS_STORAGE_KEY,
      JSON.stringify(normalizedPackIds),
    );
  }

  return normalizedPackIds;
}

export function addStoredStudyPackId(packId, storage) {
  const pack = getStudyPackById(packId);

  if (!pack) {
    return getStoredStudyPackIds(storage);
  }

  return setStoredStudyPackIds(
    [...getStoredStudyPackIds(storage), pack.id],
    storage,
  );
}

export function activateStudyPacksFromUrl(url, storage) {
  if (!url) {
    return getStoredStudyPackIds(storage);
  }

  const parsedUrl = new URL(url);
  const requestedPackIds = parsedUrl.searchParams.getAll("pack");
  let activePackIds = getStoredStudyPackIds(storage);

  for (const packId of requestedPackIds) {
    activePackIds = addStoredStudyPackId(packId, storage);
  }

  return activePackIds;
}

function getStoredStudyPackDefaultRevisions(storage) {
  const resolvedStorage = resolveStorage(storage);

  if (typeof resolvedStorage?.getItem !== "function") {
    return {};
  }

  const storedValue = resolvedStorage.getItem(STUDY_PACK_DEFAULTS_STORAGE_KEY);

  if (!storedValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(storedValue);

    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

export function getUnappliedStudyPackDefaultFavorites(packIds, storage) {
  const appliedRevisions = getStoredStudyPackDefaultRevisions(storage);
  const packsById = new Map(
    getBundledStudyPacks().map((pack) => [pack.id, pack]),
  );
  const favorites = [];
  const unappliedPackIds = [];

  for (const packId of normalizeStudyPackIds(packIds)) {
    const pack = packsById.get(packId);

    if (!pack || appliedRevisions[pack.id] === pack.revision) {
      continue;
    }

    unappliedPackIds.push(pack.id);
    favorites.push(...pack.defaultFavorites);
  }

  return {
    favorites,
    packIds: unappliedPackIds,
  };
}

export function markStudyPackDefaultFavoritesApplied(packIds, storage) {
  const resolvedStorage = resolveStorage(storage);
  const packsById = new Map(
    getBundledStudyPacks().map((pack) => [pack.id, pack]),
  );
  const appliedRevisions = getStoredStudyPackDefaultRevisions(resolvedStorage);

  for (const packId of normalizeStudyPackIds(packIds)) {
    const pack = packsById.get(packId);

    if (pack) {
      appliedRevisions[pack.id] = pack.revision;
    }
  }

  if (typeof resolvedStorage?.setItem === "function") {
    resolvedStorage.setItem(
      STUDY_PACK_DEFAULTS_STORAGE_KEY,
      JSON.stringify(appliedRevisions),
    );
  }

  return appliedRevisions;
}
