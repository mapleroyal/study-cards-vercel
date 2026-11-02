import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  request: vi.fn(),
  mutationId: vi.fn(),
  notify: vi.fn(),
  navigate: vi.fn(),
  store: null,
}));
vi.mock("@/lib/runtime-client", () => ({
  apiRequest: fixture.request,
  newMutationId: fixture.mutationId,
  getCapabilities: async () => ({ server: true }),
  useCapabilities: () => ({ server: true }),
}));
vi.mock("@/lib/runtime-sync", () => ({
  flushRuntimeSync: async () => {},
  refreshRuntimeState: async () => true,
  getRuntimeSyncSnapshot: () => ({ pending: 0 }),
}));
vi.mock("@/components/ui/toast", () => ({
  toast: { add: fixture.notify },
}));
vi.mock("react-router", () => ({
  useNavigate: () => fixture.navigate,
}));
vi.mock("@/stores/use-study-sets-store", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useStudySetsStore: Object.assign(
      (selector) => selector(fixture.store.getState()),
      { getState: () => fixture.store.getState() },
    ),
  };
});
import { createStudySetsStore } from "@/stores/use-study-sets-store";
import { useStudyLibraryActions } from "./use-study-library-actions";

function record(id) {
  return {
    id,
    slug: id,
    revision: 1,
    rawSet: {
      title: id,
      category: "Review",
      cards: [
        {
          id: 1,
          type: "true_false",
          question: "Question?",
          answer: true,
          explanation: "Explanation.",
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  let sequence = 0;
  fixture.mutationId.mockImplementation(() => `mutation-${++sequence}`);
  fixture.store = createStudySetsStore({
    studyInteractionsStore: { getState: () => ({ resetSet: vi.fn() }) },
    studyReaderStore: { getState: () => ({ resetQuestionOrder: vi.fn() }) },
  });
});

it("each overlapping delete keeps its own Undo receipt when refreshes finish out of order", async () => {
  let records = [record("set-a"), record("set-b")];
  const deleted = new Map();
  const undone = [];
  let firstDeleteDone = false;
  let held = false;
  let releaseRefresh;
  let announceRefresh;
  const firstRefreshStarted = new Promise((resolve) => {
    announceRefresh = resolve;
  });
  const firstRefresh = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  fixture.request.mockImplementation(async (path, options = {}) => {
    if (path === "/api/library") {
      if (firstDeleteDone && !held) {
        held = true;
        announceRefresh();
        await firstRefresh;
      }
      return { records: globalThis.structuredClone(records) };
    }
    const { action, args, mutationId, expectedRevision } = options.body;
    if (action === "study_set.delete") {
      const target = records.find((item) => item.id === args.id);
      expect(expectedRevision).toBe(target.revision);
      records = records.filter((item) => item.id !== args.id);
      deleted.set(args.id, mutationId);
      firstDeleteDone = true;
      return { mutationId, revision: 2 };
    }
    expect(action).toBe("library.undo");
    undone.push(args.mutationId);
    return { mutationId, revision: 3 };
  });
  const actions = useStudyLibraryActions();
  const first = actions.deleteSet("set-a");
  await firstRefreshStarted;
  await actions.deleteSet("set-b");
  releaseRefresh();
  await first;
  expect(fixture.notify).toHaveBeenCalledTimes(2);
  // B's refresh finishes first, so its notification precedes A's.
  await fixture.notify.mock.calls[0][0].actionProps.onClick();
  await fixture.notify.mock.calls[1][0].actionProps.onClick();
  expect(undone).toEqual([deleted.get("set-b"), deleted.get("set-a")]);
});

it("a stale-row no-op cannot offer Undo for a previous deletion and keeps the records-array API", async () => {
  let records = [record("set-a")];
  let deletes = 0;
  fixture.request.mockImplementation(async (path, options = {}) => {
    if (path === "/api/library") {
      return { records: globalThis.structuredClone(records) };
    }
    expect(options.body.action).toBe("study_set.delete");
    deletes++;
    records = [];
    return { mutationId: options.body.mutationId, revision: 2 };
  });
  const actions = useStudyLibraryActions();
  await actions.deleteSet("set-a");
  expect(fixture.notify).toHaveBeenCalledTimes(1);
  fixture.notify.mockClear();
  await actions.deleteSet("set-a");
  expect(fixture.notify).not.toHaveBeenCalled();
  const onDeleted = vi.fn();
  const remaining = await fixture.store
    .getState()
    .deleteStudySet("set-a", { onDeleted });
  expect(remaining).toEqual([]);
  expect(Array.isArray(remaining)).toBe(true);
  expect(onDeleted).not.toHaveBeenCalled();
  expect(deletes).toBe(1);
});
