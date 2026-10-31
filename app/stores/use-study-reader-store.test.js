import { describe, expect, it } from "vitest";
import { STUDY_READER_STORAGE_KEY } from "@/lib/app-config";
import {
  createStudyReaderStore,
  getOrderedStudyCards,
  isShuffleEnabled,
} from "./use-study-reader-store";

function createMemoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue;
    },
  };
}
const cards = [
  { id: 0, type: "true_false", question: "First?" },
  { id: 1, type: "true_false", question: "Second?" },
  { id: 2, type: "multiple_choice", question: "Third?" },
  { id: 3, type: "multiple_choice", question: "Fourth?" },
];

describe("reader preferences", () => {
  it("defaults to balanced shuffle and preserves its exact order across reloads and text edits", () => {
    const storage = createMemoryStorage();
    const store = createStudyReaderStore({ storage, random: () => 0 });
    expect(isShuffleEnabled(store.getState(), "first")).toBe(true);
    store.getState().ensureQuestionOrder("first", cards);
    const order = store.getState().questionOrders.first;
    expect(new Set(order)).toEqual(new Set([0, 1, 2, 3]));
    const reloaded = createStudyReaderStore({
      storage,
      random: () => {
        throw new Error("Must not reshuffle");
      },
    });
    reloaded
      .getState()
      .ensureQuestionOrder(
        "first",
        cards.map((card) => ({ ...card, question: "Edited" })).reverse(),
      );
    expect(reloaded.getState().questionOrders.first).toEqual(order);
    reloaded.getState().setMatchingMode("menus");
    expect(reloaded.getState().questionOrders.first).toEqual(order);
    expect(cards.map((card) => card.id)).toEqual([0, 1, 2, 3]);
  });

  it("changes one set independently, restores source order when off, and reuses the saved shuffle when on", () => {
    const storage = createMemoryStorage();
    const store = createStudyReaderStore({ storage, random: () => 0 });
    store.getState().ensureQuestionOrder("first", cards);
    const order = store.getState().questionOrders.first;
    store.getState().setShuffleEnabled("first", false, cards);
    expect(isShuffleEnabled(store.getState(), "first")).toBe(false);
    expect(isShuffleEnabled(store.getState(), "second")).toBe(true);
    expect(
      getOrderedStudyCards(
        cards,
        isShuffleEnabled(store.getState(), "first") ? order : undefined,
      ),
    ).toBe(cards);
    const reloaded = createStudyReaderStore({ storage, random: () => 0.99 });
    expect(isShuffleEnabled(reloaded.getState(), "first")).toBe(false);
    reloaded.getState().setShuffleEnabled("first", true, cards);
    expect(reloaded.getState().questionOrders.first).toEqual(order);
  });

  it("applies each global setting to all existing and future sets and clears overrides even for the same value", () => {
    const store = createStudyReaderStore({
      storage: createMemoryStorage(),
      random: () => 0,
    });
    store.getState().setShuffleEnabled("first", false, cards);
    store.getState().setDefaultShuffleEnabled(false);
    expect(store.getState().shuffleOverrides).toEqual({});
    expect(isShuffleEnabled(store.getState(), "first")).toBe(false);
    expect(isShuffleEnabled(store.getState(), "future")).toBe(false);
    store.getState().setShuffleEnabled("first", true, cards);
    expect(isShuffleEnabled(store.getState(), "first")).toBe(true);
    expect(isShuffleEnabled(store.getState(), "second")).toBe(false);
    store.getState().setDefaultShuffleEnabled(false);
    expect(isShuffleEnabled(store.getState(), "first")).toBe(false);
    store.getState().setShuffleEnabled("second", false, cards);
    store.getState().setDefaultShuffleEnabled(true);
    expect(store.getState().shuffleOverrides).toEqual({});
    expect(isShuffleEnabled(store.getState(), "first")).toBe(true);
    expect(isShuffleEnabled(store.getState(), "second")).toBe(true);
  });

  it("reconciles edits and deletion without duplicates or lost cards", () => {
    const store = createStudyReaderStore({
      storage: createMemoryStorage(),
      random: () => 0,
    });
    store.getState().ensureQuestionOrder("first", cards);
    const editedCards = [
      cards[0],
      { ...cards[2], question: "Revised third?" },
      { id: 4, type: "true_false", question: "New?" },
    ];
    store.getState().ensureQuestionOrder("first", editedCards);
    const ordered = getOrderedStudyCards(
      editedCards,
      store.getState().questionOrders.first,
    );
    expect(new Set(ordered.map((card) => card.id))).toEqual(new Set([0, 2, 4]));
    expect(ordered.find((card) => card.id === 2)).toBe(editedCards[1]);
    store.getState().setShuffleEnabled("first", false, editedCards);
    store.getState().resetQuestionOrder("first");
    expect(store.getState().questionOrders).not.toHaveProperty("first");
    expect(store.getState().questionOrderSignatures).not.toHaveProperty(
      "first",
    );
    expect(store.getState().shuffleOverrides).not.toHaveProperty("first");
    expect(
      getOrderedStudyCards(editedCards, [2, 1, 2, 0]).map((card) => card.id),
    ).toEqual([2, 0, 4]);
  });

  it("synchronizes persisted preferences and exact orders through browser storage events", () => {
    const storage = createMemoryStorage();
    const firstEvents = new globalThis.EventTarget();
    const secondEvents = new globalThis.EventTarget();
    const first = createStudyReaderStore({
      storage,
      random: () => 0,
      eventTarget: firstEvents,
    });
    const second = createStudyReaderStore({
      storage,
      random: () => 0.99,
      eventTarget: secondEvents,
    });
    const notify = (target) =>
      target.dispatchEvent(
        Object.assign(new globalThis.Event("storage"), {
          key: STUDY_READER_STORAGE_KEY,
        }),
      );
    first.getState().ensureQuestionOrder("first", cards);
    notify(secondEvents);
    expect(second.getState().questionOrders.first).toEqual(
      first.getState().questionOrders.first,
    );
    second.getState().setShuffleEnabled("first", false, cards);
    notify(firstEvents);
    expect(isShuffleEnabled(first.getState(), "first")).toBe(false);
    first.getState().setDefaultShuffleEnabled(true);
    notify(secondEvents);
    expect(isShuffleEnabled(second.getState(), "first")).toBe(true);
    expect(second.getState().shuffleOverrides).toEqual({});
    first.stopStorageSync();
    second.stopStorageSync();
  });

  it("supports set slugs that match object property names", () => {
    const store = createStudyReaderStore({
      storage: createMemoryStorage(),
      random: () => 0,
    });
    for (const slug of ["constructor", "__proto__"]) {
      expect(isShuffleEnabled(store.getState(), slug)).toBe(true);
      store.getState().ensureQuestionOrder(slug, cards);
      expect(store.getState().questionOrders[slug]).toHaveLength(cards.length);
      store.getState().setDefaultShuffleEnabled(false);
      expect(isShuffleEnabled(store.getState(), slug)).toBe(false);
      store.getState().setShuffleEnabled(slug, true, cards);
      expect(isShuffleEnabled(store.getState(), slug)).toBe(true);
      store.getState().setDefaultShuffleEnabled(true);
    }
  });

  it("sanitizes stored preferences and keeps controls usable when storage is unavailable", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        matchingMode: "invalid",
        defaultShuffleEnabled: "false",
        shuffleOverrides: { first: false, invalid: "false" },
        questionOrders: { first: [0, 2, 2, -1, "1", null], invalid: false },
      }),
    );
    const store = createStudyReaderStore({ storage });
    expect(store.getState().matchingMode).toBe("drag");
    expect(store.getState().defaultShuffleEnabled).toBe(true);
    expect(store.getState().shuffleOverrides).toEqual({ first: false });
    expect(store.getState().questionOrders).toEqual({ first: [0, 2] });
    store.getState().setMatchingMode("menus");
    store.getState().setMatchingMode("");
    expect(createStudyReaderStore({ storage }).getState().matchingMode).toBe(
      "menus",
    );
    expect(
      createStudyReaderStore({ storage: createMemoryStorage("{") }).getState()
        .questionOrders,
    ).toEqual({});
    const unavailable = createStudyReaderStore({
      storage: {
        getItem: () => {
          throw new Error("Unavailable");
        },
        setItem: () => {
          throw new Error("Unavailable");
        },
      },
    });
    unavailable.getState().ensureQuestionOrder("first", cards);
    unavailable.getState().setShuffleEnabled("first", false, cards);
    expect(isShuffleEnabled(unavailable.getState(), "first")).toBe(false);
    expect(unavailable.getState().questionOrders.first).toHaveLength(4);
  });
});
