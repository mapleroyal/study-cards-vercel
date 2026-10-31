import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestStore } from "../../server/test-helpers/store.mjs";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/runtime-client", () => ({
  apiRequest,
  getCapabilities: async () => ({ server: true }),
  newMutationId: () => globalThis.crypto.randomUUID(),
}));
import { runtimeStudySetStorage } from "./runtime-study-set-storage";

let server;
const rawSet = {
  title: "Biology",
  category: "Science",
  cards: [
    {
      id: 1,
      type: "short_answer",
      question: "Question?",
      answer: "Answer",
      explanation: "Explanation.",
    },
  ],
};
beforeEach(() => {
  server = createTestStore();
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === "/api/library") {
      return { records: await server.listStudySets() };
    }
    const { action, args, mutationId, expectedRevision } = options.body;
    if (action === "study_set.create") {
      return server.createStudySet(args.rawSet, { mutationId });
    }
    if (action === "study_set.update") {
      return server.updateStudySet(args.id, args.patch, {
        mutationId,
        expectedRevision,
      });
    }
    throw new Error(`Unexpected action ${action}`);
  });
});
afterEach(() => server.close());

it("imports a distinct colliding deck without overwriting the original or its answers", async () => {
  const original = (await server.createStudySet(rawSet)).record;
  await server.setInteraction(original.id, 1, { response: "Saved response" });
  const changedSet = {
    ...rawSet,
    cards: [{ ...rawSet.cards[0], question: "Different question?" }],
  };
  const { record } = await runtimeStudySetStorage.upsert(changedSet);
  expect(record.id).not.toBe(original.id);
  expect(record.slug).toBe(`${original.slug}-2`);
  expect((await server.getStudySet(original.id)).rawSet).toEqual(rawSet);
  expect((await server.getInteractions())[original.slug][1].response).toBe(
    "Saved response",
  );
  expect(await server.listStudySets()).toHaveLength(2);
});

it("replaces the existing record only when explicitly requested", async () => {
  const original = (await server.createStudySet(rawSet)).record;
  const changedSet = {
    ...rawSet,
    cards: [{ ...rawSet.cards[0], question: "Updated question?" }],
  };
  const { record } = await runtimeStudySetStorage.upsert(changedSet, {
    replaceExisting: true,
  });
  expect(record.id).toBe(original.id);
  expect((await server.getStudySet(original.id)).rawSet).toEqual(changedSet);
  expect(await server.listStudySets()).toHaveLength(1);
});
