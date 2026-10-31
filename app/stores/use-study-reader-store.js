import { create } from "zustand";

import { STUDY_READER_STORAGE_KEY } from "@/lib/app-config";
import { createBalancedQuestionOrder } from "@/lib/study-card-order";

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

function normalizeMap(value, valid) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => valid(item)),
  );
}

function normalizePreferences(value) {
  return {
    matchingMode: value?.matchingMode === "menus" ? "menus" : "drag",
    defaultShuffleEnabled: value?.defaultShuffleEnabled !== false,
    shuffleOverrides: normalizeMap(
      value?.shuffleOverrides,
      (enabled) => typeof enabled === "boolean",
    ),
    questionOrders: Object.fromEntries(
      Object.entries(normalizeMap(value?.questionOrders, Array.isArray)).map(
        ([slug, ids]) => [
          slug,
          [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id >= 0))],
        ],
      ),
    ),
    questionOrderSignatures: normalizeMap(
      value?.questionOrderSignatures,
      (signature) => typeof signature === "string",
    ),
  };
}

export function isShuffleEnabled(state, setSlug) {
  return Object.hasOwn(state.shuffleOverrides, setSlug)
    ? state.shuffleOverrides[setSlug]
    : state.defaultShuffleEnabled;
}

export function getQuestionOrder(state, setSlug) {
  return Object.hasOwn(state.questionOrders, setSlug)
    ? state.questionOrders[setSlug]
    : undefined;
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

function cardSignature(cards) {
  // Text edits and source-order changes do not reshuffle existing cards.
  return JSON.stringify(
    cards.map(({ id, type }) => [id, type]).sort((a, b) => a[0] - b[0]),
  );
}

export function createStudyReaderStore({
  storage,
  random = Math.random,
  eventTarget = globalThis.window,
} = {}) {
  const store = create((set, get) => {
    function updatePreferences(patch) {
      set(patch);
      const {
        matchingMode,
        defaultShuffleEnabled,
        shuffleOverrides,
        questionOrders,
        questionOrderSignatures,
      } = get();
      try {
        (storage ?? globalThis.window?.localStorage)?.setItem(
          STUDY_READER_STORAGE_KEY,
          JSON.stringify({
            matchingMode,
            defaultShuffleEnabled,
            shuffleOverrides,
            questionOrders,
            questionOrderSignatures,
          }),
        );
      } catch {
        // Reading and studying remain available without browser storage.
      }
    }

    function orderPatch(setSlug, cards) {
      const { questionOrders, questionOrderSignatures } = get();
      const signature = cardSignature(cards);
      const previousOrder = getQuestionOrder(get(), setSlug);
      if (
        questionOrderSignatures[setSlug] === signature &&
        previousOrder?.length === cards.length
      ) {
        return {};
      }
      return {
        questionOrders: {
          ...questionOrders,
          [setSlug]: createBalancedQuestionOrder(cards, random, previousOrder),
        },
        questionOrderSignatures: {
          ...questionOrderSignatures,
          [setSlug]: signature,
        },
      };
    }

    return {
      ...normalizePreferences(readPreferences(storage)),
      setMatchingMode: (matchingMode) => {
        if (matchingMode === "drag" || matchingMode === "menus") {
          updatePreferences({ matchingMode });
        }
      },
      setDefaultShuffleEnabled: (enabled) => {
        if (typeof enabled === "boolean") {
          updatePreferences({
            defaultShuffleEnabled: enabled,
            shuffleOverrides: {},
          });
        }
      },
      setShuffleEnabled: (setSlug, enabled, cards) => {
        if (typeof enabled !== "boolean") {
          return;
        }
        updatePreferences({
          shuffleOverrides: { ...get().shuffleOverrides, [setSlug]: enabled },
          ...(enabled ? orderPatch(setSlug, cards) : {}),
        });
      },
      ensureQuestionOrder: (setSlug, cards) => {
        if (isShuffleEnabled(get(), setSlug)) {
          const patch = orderPatch(setSlug, cards);
          if (Object.keys(patch).length) {
            updatePreferences(patch);
          }
        }
      },
      resetQuestionOrder: (setSlug) => {
        const { questionOrders, questionOrderSignatures, shuffleOverrides } =
          get();
        const withoutSet = (values) =>
          Object.fromEntries(
            Object.entries(values).filter(([slug]) => slug !== setSlug),
          );
        updatePreferences({
          questionOrders: withoutSet(questionOrders),
          questionOrderSignatures: withoutSet(questionOrderSignatures),
          shuffleOverrides: withoutSet(shuffleOverrides),
        });
      },
    };
  });
  const onStorage = (event) => {
    if (event.key === STUDY_READER_STORAGE_KEY || event.key === null) {
      store.setState(normalizePreferences(readPreferences(storage)));
    }
  };
  eventTarget?.addEventListener("storage", onStorage);
  store.stopStorageSync = () =>
    eventTarget?.removeEventListener("storage", onStorage);
  return store;
}

export const useStudyReaderStore = createStudyReaderStore();
