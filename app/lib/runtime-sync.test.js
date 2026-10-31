import { openDB } from "idb";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestStore } from "../../server/test-helpers/store.mjs";

const { apiRequest, listBrowserRecords, getCapabilities, toastInfo } =
  vi.hoisted(() => ({
    toastInfo: vi.fn(),
    getCapabilities: vi.fn(),
    apiRequest: vi.fn(),
    listBrowserRecords: vi.fn(),
  }));
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));
vi.mock("@/lib/runtime-client", () => ({
  apiRequest,
  getCapabilities,
  newMutationId: () => globalThis.crypto.randomUUID(),
}));
vi.mock("@/lib/local-study-set-storage", () => ({
  localStudySetStorage: { list: listBrowserRecords },
  StudySetConflictError: class extends Error {},
}));

const rawSet = {
  title: "Biology",
  category: "Science",
  cards: [
    {
      id: 1,
      type: "short_answer",
      question: "What divides?",
      answer: "Cells",
      explanation: "Cells divide.",
    },
  ],
};
let server;
let record;
let stop;
let sync;
let interactions;
let favorites;
let sets;
const extraStops = [];
let handleProgressRead;
let loseImportResponse;
const imports = [];

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  getCapabilities.mockResolvedValue({ server: true });
  // Initialize the PostgreSQL fixture before installing browser globals.
  server = createTestStore();
  record = (await server.createStudySet(rawSet)).record;
  let lock = Promise.resolve();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name, callback) => {
        const result = lock.then(callback);
        lock = result.catch(() => {});
        return result;
      },
    },
  });
  vi.stubGlobal("indexedDB", new IDBFactory());
  const values = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      get length() {
        return values.size;
      },
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal("document", { visibilityState: "hidden" });
  handleProgressRead = null;
  loseImportResponse = false;
  imports.length = 0;
  listBrowserRecords.mockResolvedValue([]);
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === "/api/library") {
      return { records: await server.listStudySets() };
    }
    if (path === "/api/progress") {
      if (options.method === "PATCH") {
        const { slug, cardId, patch, mutationId, cardVersion } = options.body;
        return server.setInteraction(slug, cardId, patch, {
          mutationId,
          cardVersion,
          replace: true,
        });
      }
      const result = { interactionsBySet: await server.getInteractions() };
      return handleProgressRead ? handleProgressRead(result) : result;
    }
    if (path === "/api/favorites") {
      if (options.method === "PUT") {
        return server.setFavorites(options.body.favorites);
      }
      return { favorites: await server.getFavorites() };
    }
    if (path === "/api/actions") {
      imports.push(globalThis.structuredClone(options.body));
      const result = await server.importBrowserData(options.body.args, {
        mutationId: options.body.mutationId,
      });
      if (loseImportResponse) {
        loseImportResponse = false;
        throw new TypeError("Connection lost after the server committed");
      }
      return result;
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  sync = await import("./runtime-sync");
  interactions = (await import("@/stores/use-study-interactions-store"))
    .useStudyInteractionsStore;
  favorites = (await import("@/stores/use-study-favorites-store"))
    .useStudyFavoritesStore;
  sets = (await import("@/stores/use-study-sets-store")).useStudySetsStore;
  sets.getState().hydrate([record]);
});
afterEach(async () => {
  stop?.();
  for (const cleanup of extraStops.splice(0)) {
    cleanup();
  }
  stop = undefined;
  try {
    await sync?.flushRuntimeSync();
    await server?.close();
  } finally {
    sync = undefined;
    vi.unstubAllGlobals();
  }
});

describe("server synchronization", () => {
  it("preserves and uploads answers entered while the initial snapshot is pending", async () => {
    let releaseRead;
    let markReadStarted;
    const readStarted = new Promise((resolve) => {
      markReadStarted = resolve;
    });
    handleProgressRead = (result) =>
      new Promise((resolve) => {
        releaseRead = () => resolve(result);
        markReadStarted();
      });
    const starting = sync.startRuntimeSync();
    await readStarted;
    interactions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "Cells divide");
    handleProgressRead = null;
    releaseRead();
    stop = await starting;
    expect(
      interactions.getState().interactionsBySet[record.slug][1].response,
    ).toBe("Cells divide");
    await sync.flushRuntimeSync();
    expect((await server.getInteractions())[record.slug][1].response).toBe(
      "Cells divide",
    );
    expect(sync.getRuntimeSyncSnapshot().pending).toBe(0);
  });

  it("drains edits queued during an active flush without reporting a false empty outbox", async () => {
    stop = await sync.startRuntimeSync();
    const originalRequest = apiRequest.getMockImplementation();
    const writes = [Promise.withResolvers(), Promise.withResolvers()];
    const started = [Promise.withResolvers(), Promise.withResolvers()];
    let writeIndex = 0;
    apiRequest.mockImplementation(async (path, options) => {
      if (path === "/api/progress" && options?.method === "PATCH") {
        const index = writeIndex++;
        started[index].resolve();
        await writes[index].promise;
      }
      return originalRequest(path, options);
    });
    try {
      interactions
        .getState()
        .setTextResponse(record.slug, rawSet.cards[0], "First answer");
      await started[0].promise;
      interactions
        .getState()
        .setTextResponse(record.slug, rawSet.cards[0], "Second answer");
      expect(sync.getRuntimeSyncSnapshot().pending).toBe(2);
      writes[0].resolve();
      await started[1].promise;
      expect(sync.getRuntimeSyncSnapshot().pending).toBe(1);
      writes[1].resolve();
      await expect
        .poll(
          async () =>
            (await server.getInteractions())[record.slug]?.[1]?.response,
        )
        .toBe("Second answer");
      await expect.poll(() => sync.getRuntimeSyncSnapshot().pending).toBe(0);
    } finally {
      writes.forEach((write) => write.resolve());
    }
  });

  it("retries a committed browser migration after a lost response and subsequent edits", async () => {
    loseImportResponse = true;
    stop = await sync.startRuntimeSync();
    expect(sync.getRuntimeSyncSnapshot().offline).toBe(true);
    interactions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "Answer after disconnect");
    await expect
      .poll(
        async () =>
          (await server.getInteractions())[record.slug]?.[1]?.response,
      )
      .toBe("Answer after disconnect");
    await sync.flushRuntimeSync();
    expect(imports).toHaveLength(2);
    expect(imports[0].args.originId).toBe(imports[1].args.originId);
    expect(imports[0].mutationId).not.toBe(imports[1].mutationId);
    expect(imports[0].args.interactionsBySet).not.toEqual(
      imports[1].args.interactionsBySet,
    );
    expect(sync.getRuntimeSyncSnapshot()).toMatchObject({
      pending: 0,
      offline: false,
    });
  });

  it("caches server favorites without writing them back as a local edit", async () => {
    const expected = [{ type: "set", slug: record.slug }];
    await server.setFavorites(expected);
    stop = await sync.startRuntimeSync();
    expect(favorites.getState().favorites).toEqual(expected);
    expect(
      JSON.parse(window.localStorage.getItem("lumina:study-favorites")),
    ).toEqual(expected);
    expect(
      apiRequest.mock.calls.filter(
        ([path, options]) =>
          path === "/api/favorites" && options?.method === "PUT",
      ),
    ).toHaveLength(0);
  });
});

it("persists typing immediately but sends only the latest unsent response", async () => {
  stop = await sync.startRuntimeSync();
  for (let length = 1; length <= 100; length++) {
    interactions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "a".repeat(length));
  }
  const storage = await openDB("lumina-sync", 1);
  await expect
    .poll(
      async () =>
        (await storage.getAll("outbox"))[0]?.body.patch.response.length,
    )
    .toBe(100);
  const pending = await storage.getAll("outbox");
  expect(pending).toHaveLength(1);
  expect(pending[0].sent).not.toBe(true);
  expect(await server.getInteractions()).toEqual({});
  await sync.flushRuntimeSync();
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "a".repeat(100),
  );
  expect(
    apiRequest.mock.calls.filter(
      ([path, options]) =>
        path === "/api/progress" && options?.method === "PATCH",
    ),
  ).toHaveLength(1);
  storage.close();
});

it("refreshes edited cards and reconciles a rejected stale answer", async () => {
  stop = await sync.startRuntimeSync();
  const changed = { ...rawSet.cards[0], question: "New question?" };
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Old response");
  await server.updateStudySet(record.id, { upsertCards: [changed] });
  await sync.flushRuntimeSync();
  expect(sets.getState().records[0].rawSet.cards[0]).toEqual(changed);
  expect(interactions.getState().interactionsBySet).toEqual({});
  expect(toastInfo).toHaveBeenCalledTimes(1);
  expect(sync.getRuntimeSyncSnapshot()).toMatchObject({
    pending: 0,
    error: null,
  });
  interactions.getState().setTextResponse(record.slug, changed, "New response");
  await sync.flushRuntimeSync();
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "New response",
  );
  await server.deleteStudySet(record.id);
  await sync.flushRuntimeSync();
  expect(sets.getState().records).toEqual([]);
});

it("clears a server error after the next successful reconciliation", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  apiRequest.mockRejectedValueOnce(
    Object.assign(new Error("Server unavailable"), { status: 503 }),
  );
  await sync.flushRuntimeSync();
  expect(sync.getRuntimeSyncSnapshot().error).toBe("Server unavailable");
  apiRequest.mockImplementation(request);
  await sync.flushRuntimeSync();
  expect(sync.getRuntimeSyncSnapshot()).toMatchObject({
    offline: false,
    error: null,
  });
});

it("orders shared drafts durably across module instances and a backwards clock", async () => {
  stop = await sync.startRuntimeSync();
  vi.resetModules();
  const otherSync = await import("./runtime-sync");
  const otherInteractions = (
    await import("@/stores/use-study-interactions-store")
  ).useStudyInteractionsStore;
  const otherSets = (await import("@/stores/use-study-sets-store"))
    .useStudySetsStore;
  otherSets.getState().hydrate([record]);
  extraStops.push(await otherSync.startRuntimeSync());
  const clock = vi.spyOn(Date, "now").mockReturnValue(10000);
  const storage = await openDB("lumina-sync", 1);
  try {
    otherInteractions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "Earlier response");
    await expect
      .poll(
        async () => (await storage.getAll("outbox"))[0]?.body.patch.response,
      )
      .toBe("Earlier response");
    const earlierSequence = (await storage.getAll("outbox"))[0].sequence;
    clock.mockReturnValue(100);
    interactions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "Final response");
    await expect
      .poll(
        async () => (await storage.getAll("outbox"))[0]?.body.patch.response,
      )
      .toBe("Final response");
    expect((await storage.getAll("outbox"))[0].sequence).toBeGreaterThan(
      earlierSequence,
    );
    await Promise.all([sync.flushRuntimeSync(), otherSync.flushRuntimeSync()]);
    expect((await server.getInteractions())[record.slug][1].response).toBe(
      "Final response",
    );
    expect(
      apiRequest.mock.calls.filter(
        ([path, options]) =>
          path === "/api/progress" && options?.method === "PATCH",
      ),
    ).toHaveLength(1);
  } finally {
    clock.mockRestore();
    storage.close();
  }
});

it("preserves a possibly committed request while coalescing later typing", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  let lost = false;
  apiRequest.mockImplementation(async (path, options) => {
    const result = await request(path, options);
    if (path === "/api/progress" && options?.method === "PATCH" && !lost) {
      lost = true;
      throw new TypeError("Response lost after commit");
    }
    return result;
  });
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "First response");
  await sync.flushRuntimeSync();
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Second response");
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Final response");
  await sync.flushRuntimeSync();
  await expect.poll(() => sync.getRuntimeSyncSnapshot().pending).toBe(0);
  const writes = apiRequest.mock.calls
    .filter(
      ([path, options]) =>
        path === "/api/progress" && options?.method === "PATCH",
    )
    .map(([, options]) => options.body);
  expect(writes.map((body) => body.patch.response)).toEqual([
    "First response",
    "First response",
    "Final response",
  ]);
  expect(writes[0].mutationId).toBe(writes[1].mutationId);
  expect(writes[2].mutationId).not.toBe(writes[0].mutationId);
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "Final response",
  );
});

it("starts synchronization when server capabilities recover on online", async () => {
  let onOnline;
  window.addEventListener = (name, callback) => {
    if (name === "online") {
      onOnline = callback;
    }
  };
  getCapabilities.mockResolvedValue({ server: false });
  stop = await sync.startRuntimeSync();
  expect(apiRequest).not.toHaveBeenCalled();
  getCapabilities.mockResolvedValue({ server: true });
  onOnline();
  await expect.poll(() => imports.length).toBe(1);
  await expect.poll(() => sets.getState().records.length).toBe(1);
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Recovered");
  await sync.flushRuntimeSync();
  await expect
    .poll(
      async () => (await server.getInteractions())[record.slug]?.[1]?.response,
    )
    .toBe("Recovered");
});

it("recovers an empty library after its initial load failed", async () => {
  await server.deleteStudySet(record.id);
  sets.getState().hydrate([], "Study sets could not be loaded.");
  stop = await sync.startRuntimeSync();
  expect(sets.getState()).toMatchObject({
    records: [],
    status: "ready",
    error: null,
  });
});

it("does not combine cards and progress from different server revisions", async () => {
  stop = await sync.startRuntimeSync();
  const changed = { ...rawSet.cards[0], question: "New question?" };
  await server.updateStudySet(record.id, { upsertCards: [changed] });
  const request = apiRequest.getMockImplementation();
  apiRequest.mockImplementation(async (path, options) => ({
    ...(await request(path, options)),
    revision: path === "/api/library" ? 1 : 2,
  }));
  await sync.flushRuntimeSync();
  expect(sets.getState().records[0].rawSet.cards[0].question).toBe(
    "What divides?",
  );
  apiRequest.mockImplementation(async (path, options) => ({
    ...(await request(path, options)),
    revision: 2,
  }));
  await sync.flushRuntimeSync();
  expect(sets.getState().records[0].rawSet.cards[0].question).toBe(
    "New question?",
  );
});

it("recovers a draft before IDB persistence without reviving it over another tab's newer answer", async () => {
  stop = await sync.startRuntimeSync();
  const release = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const holding = globalThis.navigator.locks.request(
    "lumina-runtime-sync",
    async () => {
      entered.resolve();
      await release.promise;
    },
  );
  await entered.promise;
  const storage = await openDB("lumina-sync", 1);
  try {
    interactions
      .getState()
      .setTextResponse(
        record.slug,
        rawSet.cards[0],
        "Interrupted older answer",
      );
    expect(await storage.count("outbox")).toBe(0);
    const pointerKey = `lumina:sync-draft:${JSON.stringify([record.slug, 1])}`;
    const olderId = window.localStorage.getItem(pointerKey);
    expect(
      JSON.parse(
        window.localStorage.getItem(`lumina:sync-operation:${olderId}`),
      ).body.patch.response,
    ).toBe("Interrupted older answer");

    vi.resetModules();
    const reloadedSync = await import("./runtime-sync");
    const reloadedInteractions = (
      await import("@/stores/use-study-interactions-store")
    ).useStudyInteractionsStore;
    (await import("@/stores/use-study-sets-store")).useStudySetsStore
      .getState()
      .hydrate([record]);
    const startingReload = reloadedSync.startRuntimeSync();
    // Capability discovery resolves before the drainer obtains the held lock.
    await Promise.resolve();
    reloadedInteractions
      .getState()
      .setTextResponse(
        record.slug,
        rawSet.cards[0],
        "Newer answer in another tab",
      );
    expect(window.localStorage.getItem(pointerKey)).not.toBe(olderId);
    release.resolve();
    await holding;
    extraStops.push(await startingReload);
    await Promise.all([
      sync.flushRuntimeSync(),
      reloadedSync.flushRuntimeSync(),
    ]);
    expect((await server.getInteractions())[record.slug][1].response).toBe(
      "Newer answer in another tab",
    );
    expect(
      apiRequest.mock.calls
        .filter(
          ([path, options]) =>
            path === "/api/progress" && options?.method === "PATCH",
        )
        .map(([, options]) => options.body.patch.response),
    ).toEqual(["Newer answer in another tab"]);
    // The old page may wake after the new page has acknowledged its answer.
    await sync.flushRuntimeSync();
    expect((await server.getInteractions())[record.slug][1].response).toBe(
      "Newer answer in another tab",
    );
    expect(window.localStorage.getItem(pointerKey)).toHaveLength(36);
    expect(
      window.localStorage.getItem(
        `lumina:sync-operation:${window.localStorage.getItem(pointerKey)}`,
      ),
    ).toBeNull();
  } finally {
    release.resolve();
    await holding;
    storage.close();
  }
});

it("does not revive a failed-storage draft after another tab acknowledges a newer edit", async () => {
  stop = await sync.startRuntimeSync();
  vi.resetModules();
  const otherSync = await import("./runtime-sync");
  const otherInteractions = (
    await import("@/stores/use-study-interactions-store")
  ).useStudyInteractionsStore;
  (await import("@/stores/use-study-sets-store")).useStudySetsStore
    .getState()
    .hydrate([record]);
  extraStops.push(await otherSync.startRuntimeSync());
  const request = apiRequest.getMockImplementation();
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  let firstWrite = true;
  apiRequest.mockImplementation(async (path, options) => {
    if (path === "/api/progress" && options?.method === "PATCH" && firstWrite) {
      firstWrite = false;
      started.resolve();
      await release.promise;
    }
    return request(path, options);
  });
  try {
    otherInteractions
      .getState()
      .setTextResponse(
        record.slug,
        rawSet.cards[0],
        "Initial other-tab answer",
      );
    const syncingOther = otherSync.flushRuntimeSync();
    await started.promise;
    const setItem = window.localStorage.setItem;
    const failedStorage = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation((key, value) => {
        if (key.startsWith("lumina:sync-operation:")) {
          throw new Error("Storage quota exceeded");
        }
        return setItem(key, value);
      });
    interactions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "Older memory fallback");
    failedStorage.mockRestore();
    const syncingOriginal = sync.flushRuntimeSync();
    otherInteractions
      .getState()
      .setTextResponse(record.slug, rawSet.cards[0], "Newest other-tab answer");
    release.resolve();
    await Promise.all([syncingOther, syncingOriginal]);
    expect((await server.getInteractions())[record.slug][1].response).toBe(
      "Newest other-tab answer",
    );
    expect(
      apiRequest.mock.calls
        .filter(
          ([path, options]) =>
            path === "/api/progress" && options?.method === "PATCH",
        )
        .map(([, options]) => options.body.patch.response),
    ).toEqual(["Initial other-tab answer", "Newest other-tab answer"]);
  } finally {
    release.resolve();
  }
});
