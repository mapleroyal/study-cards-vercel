import { describe, expect, it, vi } from "vitest";

import {
  assignMatchingChoiceToPrompt,
  clearMatchingChoiceFromPrompt,
  createStudyInteractionsStore,
  getDefaultStudyInteraction,
  hasDirtyStudyInteractions,
  isStudyInteractionDirty,
  mergeStudyInteraction,
  STUDY_INTERACTIONS_STORAGE_KEY,
} from "./use-study-interactions-store";

const multipleChoiceCard = {
  id: 1,
  type: "multiple_choice",
  question: "Question",
  options: {
    a: "Alpha",
    b: "Beta",
    c: "Gamma",
  },
};

const multipleResponseCard = {
  id: 2,
  type: "multiple_response",
  question: "Question",
  options: {
    a: "Alpha",
    b: "Beta",
    c: "Gamma",
  },
};

const orderingCard = {
  id: 3,
  type: "ordering",
  question: "Question",
  unordered_items: ["Mercury", "Venus", "Earth"],
};

const matchingCard = {
  id: 4,
  type: "matching",
  question: "Question",
  prompts: ["First", "Second", "Third"],
  choices: ["A", "B", "C"],
};

const shortAnswerCard = {
  id: 5,
  type: "short_answer",
  question: "Question",
};

const fillInTheBlankCard = {
  id: 6,
  type: "fill_in_the_blank",
  question: "The sky is ____.",
};

const trueFalseCard = {
  id: 7,
  type: "true_false",
  question: "The sky is blue.",
};

function createStorage() {
  const values = new Map();

  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
  };
}

describe("getDefaultStudyInteraction", () => {
  it("creates defaults for every supported prompt interaction", () => {
    expect(getDefaultStudyInteraction(multipleChoiceCard)).toEqual({
      answerOpen: false,
      selectedOption: null,
    });

    expect(getDefaultStudyInteraction(multipleResponseCard)).toEqual({
      answerOpen: false,
      selectedOptions: [],
    });

    expect(getDefaultStudyInteraction(orderingCard)).toEqual({
      answerOpen: false,
      items: ["Mercury", "Venus", "Earth"],
    });

    expect(getDefaultStudyInteraction(matchingCard)).toEqual({
      answerOpen: false,
      assignments: [[], [], []],
    });

    expect(getDefaultStudyInteraction(shortAnswerCard)).toEqual({
      answerOpen: false,
      response: "",
    });
    expect(getDefaultStudyInteraction(fillInTheBlankCard)).toEqual({
      answerOpen: false,
      response: "",
    });
    expect(getDefaultStudyInteraction(trueFalseCard)).toEqual({
      answerOpen: false,
      selectedAnswer: null,
    });
  });
});

describe("mergeStudyInteraction", () => {
  it("merges sparse persisted patches over card-derived defaults", () => {
    expect(
      mergeStudyInteraction(multipleChoiceCard, { answerOpen: true }),
    ).toEqual({
      answerOpen: true,
      selectedOption: null,
    });

    expect(
      mergeStudyInteraction(multipleResponseCard, { selectedOptions: ["c"] }),
    ).toEqual({
      answerOpen: false,
      selectedOptions: ["c"],
    });

    expect(
      mergeStudyInteraction(orderingCard, {
        items: ["Earth", "Venus", "Mercury"],
      }),
    ).toEqual({
      answerOpen: false,
      items: ["Earth", "Venus", "Mercury"],
    });

    expect(
      mergeStudyInteraction(matchingCard, { assignments: [["B"], [], ["A"]] }),
    ).toEqual({
      answerOpen: false,
      assignments: [["B"], [], ["A"]],
    });
  });

  it("sanitizes matching assignments against prompt slots and choices", () => {
    expect(
      mergeStudyInteraction(matchingCard, {
        assignments: [["B", "B", "Z"], "A", ["C"]],
      }).assignments,
    ).toEqual([["B"], [], ["C"]]);
  });

  it("sanitizes selected option keys against own card options only", () => {
    expect(
      mergeStudyInteraction(multipleChoiceCard, {
        selectedOption: "toString",
      }).selectedOption,
    ).toBeNull();

    expect(
      mergeStudyInteraction(multipleResponseCard, {
        selectedOptions: ["b", "toString", "b"],
      }).selectedOptions,
    ).toEqual(["b"]);
  });
});

describe("dirty-state derivation", () => {
  it("derives card and set dirty state from merged defaults", () => {
    expect(isStudyInteractionDirty(shortAnswerCard)).toBe(false);
    expect(isStudyInteractionDirty(shortAnswerCard, { answerOpen: true })).toBe(
      true,
    );
    expect(
      isStudyInteractionDirty(multipleChoiceCard, { selectedOption: "b" }),
    ).toBe(true);

    expect(
      hasDirtyStudyInteractions([multipleChoiceCard, shortAnswerCard], {
        [multipleChoiceCard.id]: { selectedOption: "b" },
      }),
    ).toBe(true);

    expect(
      hasDirtyStudyInteractions([multipleChoiceCard, shortAnswerCard], {
        [multipleChoiceCard.id]: {},
      }),
    ).toBe(false);
  });
});

describe("createStudyInteractionsStore", () => {
  it("resets one set at a time and rehydrates persisted state", () => {
    const storage = createStorage();
    const firstStore = createStudyInteractionsStore({ storage });

    firstStore
      .getState()
      .setAnswerOpen("general-knowledge", shortAnswerCard, true);
    firstStore
      .getState()
      .toggleSelectedOption("general-knowledge", multipleChoiceCard, "b");
    firstStore
      .getState()
      .toggleSelectedOption("science-and-nature", multipleChoiceCard, "a");

    const rehydratedStore = createStudyInteractionsStore({ storage });

    expect(
      mergeStudyInteraction(
        shortAnswerCard,
        rehydratedStore.getState().interactionsBySet["general-knowledge"][
          shortAnswerCard.id
        ],
      ),
    ).toEqual({
      answerOpen: true,
      response: "",
    });

    expect(
      mergeStudyInteraction(
        multipleChoiceCard,
        rehydratedStore.getState().interactionsBySet["general-knowledge"][
          multipleChoiceCard.id
        ],
      ),
    ).toEqual({
      answerOpen: false,
      selectedOption: "b",
    });

    expect(
      mergeStudyInteraction(
        multipleChoiceCard,
        rehydratedStore.getState().interactionsBySet["science-and-nature"][
          multipleChoiceCard.id
        ],
      ),
    ).toEqual({
      answerOpen: false,
      selectedOption: "a",
    });

    rehydratedStore.getState().resetSet("general-knowledge");

    expect(
      rehydratedStore.getState().interactionsBySet["general-knowledge"],
    ).toBeUndefined();
    expect(
      rehydratedStore.getState().interactionsBySet["science-and-nature"],
    ).toBeDefined();

    const resetStore = createStudyInteractionsStore({ storage });
    expect(
      resetStore.getState().interactionsBySet["general-knowledge"],
    ).toBeUndefined();
    expect(
      resetStore.getState().interactionsBySet["science-and-nature"],
    ).toBeDefined();
  });

  it("supports matching assignment transitions", () => {
    const storage = createStorage();
    const store = createStudyInteractionsStore({ storage });

    store.getState().assignMatchingChoice("science", matchingCard, 0, "B");
    expect(
      mergeStudyInteraction(
        matchingCard,
        store.getState().interactionsBySet.science[matchingCard.id],
      ).assignments,
    ).toEqual([["B"], [], []]);

    store.getState().assignMatchingChoice("science", matchingCard, 0, "C");
    expect(
      mergeStudyInteraction(
        matchingCard,
        store.getState().interactionsBySet.science[matchingCard.id],
      ).assignments,
    ).toEqual([["B", "C"], [], []]);

    store.getState().assignMatchingChoice("science", matchingCard, 1, "B");
    expect(
      mergeStudyInteraction(
        matchingCard,
        store.getState().interactionsBySet.science[matchingCard.id],
      ).assignments,
    ).toEqual([["C"], ["B"], []]);

    store.getState().clearMatchingAssignment("science", matchingCard, 0, "C");
    expect(
      mergeStudyInteraction(
        matchingCard,
        store.getState().interactionsBySet.science?.[matchingCard.id],
      ).assignments,
    ).toEqual([[], ["B"], []]);

    store.getState().clearMatchingAssignment("science", matchingCard, 1);
    expect(
      mergeStudyInteraction(
        matchingCard,
        store.getState().interactionsBySet.science?.[matchingCard.id],
      ).assignments,
    ).toEqual([[], [], []]);
  });

  it("persists true/false and text responses sparsely", () => {
    const storage = createStorage();
    const store = createStudyInteractionsStore({ storage });

    store.getState().setTrueFalseAnswer("science", trueFalseCard, false);
    store.getState().setTextResponse("science", fillInTheBlankCard, "blue");
    store.getState().setTextResponse("science", shortAnswerCard, "A response");

    expect(store.getState().interactionsBySet.science).toEqual({
      [trueFalseCard.id]: { selectedAnswer: false },
      [fillInTheBlankCard.id]: { response: "blue" },
      [shortAnswerCard.id]: { response: "A response" },
    });

    store.getState().setTrueFalseAnswer("science", trueFalseCard, null);
    store.getState().setTextResponse("science", fillInTheBlankCard, "");
    store.getState().setTextResponse("science", shortAnswerCard, "");
    expect(store.getState().interactionsBySet.science).toBeUndefined();
  });

  it("preserves complete text responses across persistence and rehydration", () => {
    const storage = createStorage();
    const store = createStudyInteractionsStore({ storage });
    const response = "An extended answer. ".repeat(1000);
    store.getState().setTextResponse("science", shortAnswerCard, response);
    expect(
      store.getState().interactionsBySet.science[shortAnswerCard.id].response,
    ).toBe(response);
    const restored = createStudyInteractionsStore({ storage });
    expect(
      restored.getState().interactionsBySet.science[shortAnswerCard.id]
        .response,
    ).toBe(response);
  });

  it("keeps interactions usable when browser storage rejects writes", () => {
    const storage = createStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    const store = createStudyInteractionsStore({ storage });

    expect(() =>
      store.getState().setTextResponse("science", shortAnswerCard, "safe"),
    ).not.toThrow();
    expect(store.getState().interactionsBySet.science).toEqual({
      [shortAnswerCard.id]: { response: "safe" },
    });
  });

  it("sanitizes malformed persisted root and set state during hydration", () => {
    const storage = createStorage();
    storage.setItem(
      STUDY_INTERACTIONS_STORAGE_KEY,
      JSON.stringify({
        state: {
          interactionsBySet: ["invalid"],
        },
        version: 0,
      }),
    );

    const store = createStudyInteractionsStore({ storage });
    expect(store.getState().interactionsBySet).toEqual({});

    store.getState().setTextResponse("science", shortAnswerCard, "safe");
    expect(store.getState().interactionsBySet.science).toEqual({
      [shortAnswerCard.id]: { response: "safe" },
    });
  });

  it("resets multiple live and persisted sets atomically", () => {
    const storage = createStorage();
    const store = createStudyInteractionsStore({ storage });
    store.getState().setAnswerOpen("one", shortAnswerCard, true);
    store.getState().setAnswerOpen("two", shortAnswerCard, true);
    store.getState().setAnswerOpen("three", shortAnswerCard, true);

    store.getState().resetSets(["one", "two"]);

    expect(store.getState().interactionsBySet).toEqual({
      three: { [shortAnswerCard.id]: { answerOpen: true } },
    });
    expect(
      createStudyInteractionsStore({ storage }).getState().interactionsBySet,
    ).toEqual({
      three: { [shortAnswerCard.id]: { answerOpen: true } },
    });
  });
});

describe("matching helpers", () => {
  it("assigns multiple choices, reassigns existing choices, and clears choices", () => {
    const assigned = assignMatchingChoiceToPrompt([[], [], []], 0, "B");
    expect(assigned).toEqual([["B"], [], []]);

    const added = assignMatchingChoiceToPrompt(assigned, 0, "C");
    expect(added).toEqual([["B", "C"], [], []]);

    const reassigned = assignMatchingChoiceToPrompt(added, 2, "B");
    expect(reassigned).toEqual([["C"], [], ["B"]]);

    expect(clearMatchingChoiceFromPrompt(reassigned, 0, "C")).toEqual([
      [],
      [],
      ["B"],
    ]);

    expect(clearMatchingChoiceFromPrompt(reassigned, 2)).toEqual([
      ["C"],
      [],
      [],
    ]);
  });
});
