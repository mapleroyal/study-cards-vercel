import { describe, expect, it } from "vitest";

import {
  STUDY_PACKS_STORAGE_KEY,
  activateStudyPacksFromUrl,
  getStoredStudyPackIds,
  setStoredStudyPackIds,
} from "./study-pack-activation";

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("study pack activation", () => {
  it("normalizes stored pack ids against bundled study packs", () => {
    const storage = createMemoryStorage({
      [STUDY_PACKS_STORAGE_KEY]: JSON.stringify([
        "military-studies",
        "missing-pack",
        "military-studies",
      ]),
    });

    expect(getStoredStudyPackIds(storage)).toEqual(["military-studies"]);
  });

  it("activates a valid pack from the URL", () => {
    const storage = createMemoryStorage();

    expect(
      activateStudyPacksFromUrl(
        "https://example.test/?pack=military-studies",
        storage,
      ),
    ).toEqual(["military-studies"]);
    expect(JSON.parse(storage.getItem(STUDY_PACKS_STORAGE_KEY))).toEqual([
      "military-studies",
    ]);
  });

  it("ignores unknown URL packs", () => {
    const storage = createMemoryStorage();

    expect(
      activateStudyPacksFromUrl("https://example.test/?pack=unknown", storage),
    ).toEqual([]);
  });

  it("persists only valid unique pack ids", () => {
    const storage = createMemoryStorage();

    expect(
      setStoredStudyPackIds(
        ["military-studies", "unknown", "military-studies"],
        storage,
      ),
    ).toEqual(["military-studies"]);
  });
});
