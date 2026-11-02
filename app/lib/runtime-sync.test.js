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
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastInfo } }));
vi.mock("@/lib/runtime-client", () => ({
  apiRequest,
  getCapabilities,
  newMutationId: () => globalThis.crypto.randomUUID(),
}));
vi.mock("@/lib/local-study-set-storage", () => ({
  localStudySetStorage: { list: listBrowserRecords },
  StudySetConflictError: class extends Error {},
  closeLocalStudySetDatabase: async () => {},
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
  const locks = new Map();
  vi.stubGlobal("navigator", {
    locks: {
      request: (name, callback) => {
        const result = (locks.get(name) || Promise.resolve()).then(callback);
        locks.set(
          name,
          result.catch(() => {}),
        );
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
      clear: () => values.clear(),
    },
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal("localStorage", window.localStorage);
  vi.stubGlobal("sessionStorage", { clear: vi.fn() });
  vi.stubGlobal("location", { replace: vi.fn() });
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
        const { slug, setId, cardId, patch, mutationId, cardVersion } =
          options.body;
        if (typeof setId !== "string" || !setId) {
          throw Object.assign(
            new Error(
              "A pending answer from an older app version needs review. Your draft remains saved on this device.",
            ),
            { status: 428 },
          );
        }
        return server.setInteraction(slug, cardId, patch, {
          mutationId,
          setId,
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
    if (path === "/api/session" && options.method === "DELETE") {
      return { ok: true };
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
    const pointerKey = `lumina:sync-draft:${JSON.stringify([record.id, 1])}`;
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

it("does not attach a queued answer to an identical replacement set with the same slug", async () => {
  stop = await sync.startRuntimeSync();
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Old set answer");
  await server.deleteStudySet(record.id);
  const replacement = (await server.createStudySet(rawSet)).record;
  expect(replacement.slug).toBe(record.slug);
  expect(replacement.id).not.toBe(record.id);
  await sync.flushRuntimeSync();
  expect(await server.getInteractions()).toEqual({});
  expect(interactions.getState().interactionsBySet).toEqual({});
  expect(sets.getState().records[0].id).toBe(replacement.id);
  const body = apiRequest.mock.calls.find(
    ([path, options]) =>
      path === "/api/progress" && options?.method === "PATCH",
  )[1].body;
  expect(body.setId).toBe(record.id);
  expect(toastInfo).toHaveBeenCalledOnce();
});

it("flushes a debounced answer before signing out and clearing private browser storage", async () => {
  stop = await sync.startRuntimeSync();
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Answer before logout");
  const { signOut } = await import("./sign-out");
  await signOut();
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "Answer before logout",
  );
  const calls = apiRequest.mock.calls;
  const writeIndex = calls.findIndex(
    ([path, options]) =>
      path === "/api/progress" && options?.method === "PATCH",
  );
  const logoutIndex = calls.findIndex(([path]) => path === "/api/session");
  expect(writeIndex).toBeGreaterThanOrEqual(0);
  expect(logoutIndex).toBeGreaterThan(writeIndex);
  expect(globalThis.localStorage.length).toBe(0);
  expect(globalThis.sessionStorage.clear).toHaveBeenCalledOnce();
  expect(globalThis.location.replace).toHaveBeenCalledWith("/login");
});

it("keeps unsynced answers and the session when sign-out cannot drain the outbox", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  apiRequest.mockImplementation((path, options) =>
    path === "/api/progress" && options?.method === "PATCH"
      ? Promise.reject(Object.assign(new Error("Unavailable"), { status: 503 }))
      : request(path, options),
  );
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Still on this device");
  const { signOut } = await import("./sign-out");
  await expect(signOut()).rejects.toThrow(/Sign-out was stopped/);
  expect(apiRequest.mock.calls.some(([path]) => path === "/api/session")).toBe(
    false,
  );
  expect(globalThis.location.replace).not.toHaveBeenCalled();
  expect(globalThis.sessionStorage.clear).not.toHaveBeenCalled();
  const storage = await openDB("lumina-sync", 1);
  expect((await storage.getAll("outbox"))[0].body.patch.response).toBe(
    "Still on this device",
  );
  storage.close();
  expect(
    interactions.getState().interactionsBySet[record.slug][1].response,
  ).toBe("Still on this device");
  apiRequest.mockImplementation(request);
  await signOut();
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "Still on this device",
  );
  expect(globalThis.location.replace).toHaveBeenCalledWith("/login");
});

it("waits for an in-flight answer and a newer draft before deleting the session", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  let held = false;
  apiRequest.mockImplementation(async (path, options) => {
    if (path === "/api/progress" && options?.method === "PATCH" && !held) {
      held = true;
      entered.resolve();
      await release.promise;
    }
    return request(path, options);
  });
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "First answer");
  const flushing = sync.flushRuntimeSync();
  await entered.promise;
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Newer answer");
  const { signOut } = await import("./sign-out");
  const signingOut = signOut();
  expect(apiRequest.mock.calls.some(([path]) => path === "/api/session")).toBe(
    false,
  );
  release.resolve();
  await Promise.all([flushing, signingOut]);
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "Newer answer",
  );
  expect(globalThis.location.replace).toHaveBeenCalledWith("/login");
});

it("flushes another tab's shared draft before sign-out preparation completes", async () => {
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
  otherInteractions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Other tab answer");
  await sync.flushRuntimeSyncForSignOut();
  expect((await server.getInteractions())[record.slug][1].response).toBe(
    "Other tab answer",
  );
  const storage = await openDB("lumina-sync", 1);
  expect(await storage.count("outbox")).toBe(0);
  storage.close();
});

it("preserves an older queued answer without identity rather than rebinding or silently dropping it", async () => {
  stop = await sync.startRuntimeSync();
  const storage = await openDB("lumina-sync", 1);
  const mutationId = globalThis.crypto.randomUUID();
  const legacy = {
    path: "/api/progress",
    method: "PATCH",
    mutationId,
    entityKey: JSON.stringify([record.slug, 1]),
    sequence: 1,
    body: {
      slug: record.slug,
      cardId: 1,
      patch: { response: "Older offline answer" },
      cardVersion: JSON.stringify(rawSet.cards[0]),
      mutationId,
    },
  };
  await storage.put("outbox", legacy);
  await server.deleteStudySet(record.id);
  const replacement = (await server.createStudySet(rawSet)).record;
  expect(replacement.slug).toBe(record.slug);
  await sync.flushRuntimeSync();
  expect(await server.getInteractions()).toEqual({});
  expect((await storage.getAll("outbox"))[0].body).toEqual(legacy.body);
  expect(sync.getRuntimeSyncSnapshot()).toMatchObject({
    pending: 1,
    error: expect.stringMatching(/older app version needs review/),
  });
  expect(toastInfo).not.toHaveBeenCalled();
  const { signOut } = await import("./sign-out");
  await expect(signOut()).rejects.toThrow(/Sign-out was stopped/);
  expect(apiRequest.mock.calls.some(([path]) => path === "/api/session")).toBe(
    false,
  );
  storage.close();
});

it("exports an identity-bearing recovery copy without clearing or rebinding queued changes", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  apiRequest.mockImplementation((path, options) =>
    path === "/api/progress" && options?.method === "PATCH"
      ? Promise.reject(Object.assign(new Error("Unavailable"), { status: 503 }))
      : request(path, options),
  );
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Recover this answer");
  await sync.flushRuntimeSync();
  const storage = await openDB("lumina-sync", 1);
  const before = await storage.getAll("outbox");
  const recovery = await sync.readPendingRuntimeChanges();
  expect(recovery).toMatchObject({
    format: "lumina-unsynced-changes",
    version: 1,
    operations: [
      {
        path: "/api/progress",
        method: "PATCH",
        body: {
          setId: record.id,
          slug: record.slug,
          cardId: 1,
          cardVersion: JSON.stringify(record.rawSet.cards[0]),
          patch: { response: "Recover this answer" },
        },
      },
    ],
    cachedSets: [
      {
        id: record.id,
        slug: record.slug,
        title: rawSet.title,
        category: rawSet.category,
      },
    ],
  });
  expect(Object.keys(recovery).sort()).toEqual([
    "cachedSets",
    "description",
    "exportedAt",
    "format",
    "operations",
    "version",
  ]);
  expect(recovery.description).toMatch(/not a study-set import file/);
  expect(await storage.getAll("outbox")).toEqual(before);
  expect(await server.getInteractions()).toEqual({});
  storage.close();
});

it("discards pending changes only through the explicit option and only after logout succeeds", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  let rejectLogout = true;
  apiRequest.mockImplementation((path, options) => {
    if (path === "/api/progress" && options?.method === "PATCH") {
      throw Object.assign(new Error("Unavailable"), { status: 503 });
    }
    if (path === "/api/session" && rejectLogout) {
      throw Object.assign(new Error("Logout unavailable"), { status: 503 });
    }
    return request(path, options);
  });
  interactions
    .getState()
    .setTextResponse(record.slug, rawSet.cards[0], "Pending discarded answer");
  const { signOut } = await import("./sign-out");
  await expect(signOut()).rejects.toMatchObject({ code: "UNSYNCED_CHANGES" });
  await expect(signOut({ discardUnsynced: true })).rejects.toThrow(
    "Logout unavailable",
  );
  expect(globalThis.location.replace).not.toHaveBeenCalled();
  expect(globalThis.sessionStorage.clear).not.toHaveBeenCalled();
  const storage = await openDB("lumina-sync", 1);
  expect((await storage.getAll("outbox"))[0].body.patch.response).toBe(
    "Pending discarded answer",
  );
  storage.close();
  rejectLogout = false;
  await signOut({ discardUnsynced: true });
  expect(await server.getInteractions()).toEqual({});
  expect(globalThis.localStorage.length).toBe(0);
  expect(globalThis.sessionStorage.clear).toHaveBeenCalledOnce();
  expect(globalThis.location.replace).toHaveBeenCalledWith("/login");
});

it("shares a pending sign-out operation so repeated clicks cannot delete the session twice", async () => {
  stop = await sync.startRuntimeSync();
  const request = apiRequest.getMockImplementation();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  apiRequest.mockImplementation(async (path, options) => {
    if (path === "/api/session") {
      entered.resolve();
      await release.promise;
    }
    return request(path, options);
  });
  const { signOut } = await import("./sign-out");
  const first = signOut();
  await entered.promise;
  const duplicate = signOut();
  expect(duplicate).toBe(first);
  release.resolve();
  await Promise.all([first, duplicate]);
  expect(
    apiRequest.mock.calls.filter(([path]) => path === "/api/session"),
  ).toHaveLength(1);
});

it("can sign out with no pending changes before the runtime subscription starts", async () => {
  const { signOut } = await import("./sign-out");
  await signOut();
  expect(globalThis.location.replace).toHaveBeenCalledWith("/login");
  expect(
    apiRequest.mock.calls.filter(([path]) => path === "/api/session"),
  ).toHaveLength(1);
});

it("preserves the session and recovery choice if browser storage cannot be inspected", async () => {
  vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
    throw new Error("Browser storage unavailable");
  });
  const { signOut } = await import("./sign-out");
  await expect(signOut()).rejects.toMatchObject({
    code: "UNSYNCED_CHANGES",
    message: expect.stringMatching(/storage unavailable/),
  });
  expect(apiRequest.mock.calls.some(([path]) => path === "/api/session")).toBe(
    false,
  );
  expect(globalThis.location.replace).not.toHaveBeenCalled();
  expect(globalThis.sessionStorage.clear).not.toHaveBeenCalled();
});
