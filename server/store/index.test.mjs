import { afterEach, describe, expect, it } from "vitest";
import { createTestStore } from "../test-helpers/store.mjs";

const stores = [];
function open() {
  const store = createTestStore();
  stores.push(store);
  return store;
}
const sample = () => ({
  title: "Flight controls",
  category: "Training/Aircraft",
  cards: [
    {
      id: 7,
      type: "multiple_choice",
      question: "Which surface controls roll?",
      explanation: "Ailerons control roll.",
      options: { B: "Ailerons", A: "Rudder" },
      answer: "B",
    },
    {
      id: 42,
      type: "true_false",
      question: "The elevator controls pitch.",
      explanation: "The elevator changes pitch.",
      answer: true,
    },
  ],
});
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe("Postgres study library", () => {
  it("preserves identity and answer order, and clears only progress for edited cards", async () => {
    const store = open();
    const { record } = await store.createStudySet(sample());
    await store.setInteraction(record.slug, 7, {
      selectedOption: "B",
      answerOpen: true,
    });
    await store.setInteraction(record.slug, 42, { selectedAnswer: true });
    const renamed = (
      await store.updateStudySet(record.id, { title: "Aircraft controls" })
    ).record;
    expect(renamed.id).toBe(record.id);
    expect(renamed.slug).toBe(record.slug);
    expect(Object.keys(renamed.rawSet.cards[0].options)).toEqual(["B", "A"]);
    expect((await store.getInteractions())[record.slug][7].selectedOption).toBe(
      "B",
    );
    await store.updateStudySet(record.id, {
      upsertCards: [
        { ...sample().cards[0], question: "Which surface rolls an aircraft?" },
      ],
    });
    expect((await store.getInteractions())[record.slug]).toEqual({
      42: { selectedAnswer: true },
    });
  });

  it("replaces sparse browser progress, including cleared answers", async () => {
    const store = open();
    const { record } = await store.createStudySet(sample());
    await store.setInteraction(record.id, 7, {
      selectedOption: "B",
      answerOpen: true,
    });
    await store.setInteraction(
      record.id,
      7,
      { answerOpen: true },
      { replace: true },
    );
    expect((await store.getInteractions())[record.slug][7]).toEqual({
      answerOpen: true,
    });
    await store.setInteraction(record.id, 7, {}, { replace: true });
    expect(await store.getInteractions()).toEqual({});
  });

  it("deduplicates simultaneous retries and rejects stale or reused mutation IDs", async () => {
    const store = open();
    const options = { mutationId: "create-1", expectedRevision: 0 };
    const [first, retry] = await Promise.all([
      store.createStudySet(sample(), options),
      store.createStudySet(sample(), options),
    ]);
    expect(retry).toEqual(first);
    expect(await store.listStudySets()).toHaveLength(1);
    await expect(
      store.createStudySet({ ...sample(), title: "Other" }, options),
    ).rejects.toThrow(/another action/);
    await expect(
      store.updateStudySet(
        first.record.id,
        { title: "Stale" },
        { expectedRevision: 0 },
      ),
    ).rejects.toThrow(/study set changed/);
    expect(await store.getRevision()).toBe(1);
  });

  it("checks set revisions independently of progress and rejects stale card answers", async () => {
    const store = open();
    const { record } = await store.createStudySet(sample());
    await store.setInteraction(record.id, 7, { selectedOption: "B" });
    await store.updateStudySet(
      record.id,
      { title: "Renamed" },
      { expectedRevision: record.revision },
    );
    await store.updateStudySet(record.id, {
      upsertCards: [{ ...sample().cards[0], question: "Changed" }],
    });
    await expect(
      store.setInteraction(
        record.id,
        7,
        { selectedOption: "A" },
        { cardVersion: JSON.stringify(sample().cards[0]) },
      ),
    ).rejects.toThrow(/card changed/);
    expect(await store.getInteractions()).toEqual({});
  });

  it("restores deleted sets, progress and favorites through Undo", async () => {
    const store = open();
    const { record } = await store.createStudySet(sample());
    await store.setInteraction(record.id, 7, { selectedOption: "B" });
    await store.setFavorites([{ type: "set", slug: record.slug }]);
    const deleted = await store.deleteStudySet(record.id);
    expect(await store.listStudySets()).toEqual([]);
    expect(await store.getInteractions()).toEqual({});
    await store.undoChange(deleted.mutationId);
    expect((await store.getStudySet(record.id)).rawSet).toEqual(record.rawSet);
    expect((await store.getInteractions())[record.slug][7]).toEqual({
      selectedOption: "B",
    });
    expect(await store.getFavorites()).toEqual([
      { type: "set", slug: record.slug },
    ]);
  });

  it("rejects Undo that conflicts with later card edits or progress", async () => {
    const store = open();
    const { record } = await store.createStudySet(sample());
    await store.setInteraction(record.id, 7, { selectedOption: "B" });
    const reset = await store.resetInteractions(record.id);
    const edit = await store.updateStudySet(record.id, {
      upsertCards: [{ ...sample().cards[0], question: "Updated question" }],
    });
    await expect(store.undoChange(reset.mutationId)).rejects.toThrow(
      /later card or progress change/,
    );
    await store.setInteraction(record.id, 7, { selectedOption: "A" });
    await expect(store.undoChange(edit.mutationId)).rejects.toThrow(
      /later card or progress change/,
    );
    expect((await store.getInteractions())[record.slug][7]).toEqual({
      selectedOption: "A",
    });
  });

  it("never undoes creation underneath later favorites and deduplicates last-change Undo", async () => {
    const store = open();
    const created = await store.createStudySet(sample());
    await store.setFavorites([{ type: "set", slug: created.record.slug }]);
    await expect(store.undoChange(created.mutationId)).rejects.toThrow(
      /later change uses/,
    );
    const options = { mutationId: "undo-latest" };
    const receipt = await store.undoLastChange(options);
    expect(await store.undoLastChange(options)).toEqual(receipt);
    expect(await store.getFavorites()).toEqual([]);
    expect(await store.listStudySets()).toHaveLength(1);
  });

  it("rolls back partially completed imports and validates card answers", async () => {
    const store = open();
    await expect(
      store.importBrowserData({
        originId: "invalid",
        records: [
          sample(),
          { ...sample(), cards: [{ ...sample().cards[0], answer: "missing" }] },
        ],
      }),
    ).rejects.toThrow(/option key/);
    expect(await store.listStudySets()).toEqual([]);
    expect(await store.getRevision()).toBe(0);
    const { record } = await store.createStudySet(sample());
    await expect(store.setInteraction(record.id, 99, {})).rejects.toThrow(
      /Card not found/,
    );
    await expect(
      store.setInteraction(record.id, 7, { selectedOption: "missing" }),
    ).rejects.toThrow(/does not exist/);
  });

  it("imports browser libraries once per origin without overwriting server data", async () => {
    const store = open();
    const { record } = await store.createStudySet(sample());
    await store.setInteraction(record.slug, 42, { selectedAnswer: false });
    const input = {
      originId: "browser-a",
      records: [{ ...record, rawSet: { ...sample(), title: "Browser copy" } }],
      interactionsBySet: { [record.slug]: { 42: { selectedAnswer: true } } },
      favorites: [{ type: "set", slug: record.slug }],
    };
    const imported = await store.importBrowserData(input);
    expect(imported.created).toBe(1);
    expect(imported.slugMap[record.slug]).not.toBe(record.slug);
    expect(
      (await store.getInteractions())[record.slug][42].selectedAnswer,
    ).toBe(false);
    expect((await store.importBrowserData(input)).alreadyImported).toBe(true);
    expect(await store.listStudySets()).toHaveLength(2);
  });

  it("saves a generated set and its completed job atomically and exactly once", async () => {
    const store = open();
    await store.putRecord("sources", "source-1", {
      id: "source-1",
      status: "ready",
    });
    await store.putRecord("jobs", "job-1", {
      id: "job-1",
      sourceId: "source-1",
      status: "saving",
    });
    const options = {
      mutationId: "job-1",
      generationJobId: "job-1",
      source: { id: "source-1" },
    };
    const saved = await store.createStudySet(sample(), options);
    expect(await store.createStudySet(sample(), options)).toEqual(saved);
    const job = await store.getRecord("jobs", "job-1");
    expect(job.status).toBe("completed");
    expect(job.resultRecord.id).toBe(saved.record.id);
    expect(await store.listStudySets()).toHaveLength(1);
    await store.undoChange(saved.mutationId);
    expect((await store.getRecord("jobs", "job-1")).status).toBe("completed");
    expect(await store.listStudySets()).toEqual([]);
  });

  it("fences canceled jobs and deleted sources before a late generation can save", async () => {
    const store = open();
    await store.putRecord("sources", "source-1", {
      id: "source-1",
      status: "ready",
    });
    await store.putRecord("jobs", "job-1", {
      id: "job-1",
      sourceId: "source-1",
      status: "generating",
    });
    await store.updateRecord("jobs", "job-1", (job) => ({
      ...job,
      status: "canceled",
    }));
    await expect(
      store.createStudySet(sample(), { generationJobId: "job-1" }),
    ).rejects.toThrow(/no longer active/);
    await store.putRecord("jobs", "job-2", {
      id: "job-2",
      sourceId: "source-1",
      status: "saving",
    });
    await store.updateRecord("sources", "source-1", (source) => ({
      ...source,
      status: "deleting",
    }));
    await expect(
      store.createStudySet(sample(), { generationJobId: "job-2" }),
    ).rejects.toThrow(/no longer active/);
    expect(await store.listStudySets()).toEqual([]);
    expect(await store.getRevision()).toBe(0);
  });

  it("atomically updates generic records and prevents bypassing typed library writes", async () => {
    const store = open();
    await store.putRecord("settings", "owner", { attempts: 0 });
    await Promise.all(
      Array.from({ length: 3 }, () =>
        store.updateRecord("settings", "owner", (value) => ({
          attempts: value.attempts + 1,
        })),
      ),
    );
    expect(await store.getRecord("settings", "owner")).toEqual({ attempts: 3 });
    await store.updateRecord("settings", "owner", () => undefined);
    expect(await store.getRecord("settings", "owner")).toEqual({ attempts: 3 });
    expect(() => store.putRecord("study-sets", "bypass", sample())).toThrow(
      /typed study-library/,
    );
    await store.updateRecord("settings", "owner", () => null);
    expect(await store.getRecord("settings", "owner")).toBeNull();
  });
});

it("rejects categories that normalize to empty before any import or move is committed", async () => {
  const store = open();
  const original = (await store.createStudySet(sample())).record;
  const revision = await store.getRevision();
  await expect(
    store.updateStudySet(original.id, { category: "/ /" }),
  ).rejects.toMatchObject({ status: 400 });
  expect(await store.getStudySet(original.id)).toEqual(original);
  expect(await store.getRevision()).toBe(revision);
  await expect(
    store.createStudySet({ ...sample(), category: "/ /" }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    store.importBrowserData({
      originId: "invalid-category",
      records: [
        { ...sample(), title: "Valid first" },
        { ...sample(), category: "/ /" },
      ],
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(await store.listStudySets()).toEqual([original]);
  expect(await store.getRevision()).toBe(revision);
  const moved = (
    await store.updateStudySet(original.id, {
      category: " / Science / Biology // ",
    })
  ).record;
  expect(moved.rawSet.category).toBe("Science/Biology");
  expect(
    (await store.updateStudySet(original.id, { title: "Still editable" }))
      .record.rawSet.category,
  ).toBe("Science/Biology");
});

it("fences progress by immutable set identity even when a replacement has identical cards and slug", async () => {
  const store = open();
  const original = (await store.createStudySet(sample())).record;
  const cardVersion = JSON.stringify(original.rawSet.cards[0]);
  const options = { setId: original.id, cardVersion, mutationId: "old-answer" };
  const receipt = await store.setInteraction(
    original.slug,
    7,
    { selectedOption: "B" },
    options,
  );
  await store.deleteStudySet(original.id);
  const replacement = (await store.createStudySet(sample())).record;
  expect(replacement.slug).toBe(original.slug);
  expect(
    await store.setInteraction(
      original.slug,
      7,
      { selectedOption: "B" },
      options,
    ),
  ).toEqual(receipt);
  expect(await store.getInteractions()).toEqual({});
  await expect(
    store.setInteraction(
      original.slug,
      7,
      { selectedOption: "A" },
      { ...options, mutationId: "offline-old-answer" },
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(await store.getInteractions()).toEqual({});
  await store.setInteraction(
    replacement.slug,
    7,
    { selectedOption: "A" },
    { setId: replacement.id, cardVersion },
  );
  expect(
    (await store.getInteractions())[replacement.slug][7].selectedOption,
  ).toBe("A");
});
