import { describe, expect, it } from "vitest";

import { STUDY_FAVORITES_STORAGE_KEY } from "@/lib/study-favorites";
import { createStudyFavoritesStore } from "./use-study-favorites-store";

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("createStudyFavoritesStore", () => {
  it("starts with persisted favorites", () => {
    const storage = createMemoryStorage({
      [STUDY_FAVORITES_STORAGE_KEY]: JSON.stringify([
        { type: "set", slug: "biology" },
      ]),
    });
    const store = createStudyFavoritesStore({ storage });

    expect(store.getState().favorites).toEqual([
      { type: "set", slug: "biology" },
    ]);
  });

  it("falls back to an empty list for invalid stored data", () => {
    const storage = createMemoryStorage({
      [STUDY_FAVORITES_STORAGE_KEY]: "not json",
    });
    const store = createStudyFavoritesStore({ storage });

    expect(store.getState().favorites).toEqual([]);
  });

  it("adds, removes, toggles, and persists favorites", () => {
    const storage = createMemoryStorage();
    const store = createStudyFavoritesStore({ storage });

    store
      .getState()
      .addFavorite({ type: "category", path: " Term 1 / Science " });

    expect(store.getState().favorites).toEqual([
      { type: "category", path: "Term 1/Science" },
    ]);
    expect(JSON.parse(storage.getItem(STUDY_FAVORITES_STORAGE_KEY))).toEqual([
      { type: "category", path: "Term 1/Science" },
    ]);

    store.getState().toggleFavorite({ type: "set", slug: "biology" });

    expect(store.getState().favorites).toEqual([
      { type: "category", path: "Term 1/Science" },
      { type: "set", slug: "biology" },
    ]);

    store
      .getState()
      .removeFavorite({ type: "category", path: "Term 1/Science" });

    expect(store.getState().favorites).toEqual([
      { type: "set", slug: "biology" },
    ]);

    store.getState().toggleFavorite({ type: "set", slug: "biology" });

    expect(store.getState().favorites).toEqual([]);
    expect(JSON.parse(storage.getItem(STUDY_FAVORITES_STORAGE_KEY))).toEqual(
      [],
    );
  });

  it("prunes favorites against available sets", () => {
    const storage = createMemoryStorage({
      [STUDY_FAVORITES_STORAGE_KEY]: JSON.stringify([
        { type: "set", slug: "biology" },
        { type: "set", slug: "missing" },
        { type: "category", path: "Term 1/Science" },
        { type: "category", path: "Deleted" },
      ]),
    });
    const store = createStudyFavoritesStore({ storage });

    store.getState().pruneFavorites([
      {
        slug: "biology",
        title: "Biology",
        category: "Term 1/Science",
      },
    ]);

    expect(store.getState().favorites).toEqual([
      { type: "set", slug: "biology" },
      { type: "category", path: "Term 1/Science" },
    ]);
  });
});
