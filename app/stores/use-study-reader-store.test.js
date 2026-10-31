import { describe, expect, it } from "vitest";

import { STUDY_READER_STORAGE_KEY } from "@/lib/app-config";
import {
  createStudyReaderStore,
  getOrderedStudyCards,
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
  { id: 0, question: "First?" },
  { id: 1, question: "Second?" },
  { id: 2, question: "Third?" },
];

describe("reader preferences", () => {
  it("persists shuffled card IDs independently for each set and restores the original order", () => {
    const storage = createMemoryStorage();
    const store = createStudyReaderStore({ storage, random: () => 0.99 });
    store.getState().shuffleQuestions("first", cards);
    store.getState().shuffleQuestions("second", cards.slice(0, 2));
    const firstOrder = store.getState().questionOrders.first;
    expect(firstOrder).not.toEqual(cards.map((card) => card.id));
    expect(getOrderedStudyCards(cards, firstOrder)).toHaveLength(cards.length);
    expect(new Set(firstOrder)).toEqual(new Set(cards.map((card) => card.id)));
    expect(cards.map((card) => card.id)).toEqual([0, 1, 2]);

    const reloaded = createStudyReaderStore({ storage, random: () => 0.99 });
    expect(reloaded.getState().questionOrders.first).toEqual(firstOrder);
    reloaded.getState().shuffleQuestions("first", cards);
    expect(reloaded.getState().questionOrders.first).not.toEqual(firstOrder);
    reloaded.getState().resetQuestionOrder("first");
    expect(
      getOrderedStudyCards(cards, reloaded.getState().questionOrders.first),
    ).toBe(cards);
    expect(reloaded.getState().questionOrders.second).toEqual([1, 0]);
    expect(
      JSON.parse(storage.getItem(STUDY_READER_STORAGE_KEY)).questionOrders,
    ).not.toHaveProperty("first");
  });

  it("reconciles edits without duplicating cards or losing new cards", () => {
    const editedCards = [
      cards[0],
      { id: 2, question: "Revised third?" },
      { id: 3, question: "New?" },
    ];
    const ordered = getOrderedStudyCards(editedCards, [2, 1, 2, 0]);
    expect(ordered.map((card) => card.id)).toEqual([2, 0, 3]);
    expect(ordered[0]).toBe(editedCards[1]);
    expect(ordered[1]).toBe(cards[0]);
  });

  it("persists a valid matching mode and sanitizes malformed saved card IDs", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        matchingMode: "invalid",
        questionOrders: { first: [0, 2, 2, -1, "1", null], invalid: false },
      }),
    );
    const store = createStudyReaderStore({ storage });
    expect(store.getState().matchingMode).toBe("drag");
    expect(store.getState().questionOrders).toEqual({ first: [0, 2] });
    store.getState().setMatchingMode("menus");
    store.getState().setMatchingMode("");
    expect(createStudyReaderStore({ storage }).getState().matchingMode).toBe(
      "menus",
    );
  });

  it("keeps controls usable when saved data or browser storage is unavailable", () => {
    expect(
      createStudyReaderStore({ storage: createMemoryStorage("{") }).getState()
        .questionOrders,
    ).toEqual({});
    const unavailableStorage = {
      getItem: () => {
        throw new Error("Storage unavailable");
      },
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    };
    const store = createStudyReaderStore({ storage: unavailableStorage });
    store.getState().setMatchingMode("menus");
    store.getState().shuffleQuestions("first", cards);
    expect(store.getState().matchingMode).toBe("menus");
    expect(store.getState().questionOrders.first).toHaveLength(3);
  });
});
