import { openDB } from "idb";
import { toast } from "sonner";
import {
  apiRequest,
  getCapabilities,
  newMutationId,
} from "@/lib/runtime-client";
import { localStudySetStorage } from "@/lib/local-study-set-storage";
import { cacheStudySetRecords } from "@/lib/runtime-study-set-storage";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";
import { useStudyFavoritesStore } from "@/stores/use-study-favorites-store";
import { useStudySetsStore } from "@/stores/use-study-sets-store";

let database;
let applying = false;
let flushing;
let flushRequested = false;
let forceRequested = false;
let scheduledFlush;
let localEdit = 0;
let conflictNoticePending = false;
const pendingMutations = new Set();
const draftPrefix = "lumina:sync-draft:";
const operationPrefix = "lumina:sync-operation:";
const unstagedDrafts = new Map();
const draftStorage = () =>
  globalThis.window?.localStorage ?? globalThis.localStorage;

function latestDrafts() {
  const drafts = new Map();
  try {
    const storage = draftStorage();
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(draftPrefix)) {
        const mutationId = storage.getItem(key);
        const draft = JSON.parse(
          storage.getItem(`${operationPrefix}${mutationId}`),
        );
        if (
          draft?.mutationId &&
          draft.entityKey &&
          ["/api/progress", "/api/favorites"].includes(draft.path)
        ) {
          drafts.set(draft.entityKey, draft);
        }
      }
    }
  } catch {
    // IndexedDB still supports the current session when localStorage is blocked.
  }
  for (const [key, draft] of unstagedDrafts) {
    try {
      const currentId = draftStorage().getItem(`${draftPrefix}${key}`);
      if (
        draft.observedPointer !== undefined &&
        currentId !== draft.observedPointer &&
        currentId !== draft.mutationId
      ) {
        // A later cross-tab edit owns the pointer even after its body has been
        // acknowledged and removed. Do not revive this older failed write.
        unstagedDrafts.delete(key);
        continue;
      }
    } catch {
      // Use IndexedDB for the current session when localStorage stays blocked.
    }
    drafts.set(key, draft);
  }
  return [...drafts.values()];
}

async function hasPendingDrafts(storage) {
  for (const draft of latestDrafts()) {
    if (
      (await storage.get("meta", `ack:${draft.entityKey}`)) !== draft.mutationId
    ) {
      return true;
    }
  }
  return false;
}

async function stageLatestDrafts(storage) {
  // Called by the shared drainer before choosing each request. A synchronous
  // per-card pointer bridges reloads that interrupt an IndexedDB transaction.
  // Retain acknowledged pointers: replaying an older tab's draft must never
  // replace a newer edit which another tab has already synchronized.
  const drafts = latestDrafts();
  if (!drafts.length) {
    return;
  }
  const transaction = storage.transaction(["outbox", "meta"], "readwrite");
  const outbox = transaction.objectStore("outbox");
  const meta = transaction.objectStore("meta");
  const items = await outbox.getAll();
  const acknowledged = [];
  let sequence = (await meta.get("outboxSequence")) ?? 0;
  for (const draft of drafts) {
    if ((await meta.get(`ack:${draft.entityKey}`)) === draft.mutationId) {
      acknowledged.push(draft.mutationId);
      continue;
    }
    if (items.some((item) => item.mutationId === draft.mutationId)) {
      continue;
    }
    for (const item of items) {
      if (!item.sent && item.entityKey === draft.entityKey) {
        await outbox.delete(item.mutationId);
        pendingMutations.delete(item.mutationId);
      }
    }
    sequence = Math.max(Date.now(), sequence + 1);
    await outbox.put({ ...draft, sequence });
  }
  await meta.put(sequence, "outboxSequence");
  await transaction.done;
  try {
    for (const mutationId of acknowledged) {
      draftStorage().removeItem(`${operationPrefix}${mutationId}`);
    }
  } catch {
    // Receipts prevent replay even when browser storage cleanup is unavailable.
  }
  for (const draft of drafts) {
    if (unstagedDrafts.get(draft.entityKey)?.mutationId === draft.mutationId) {
      unstagedDrafts.delete(draft.entityKey);
    }
  }
}

async function acknowledgeOperation(storage, item) {
  const transaction = storage.transaction(["outbox", "meta"], "readwrite");
  await transaction.objectStore("outbox").delete(item.mutationId);
  if (item.entityKey) {
    // Acknowledgement never rewrites the latest localStorage pointer: another
    // tab may have replaced it with a newer answer while this request ran.
    await transaction
      .objectStore("meta")
      .put(item.mutationId, `ack:${item.entityKey}`);
  }
  await transaction.done;
  try {
    draftStorage().removeItem(`${operationPrefix}${item.mutationId}`);
  } catch {
    // The durable receipt still prevents replay if storage cleanup fails.
  }
}
let snapshot = { pending: 0, offline: false, error: null };
const listeners = new Set();
function setStatus(patch) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}
export const subscribeRuntimeSync = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getRuntimeSyncSnapshot = () => snapshot;
const db = () =>
  (database ??= openDB("lumina-sync", 1, {
    blocking(_current, _blocked, event) {
      event.target.close();
    },
    upgrade(value) {
      value.createObjectStore("outbox", { keyPath: "mutationId" });
      value.createObjectStore("meta");
    },
  }));

async function migrateBrowserData() {
  const storage = await db();
  let originId = await storage.get("meta", "originId");
  if (!originId) {
    originId = newMutationId();
    await storage.put("meta", originId, "originId");
  }
  if (!(await storage.get("meta", "imported"))) {
    const records = await localStudySetStorage.list();
    await apiRequest("/api/actions", {
      method: "POST",
      body: {
        action: "library.import_browser",
        mutationId: newMutationId(),
        args: {
          originId,
          records,
          interactionsBySet:
            useStudyInteractionsStore.getState().interactionsBySet,
          favorites: useStudyFavoritesStore.getState().favorites,
        },
      },
    });
    await storage.put("meta", true, "imported");
  }
}
export async function refreshRuntimeState() {
  const readEdit = localEdit;
  const recordsBeforeRead = useStudySetsStore.getState().records;
  const [library, progress, favorites] = await Promise.all([
    apiRequest("/api/library"),
    apiRequest("/api/progress"),
    apiRequest("/api/favorites"),
  ]);
  const revisions = [library, progress, favorites]
    .map((value) => value.revision)
    .filter((value) => value !== undefined);
  if (
    new Set(revisions).size > 1 ||
    snapshot.pending ||
    localEdit !== readEdit ||
    useStudySetsStore.getState().records !== recordsBeforeRead ||
    (await (await db()).count("outbox")) ||
    (await hasPendingDrafts(await db()))
  ) {
    return false;
  }
  // The outbox read above is asynchronous: a local edit may arrive during it.
  if (
    snapshot.pending ||
    localEdit !== readEdit ||
    useStudySetsStore.getState().records !== recordsBeforeRead
  ) {
    return false;
  }
  applying = true;
  try {
    useStudyInteractionsStore.setState({
      interactionsBySet: progress.interactionsBySet,
    });
    useStudyFavoritesStore.getState().hydrate(favorites.favorites);
    const sets = useStudySetsStore.getState();
    if (
      sets.status !== "ready" ||
      sets.error ||
      JSON.stringify(recordsBeforeRead) !== JSON.stringify(library.records)
    ) {
      sets.hydrate(library.records);
    }
  } finally {
    applying = false;
  }
  await cacheStudySetRecords(library.records);
  setStatus({ offline: false, error: null });
  if (conflictNoticePending) {
    conflictNoticePending = false;
    toast.info(
      "A study set or card changed. Its outdated answer was not saved.",
      {
        id: "runtime-sync-conflict",
      },
    );
  }
  return true;
}

function scheduleFlush(delay = 350) {
  clearTimeout(scheduledFlush);
  scheduledFlush = setTimeout(() => {
    scheduledFlush = undefined;
    void flushRuntimeSync({ deferText: true });
  }, delay);
}

async function drainOutbox(deferText) {
  const storage = await db();
  await stageLatestDrafts(storage);
  await migrateBrowserData();
  while (true) {
    await stageLatestDrafts(storage);
    const readEdit = localEdit;
    const transaction = storage.transaction("outbox", "readwrite");
    const items = (await transaction.store.getAll()).sort(
      (a, b) => a.sequence - b.sequence,
    );
    if (localEdit === readEdit) {
      pendingMutations.clear();
    }
    for (const item of items) {
      pendingMutations.add(item.mutationId);
    }
    setStatus({ pending: pendingMutations.size });
    const item = items[0];
    if (!item) {
      await transaction.done;
      // Another local draft may have arrived during the durable snapshot read.
      if (localEdit !== readEdit) {
        continue;
      }
      break;
    }
    if (deferText && !forceRequested && item.readyAt > Date.now()) {
      await transaction.done;
      scheduleFlush(item.readyAt - Date.now());
      return;
    }
    // Once a request may have reached the server, preserve its exact body and
    // mutation ID through retries. Only never-sent drafts can be coalesced.
    item.sent = true;
    await transaction.store.put(item);
    await transaction.done;
    try {
      await apiRequest(item.path, { method: item.method, body: item.body });
      await acknowledgeOperation(storage, item);
      pendingMutations.delete(item.mutationId);
      setStatus({ pending: pendingMutations.size, offline: false });
    } catch (error) {
      if ([404, 409, 422].includes(error.status)) {
        conflictNoticePending = true;
        await acknowledgeOperation(storage, item);
        pendingMutations.delete(item.mutationId);
        setStatus({ pending: pendingMutations.size });
        // The snapshot below replaces both the outdated card and its progress.
        continue;
      }
      throw error;
    }
  }
  setStatus({ pending: pendingMutations.size });
  await refreshRuntimeState();
}

export async function flushRuntimeSync({ deferText = false } = {}) {
  if (flushing) {
    flushRequested = true;
    forceRequested ||= !deferText;
    return flushing;
  }
  clearTimeout(scheduledFlush);
  scheduledFlush = undefined;
  flushRequested = false;
  forceRequested = !deferText;
  const drain = () => drainOutbox(deferText);
  // Web Locks coordinate all tabs on this origin, including migration and
  // hydration. IndexedDB transactions still order writes independently.
  const locks = globalThis.navigator?.locks;
  flushing = (locks ? locks.request("lumina-runtime-sync", drain) : drain())
    .catch((error) =>
      setStatus({
        offline: !error.status,
        error: error.status ? error.message : null,
      }),
    )
    .finally(() => {
      flushing = null;
      if (flushRequested && pendingMutations.size && !scheduledFlush) {
        void flushRuntimeSync({ deferText: !forceRequested });
      }
    });
  return flushing;
}

function queue(path, method, body, { textEdit = false } = {}) {
  const mutationId = newMutationId();
  const entityKey =
    path === "/api/progress"
      ? JSON.stringify([body.setId, body.cardId])
      : "favorites";
  const operation = {
    path,
    method,
    mutationId,
    entityKey,
    readyAt: textEdit ? Date.now() + 350 : 0,
    body: { ...body, mutationId },
  };
  // setItem is atomic across tabs. For one card the last user edit owns this
  // pointer, independently of clocks or when asynchronous persistence finishes.
  let previousId;
  try {
    const storage = draftStorage();
    const key = `${draftPrefix}${entityKey}`;
    previousId = storage.getItem(key);
    storage.setItem(
      `${operationPrefix}${mutationId}`,
      JSON.stringify(operation),
    );
    storage.setItem(key, mutationId);
    if (previousId) {
      // The old body is either superseded or already durable in the outbox.
      storage.removeItem(`${operationPrefix}${previousId}`);
    }
  } catch {
    unstagedDrafts.set(entityKey, {
      ...operation,
      observedPointer: previousId,
    });
  }
  localEdit += 1;
  pendingMutations.add(mutationId);
  setStatus({ pending: pendingMutations.size });
  void flushRuntimeSync({ deferText: true });
}

function subscribeChanges() {
  const stopProgress = useStudyInteractionsStore.subscribe(
    (state, previous) => {
      if (applying || state.interactionsBySet === previous.interactionsBySet) {
        return;
      }
      const slugs = new Set([
        ...Object.keys(state.interactionsBySet),
        ...Object.keys(previous.interactionsBySet),
      ]);
      for (const slug of slugs) {
        const nextSet = state.interactionsBySet[slug] || {};
        const previousSet = previous.interactionsBySet[slug] || {};
        for (const cardId of new Set([
          ...Object.keys(nextSet),
          ...Object.keys(previousSet),
        ])) {
          const patch = nextSet[cardId] || {};
          if (
            JSON.stringify(patch) === JSON.stringify(previousSet[cardId] || {})
          ) {
            continue;
          }
          const record = useStudySetsStore
            .getState()
            .records.find((item) => item.slug === slug);
          const card = record?.rawSet.cards.find(
            (item) => String(item.id) === cardId,
          );
          queue(
            "/api/progress",
            "PATCH",
            {
              slug,
              setId: record?.id,
              cardId: Number(cardId),
              patch,
              cardVersion: card ? JSON.stringify(card) : undefined,
            },
            {
              textEdit:
                ["short_answer", "fill_in_the_blank"].includes(card?.type) &&
                patch.response !== previousSet[cardId]?.response,
            },
          );
        }
      }
    },
  );
  const stopFavorites = useStudyFavoritesStore.subscribe((state, previous) => {
    if (
      !applying &&
      JSON.stringify(state.favorites) !== JSON.stringify(previous.favorites)
    ) {
      queue("/api/favorites", "PUT", { favorites: state.favorites });
    }
  });
  return () => {
    stopProgress();
    stopFavorites();
  };
}

let runtimeUsers = 0;
let starting;
let stopRuntime;
export async function startRuntimeSync() {
  runtimeUsers += 1;
  if (!starting) {
    let stopped = false;
    let unsubscribe;
    const sync = async (refreshCapabilities = false) => {
      const capabilities = await getCapabilities({
        refresh: refreshCapabilities,
      });
      if (stopped || !capabilities.server) {
        return;
      }
      unsubscribe ??= subscribeChanges();
      await flushRuntimeSync();
    };
    const onOnline = () => void sync(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sync();
      }
    };
    window.addEventListener("online", onOnline);
    document.addEventListener?.("visibilitychange", onVisibility);
    const poll = setInterval(onVisibility, 5000);
    stopRuntime = () => {
      stopped = true;
      unsubscribe?.();
      clearInterval(poll);
      clearTimeout(scheduledFlush);
      window.removeEventListener("online", onOnline);
      document.removeEventListener?.("visibilitychange", onVisibility);
    };
    starting = sync();
  }
  await starting;
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    runtimeUsers -= 1;
    if (!runtimeUsers) {
      stopRuntime();
      starting = null;
    }
  };
}

export async function flushRuntimeSyncForSignOut() {
  try {
    await starting;
    // Force text drafts past the debounce and await any drain already in flight.
    // Each drain stages the shared localStorage pointers, including other tabs.
    while (true) {
      await flushRuntimeSync();
      while (flushing) {
        await flushing;
      }
      const storage = await db();
      const pending =
        pendingMutations.size ||
        (await storage.count("outbox")) ||
        (await hasPendingDrafts(storage));
      if (!pending) {
        return;
      }
      if (snapshot.offline || snapshot.error) {
        throw new Error(snapshot.error || "Reconnect and try again.");
      }
      // A draft may have arrived during the final read, or an earlier debounced
      // drain may already have scheduled a timer. Force that work before logout.
    }
  } catch (cause) {
    throw Object.assign(
      new Error(
        `Your changes could not be verified as synced. Sign-out was stopped to keep them on this device. ${cause.message}`,
        { cause },
      ),
      { code: "UNSYNCED_CHANGES" },
    );
  }
}

export async function readPendingRuntimeChanges() {
  const read = async () => {
    const storage = await db();
    await stageLatestDrafts(storage);
    const operations = (await storage.getAll("outbox"))
      .sort((a, b) => a.sequence - b.sequence)
      .map(({ path, method, body }) => ({ path, method, body }));
    const slugs = new Set(operations.map((operation) => operation.body.slug));
    return {
      format: "lumina-unsynced-changes",
      version: 1,
      exportedAt: new Date().toISOString(),
      description:
        "Recovery copy of unsynced changes, not a study-set import file.",
      operations,
      cachedSets: useStudySetsStore
        .getState()
        .records.filter((record) => slugs.has(record.slug))
        .map((record) => ({
          id: record.id,
          slug: record.slug,
          title: record.rawSet.title,
          category: record.rawSet.category,
        })),
    };
  };
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request("lumina-runtime-sync", read) : read();
}

export async function stopRuntimeSyncForSignOut() {
  stopRuntime?.();
  await Promise.allSettled([starting, flushing].filter(Boolean));
  stopRuntime?.();
  const connection = await database?.catch(() => null);
  connection?.close();
  database = undefined;
  unstagedDrafts.clear();
  pendingMutations.clear();
}
