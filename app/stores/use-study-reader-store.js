import { create } from "zustand";

import { STUDY_READER_STORAGE_KEY } from "@/lib/app-config";
import { randomizeValues } from "@/lib/study-set-answer-order";

function readPreferences(storage) {
  try {
    return JSON.parse(
      (storage ?? globalThis.window?.localStorage)?.getItem(
        STUDY_READER_STORAGE_KEY,
      ) ?? "null",
    );
  } catch {
    return null;
  }
}

function normalizeQuestionOrders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, ids]) => Array.isArray(ids))
      .map(([slug, ids]) => [
        slug,
        [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id >= 0))],
      ]),
  );
}

export function getOrderedStudyCards(cards, questionOrder) {
  if (!questionOrder?.length) {
    return cards;
  }
  const remainingCards = new Map(cards.map((card) => [card.id, card]));
  const orderedCards = [];
  for (const id of questionOrder) {
    const card = remainingCards.get(id);
    if (card) {
      orderedCards.push(card);
      remainingCards.delete(id);
    }
  }
  return [...orderedCards, ...remainingCards.values()];
}

export function createStudyReaderStore({ storage, random = Math.random } = {}) {
  const preferences = readPreferences(storage);
  return create((set, get) => {
    function updatePreferences(patch) {
      set(patch);
      const { matchingMode, questionOrders } = get();
      try {
        (storage ?? globalThis.window?.localStorage)?.setItem(
          STUDY_READER_STORAGE_KEY,
          JSON.stringify({ matchingMode, questionOrders }),
        );
      } catch {
        // Reading and studying remain available without browser storage.
      }
    }

    return {
      matchingMode: preferences?.matchingMode === "menus" ? "menus" : "drag",
      questionOrders: normalizeQuestionOrders(preferences?.questionOrders),
      setMatchingMode: (matchingMode) => {
        if (matchingMode === "drag" || matchingMode === "menus") {
          updatePreferences({ matchingMode });
        }
      },
      shuffleQuestions: (setSlug, cards) => {
        const { questionOrders } = get();
        const orderedCards = getOrderedStudyCards(
          cards,
          questionOrders[setSlug],
        );
        updatePreferences({
          questionOrders: {
            ...questionOrders,
            [setSlug]: randomizeValues(
              orderedCards.map((card) => card.id),
              random,
            ),
          },
        });
      },
      resetQuestionOrder: (setSlug) => {
        const questionOrders = { ...get().questionOrders };
        delete questionOrders[setSlug];
        updatePreferences({ questionOrders });
      },
    };
  });
}

export const useStudyReaderStore = createStudyReaderStore();
