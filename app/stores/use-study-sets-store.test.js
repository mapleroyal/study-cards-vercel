import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  StudySetConflictError,
  localStudySetStorage,
  resetLocalStudySetDatabaseForTests,
} from "@/lib/local-study-set-storage";
import { selectLocalStudySets } from "@/lib/study-sets";
import {
  createStudySetsStore,
  isReplaceableStudySetConflict,
} from "./use-study-sets-store";

function createSet(overrides = {}) {
  return {
    title: "Imported Set",
    category: "Course / Unit",
    cards: [
      {
        id: 1,
        type: "short_answer",
        question: "Question?",
        answer: "Answer",
        explanation: "Explanation.",
      },
    ],
    ...overrides,
  };
}

function createInteractionsStore() {
  const resetSet = vi.fn();

  return {
    resetSet,
    store: {
      getState: () => ({ resetSet }),
    },
  };
}

describe("createStudySetsStore", () => {
  beforeEach(async () => {
    await resetLocalStudySetDatabaseForTests();
  });

  afterEach(async () => {
    await resetLocalStudySetDatabaseForTests();
  });

  it("loads empty storage", async () => {
    const interactions = createInteractionsStore();
    const store = createStudySetsStore({
      storage: localStudySetStorage,
      studyInteractionsStore: interactions.store,
    });

    await expect(store.getState().load()).resolves.toEqual([]);
    expect(store.getState()).toMatchObject({
      records: [],
      status: "ready",
      error: null,
    });
  });

  it("keeps a concurrent cached load unavailable until a fresh library snapshot arrives", async () => {
    const cached = {
      id: "cached-set",
      slug: "cached-set",
      rawSet: createSet(),
    };
    const unavailable = new Error("Library unavailable");
    let finishCachedLoad;
    const storage = {
      list: vi.fn(
        ({ onCacheFallback }) =>
          new Promise((resolve) => {
            finishCachedLoad = () => {
              onCacheFallback(unavailable);
              resolve([cached]);
            };
          }),
      ),
    };
    const store = createStudySetsStore({ storage });
    const pending = store.getState().load();
    // The reader's required-slug load failed while the chooser was loading.
    store.getState().hydrate([], "Study set could not be loaded.");
    finishCachedLoad();
    await expect(pending).resolves.toEqual([cached]);
    expect(store.getState()).toMatchObject({
      records: [cached],
      status: "error",
      error: "Library unavailable",
    });

    // A successful background refresh can now prove the requested set absent.
    store.getState().hydrate([]);
    expect(store.getState()).toMatchObject({
      records: [],
      status: "ready",
      error: null,
    });
    storage.list.mockResolvedValueOnce([]);
    await expect(store.getState().load()).resolves.toEqual([]);
    expect(store.getState()).toMatchObject({
      records: [],
      status: "ready",
      error: null,
    });
  });

  it("imports and exposes local study sets", async () => {
    const interactions = createInteractionsStore();
    const store = createStudySetsStore({
      storage: localStudySetStorage,
      studyInteractionsStore: interactions.store,
    });

    const record = await store.getState().importStudySet(createSet());
    const sets = selectLocalStudySets(store.getState().records);

    expect(record.slug).toBe("course-unit-imported-set");
    expect(sets.map((set) => set.title)).toEqual(
      expect.arrayContaining(["Imported Set"]),
    );
    expect(interactions.resetSet).toHaveBeenCalledWith(record.slug);
  });

  it("persists imported sets across store recreation", async () => {
    const firstInteractions = createInteractionsStore();
    const firstStore = createStudySetsStore({
      storage: localStudySetStorage,
      studyInteractionsStore: firstInteractions.store,
    });

    await firstStore.getState().importStudySet(createSet());

    const secondInteractions = createInteractionsStore();
    const secondStore = createStudySetsStore({
      storage: localStudySetStorage,
      studyInteractionsStore: secondInteractions.store,
    });

    await secondStore.getState().load();

    expect(
      selectLocalStudySets(secondStore.getState().records).map(
        (set) => set.slug,
      ),
    ).toContain("course-unit-imported-set");
  });

  it("requires explicit confirmation to replace duplicate slug imports", async () => {
    const interactions = createInteractionsStore();
    const store = createStudySetsStore({
      storage: localStudySetStorage,
      studyInteractionsStore: interactions.store,
    });

    await store.getState().importStudySet(createSet());
    await expect(
      store.getState().importStudySet(createSet()),
    ).rejects.toMatchObject({ name: "StudySetConflictError" });

    await store.getState().importStudySet(
      createSet({
        cards: [
          {
            id: 2,
            type: "short_answer",
            question: "Replacement?",
            answer: "Replacement answer",
            explanation: "Replacement explanation.",
          },
        ],
      }),
      { replaceExisting: true },
    );

    const sets = selectLocalStudySets(store.getState().records);

    const importedSet = sets.find(
      (set) => set.slug === "course-unit-imported-set",
    );

    expect(sets).toHaveLength(1);
    expect(importedSet.cards[0].id).toBe(2);
    expect(interactions.resetSet).toHaveBeenCalledTimes(2);
    expect(interactions.resetSet).toHaveBeenLastCalledWith(
      "course-unit-imported-set",
    );
  });

  it("deletes imported sets and clears interactions", async () => {
    const interactions = createInteractionsStore();
    const resetQuestionOrder = vi.fn();
    const store = createStudySetsStore({
      storage: localStudySetStorage,
      studyInteractionsStore: interactions.store,
      studyReaderStore: { getState: () => ({ resetQuestionOrder }) },
    });

    const record = await store.getState().importStudySet(createSet());
    const remainingRecords = await store.getState().deleteStudySet(record.slug);
    expect(resetQuestionOrder).toHaveBeenCalledWith(record.slug);

    expect(remainingRecords.map((item) => item.slug)).toEqual([]);
    expect(store.getState().records).toEqual(remainingRecords);
    expect(interactions.resetSet).toHaveBeenLastCalledWith(record.slug);
  });
});

describe("isReplaceableStudySetConflict", () => {
  it("allows confirmation only for imported-set collisions", () => {
    expect(
      isReplaceableStudySetConflict(new StudySetConflictError("set")),
    ).toBe(true);
    expect(
      isReplaceableStudySetConflict(
        new StudySetConflictError("set", { bundled: true }),
      ),
    ).toBe(false);
    expect(isReplaceableStudySetConflict(new Error("Other failure"))).toBe(
      false,
    );
  });
});
