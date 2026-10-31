import { STUDY_INTERACTIONS_STORAGE_KEY } from "@/lib/app-config";

function resolveStorage(storage) {
  return storage ?? globalThis?.window?.localStorage;
}

function normalizeSetSlugs(setSlugs) {
  if (!Array.isArray(setSlugs)) {
    return [];
  }

  return [
    ...new Set(
      setSlugs
        .map((setSlug) => (typeof setSlug === "string" ? setSlug.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function resetStoredStudyInteractionSets(setSlugs, { storage } = {}) {
  const normalizedSetSlugs = normalizeSetSlugs(setSlugs);
  const resolvedStorage = resolveStorage(storage);

  if (
    normalizedSetSlugs.length === 0 ||
    typeof resolvedStorage?.getItem !== "function" ||
    typeof resolvedStorage?.setItem !== "function"
  ) {
    return false;
  }

  const storedValue = resolvedStorage.getItem(STUDY_INTERACTIONS_STORAGE_KEY);

  if (!storedValue) {
    return false;
  }

  let persistedValue;

  try {
    persistedValue = JSON.parse(storedValue);
  } catch {
    return false;
  }

  if (!isRecord(persistedValue) || !isRecord(persistedValue.state)) {
    return false;
  }

  const interactionsBySet = persistedValue.state.interactionsBySet;

  if (!isRecord(interactionsBySet)) {
    return false;
  }

  const nextInteractionsBySet = { ...interactionsBySet };
  let changed = false;

  for (const setSlug of normalizedSetSlugs) {
    if (Object.hasOwn(nextInteractionsBySet, setSlug)) {
      delete nextInteractionsBySet[setSlug];
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  resolvedStorage.setItem(
    STUDY_INTERACTIONS_STORAGE_KEY,
    JSON.stringify({
      ...persistedValue,
      state: {
        ...persistedValue.state,
        interactionsBySet: nextInteractionsBySet,
      },
    }),
  );

  return true;
}
