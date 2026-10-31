import "fake-indexeddb/auto";

import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_STUDY_SET_DB_NAME,
  STUDY_INTERACTIONS_STORAGE_KEY,
} from "@/lib/app-config";
import {
  DEFAULT_LOCAL_STUDY_SET_IMPORTED_AT,
  LOCAL_STUDY_SET_DB_VERSION,
  LOCAL_STUDY_SET_STORE_NAME,
  StudySetConflictError,
  StudySetOwnershipError,
  createLocalStudySetRecord,
  deleteLocalStudySet,
  listLocalStudySetRecords,
  resetLocalStudySetDatabaseForTests,
  upsertLocalStudySet,
} from "./local-study-set-storage";
import {
  MILITARY_STUDIES_PACK_ID,
  getDefaultStudySets,
  normalizeStudySet,
} from "./study-sets";

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

function getDefaultStudySetSlugs() {
  return getDefaultStudySets([MILITARY_STUDIES_PACK_ID]).map((set) => set.slug);
}

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

async function putStoredStudySetRecord(record) {
  const db = await openDB(LOCAL_STUDY_SET_DB_NAME, LOCAL_STUDY_SET_DB_VERSION);

  await db.put(LOCAL_STUDY_SET_STORE_NAME, record);
  db.close();
}

describe("local study set storage", () => {
  beforeEach(async () => {
    await resetLocalStudySetDatabaseForTests();
  });

  afterEach(async () => {
    await resetLocalStudySetDatabaseForTests();
  });

  it("does not seed inactive study packs into an empty database", async () => {
    const records = await listLocalStudySetRecords();

    expect(records).toEqual([]);
  });

  it("seeds active military study sets into an empty database", async () => {
    const records = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });

    expect(records.map((record) => record.slug)).toEqual(
      getDefaultStudySetSlugs(),
    );
    expect(records.map((record) => record.importedAt)).toEqual(
      getDefaultStudySets([MILITARY_STUDIES_PACK_ID]).map(
        () => DEFAULT_LOCAL_STUDY_SET_IMPORTED_AT,
      ),
    );
    expect(
      records.some((record) =>
        Object.hasOwn(record.rawSet, "answerOrderRandomizationVersion"),
      ),
    ).toBe(false);
    expect(records.every((record) => record.source?.type === "bundled")).toBe(
      true,
    );
    expect(
      records.every(
        (record) => record.source?.packId === MILITARY_STUDIES_PACK_ID,
      ),
    ).toBe(true);
    expect(
      records.every(
        (record) => typeof record.source?.contentFingerprint === "string",
      ),
    ).toBe(true);

    const firstBundledSet = getDefaultStudySets([MILITARY_STUDIES_PACK_ID])[0];
    const expectedRawSet = { ...firstBundledSet };
    delete expectedRawSet.slug;
    expect(
      records.find((record) => record.slug === firstBundledSet.slug).rawSet,
    ).toEqual(expectedRawSet);
  });

  it("refreshes stale bundled records and clears interactions for refreshed sets", async () => {
    const [seededRecord] = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const storage = createStorage();

    await putStoredStudySetRecord({
      ...seededRecord,
      rawSet: {
        ...seededRecord.rawSet,
        title: "Stale bundled title",
      },
      source: {
        ...seededRecord.source,
        contentFingerprint: "stale",
      },
    });
    storage.setItem(
      STUDY_INTERACTIONS_STORAGE_KEY,
      JSON.stringify({
        state: {
          interactionsBySet: {
            [seededRecord.slug]: {
              1: { answerOpen: true },
            },
            "user-set": {
              1: { answerOpen: true },
            },
          },
        },
        version: 0,
      }),
    );

    const records = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
      interactionStorage: storage,
    });
    const refreshedRecord = records.find(
      (record) => record.slug === seededRecord.slug,
    );
    const storedInteractions = JSON.parse(
      storage.getItem(STUDY_INTERACTIONS_STORAGE_KEY),
    );

    expect(refreshedRecord.rawSet.title).toBe(seededRecord.rawSet.title);
    expect(refreshedRecord.source).toEqual(seededRecord.source);
    expect(
      storedInteractions.state.interactionsBySet[seededRecord.slug],
    ).toBeUndefined();
    expect(
      storedInteractions.state.interactionsBySet["user-set"],
    ).toBeDefined();
  });

  it("reports refreshed slugs so live interaction state can be reset", async () => {
    const [seededRecord] = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const onInteractionSetsReset = vi.fn();

    await putStoredStudySetRecord({
      ...seededRecord,
      source: {
        ...seededRecord.source,
        contentFingerprint: "stale",
      },
    });

    await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
      onInteractionSetsReset,
    });

    expect(onInteractionSetsReset).toHaveBeenCalledWith([seededRecord.slug]);
  });

  it("migrates legacy seeded bundled records into source-tracked records", async () => {
    const [seededRecord] = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const legacyRecord = {
      ...seededRecord,
      rawSet: {
        ...seededRecord.rawSet,
        title: "Legacy bundled title",
      },
    };

    delete legacyRecord.source;
    await putStoredStudySetRecord(legacyRecord);

    const records = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const refreshedRecord = records.find(
      (record) => record.slug === seededRecord.slug,
    );

    expect(refreshedRecord.rawSet.title).toBe(seededRecord.rawSet.title);
    expect(refreshedRecord.source).toEqual(seededRecord.source);
  });

  it("does not overwrite user-owned records that share a bundled slug", async () => {
    const [seededRecord] = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const userRecord = {
      ...seededRecord,
      rawSet: {
        ...seededRecord.rawSet,
        title: "User-owned title",
      },
      importedAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    delete userRecord.source;
    await putStoredStudySetRecord(userRecord);

    const records = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const preservedRecord = records.find(
      (record) => record.slug === seededRecord.slug,
    );

    expect(preservedRecord.rawSet.title).toBe("User-owned title");
    expect(preservedRecord.source).toBeUndefined();
  });

  it("honors explicit imported ownership even at the legacy seed timestamp", async () => {
    const [seededRecord] = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const importedRecord = {
      ...seededRecord,
      rawSet: {
        ...seededRecord.rawSet,
        title: "Explicitly imported title",
      },
      source: { type: "imported" },
    };

    await putStoredStudySetRecord(importedRecord);

    const records = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    expect(records.find((record) => record.slug === seededRecord.slug)).toEqual(
      importedRecord,
    );
  });

  it("imports and persists records keyed by derived slug", async () => {
    const { record, replaced } = await upsertLocalStudySet(createSet(), {
      now: () => "2026-01-01T00:00:00.000Z",
    });

    expect(replaced).toBe(false);
    expect(record).toMatchObject({
      slug: "course-unit-imported-set",
      importedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(listLocalStudySetRecords()).resolves.toEqual([record]);
  });

  it("persists normalized answer order for imported sets", async () => {
    const { record } = await upsertLocalStudySet(
      createSet({
        cards: [
          {
            id: 1,
            type: "multiple_choice",
            question: "Choose one.",
            options: {
              a: "Alpha",
              b: "Beta",
              c: "Gamma",
            },
            answer: "a",
            explanation: "Alpha is correct.",
          },
        ],
      }),
    );

    expect(record.rawSet).not.toHaveProperty("answerOrderRandomizationVersion");
    expect(record.rawSet.cards[0].options[record.rawSet.cards[0].answer]).toBe(
      "Alpha",
    );
  });

  it("randomizes imported answer order exactly once", async () => {
    const rawSet = createSet({
      cards: [
        {
          id: 1,
          type: "multiple_choice",
          question: "Choose one.",
          options: { a: "Alpha", b: "Beta", c: "Gamma" },
          answer: "a",
          explanation: "Alpha is correct.",
        },
      ],
    });
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const expected = normalizeStudySet(rawSet);
    const expectedRawSet = { ...expected };
    delete expectedRawSet.slug;

    random.mockClear();
    const { record } = await upsertLocalStudySet(rawSet);

    expect(record.rawSet).toEqual(expectedRawSet);
    expect(random).toHaveBeenCalledTimes(2);
    random.mockRestore();
  });

  it("requires explicit confirmation before replacing duplicate slugs", async () => {
    const first = await upsertLocalStudySet(createSet(), {
      now: () => "2026-01-01T00:00:00.000Z",
    });

    await expect(
      upsertLocalStudySet(createSet({ cards: [] })),
    ).rejects.toBeInstanceOf(StudySetConflictError);

    const second = await upsertLocalStudySet(
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
      {
        now: () => "2026-01-02T00:00:00.000Z",
        replaceExisting: true,
      },
    );

    expect(second.replaced).toBe(true);
    expect(second.record.importedAt).toBe(first.record.importedAt);
    expect(second.record.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(second.record.rawSet.cards[0].id).toBe(2);
    await expect(listLocalStudySetRecords()).resolves.toHaveLength(1);
  });

  it("never replaces or deletes an active bundled record", async () => {
    const [bundledRecord] = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    const bundledSet = {
      ...bundledRecord.rawSet,
      category: bundledRecord.rawSet.category,
      title: bundledRecord.rawSet.title,
    };

    await expect(
      upsertLocalStudySet(bundledSet, { replaceExisting: true }),
    ).rejects.toMatchObject({
      name: "StudySetConflictError",
      bundled: true,
    });
    await expect(
      deleteLocalStudySet(bundledRecord.slug),
    ).rejects.toBeInstanceOf(StudySetOwnershipError);

    const records = await listLocalStudySetRecords({
      studyPackIds: [MILITARY_STUDIES_PACK_ID],
    });
    expect(records).toContainEqual(bundledRecord);
  });

  it("marks imported and bundled records with explicit ownership", () => {
    expect(createLocalStudySetRecord(createSet()).source).toEqual({
      type: "imported",
    });
  });

  it("deletes imported records", async () => {
    const { record } = await upsertLocalStudySet(createSet());

    await deleteLocalStudySet(record.slug);

    expect((await listLocalStudySetRecords()).map((item) => item.slug)).toEqual(
      [],
    );
  });
});
