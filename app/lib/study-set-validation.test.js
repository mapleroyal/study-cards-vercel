import { describe, expect, it } from "vitest";

import {
  StudySetValidationError,
  validateGeneratedStudySet,
  validateStudySetImport,
} from "./study-set-validation";

function createValidSet() {
  return {
    title: "Imported Set",
    category: "Course / Unit",
    cards: [
      {
        id: 1,
        type: "true_false",
        question: "Is this true?",
        answer: true,
        explanation: "It is true.",
      },
      {
        id: 2,
        type: "multiple_choice",
        question: "Choose one.",
        options: {
          a: "Alpha",
          b: "Beta",
        },
        answer: "a",
        explanation: "Alpha is correct.",
      },
      {
        id: 3,
        type: "multiple_response",
        question: "Choose many.",
        options: {
          a: "Alpha",
          b: "Beta",
          c: "Gamma",
        },
        answer: ["a", "c"],
        explanation: "Alpha and Gamma are correct.",
      },
      {
        id: 4,
        type: "fill_in_the_blank",
        question: "Fill it.",
        answer: ["blank"],
        explanation: "Blank fits.",
      },
      {
        id: 5,
        type: "ordering",
        question: "Order these.",
        unordered_items: ["First", "Second"],
        answer: ["First", "Second"],
        explanation: "That is the order.",
      },
      {
        id: 6,
        type: "matching",
        question: "Match these.",
        prompts: ["A", "B"],
        choices: ["One", "Two"],
        answer: [
          {
            prompt: "A",
            choices: ["One"],
          },
          {
            prompt: "B",
            choices: ["Two"],
          },
        ],
        explanation: "They match.",
      },
      {
        id: 7,
        type: "short_answer",
        question: "Answer briefly.",
        answer: "Brief answer",
        explanation: "That is brief.",
      },
    ],
  };
}

function createGeneratedSet(cardCount = 25) {
  return {
    title: "Generated Set",
    category: "Course / Unit",
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: index + 1,
      type: "short_answer",
      question: `Question ${index + 1}?`,
      answer: `Answer ${index + 1}`,
      explanation: `Explanation ${index + 1}.`,
    })),
  };
}

describe("validateStudySetImport", () => {
  it("accepts a valid study set", () => {
    expect(validateStudySetImport(createValidSet())).toEqual(createValidSet());
  });

  it("rejects malformed study set shape", () => {
    expect(() =>
      validateStudySetImport({
        title: "Missing fields",
        cards: [],
      }),
    ).toThrow(StudySetValidationError);
  });

  it("requires a nonempty collection and accepts large valid sets", () => {
    expect(() =>
      validateStudySetImport({
        title: "Empty set",
        category: "Course",
        cards: [],
      }),
    ).toThrow("cards: At least one card is required.");

    const largeSet = createGeneratedSet(750);
    expect(validateStudySetImport(largeSet)).toEqual(largeSet);
  });

  it("preserves large valid source-derived strings and categories", () => {
    const set = createValidSet();
    set.category = Array.from(
      { length: 20 },
      (_, index) => `Level ${index}`,
    ).join("/");
    set.cards[0].question = "Long source-derived question ".repeat(500).trim();
    set.cards[0].explanation = "Complete supporting explanation "
      .repeat(500)
      .trim();
    expect(validateStudySetImport(set)).toEqual(set);
  });

  it("checks answer relationships without imposing collection ceilings", () => {
    const set = createValidSet();
    set.cards[1].options = Object.fromEntries(
      Array.from({ length: 75 }, (_, index) => [
        `option-${index}`,
        `Option ${index}`,
      ]),
    );
    set.cards[1].answer = "option-0";
    set.cards[5].prompts = Array.from(
      { length: 125 },
      (_, index) => `Prompt ${index}`,
    );
    set.cards[5].choices = Array.from(
      { length: 125 },
      (_, index) => `Choice ${index}`,
    );
    set.cards[5].answer = set.cards[5].prompts.map((prompt, index) => ({
      prompt,
      choices: [set.cards[5].choices[index]],
    }));
    expect(validateStudySetImport(set)).toEqual(set);
    set.cards[5].answer[0].choices = ["Missing choice"];
    expect(() => validateStudySetImport(set)).toThrow(
      "Answer choice must match a choice.",
    );
  });

  it("rejects duplicate numeric card IDs", () => {
    const set = createValidSet();
    set.cards[1].id = set.cards[0].id;

    expect(() => validateStudySetImport(set)).toThrow(
      "cards[1].id: Card IDs must be unique.",
    );
  });

  it("rejects unsupported card types", () => {
    const set = createValidSet();
    set.cards[0].type = "essay";

    expect(() => validateStudySetImport(set)).toThrow(
      "cards[0].type: Unsupported card type.",
    );
  });

  it("rejects multiple choice answers outside the option keys", () => {
    const set = createValidSet();
    set.cards[1].answer = "z";

    expect(() => validateStudySetImport(set)).toThrow(
      "cards[1].answer: Answer must match an option key.",
    );
  });

  it("rejects ordering answers that do not match unordered items", () => {
    const set = createValidSet();
    set.cards[4].answer = ["Second", "Third"];

    expect(() => validateStudySetImport(set)).toThrow(
      "cards[4].answer: Answer must contain the same items as unordered_items.",
    );
  });

  it("rejects matching answers that reference unknown choices", () => {
    const set = createValidSet();
    set.cards[5].answer[0].choices = ["Three"];

    expect(() => validateStudySetImport(set)).toThrow(
      "cards[5].answer[0].choices[0]: Answer choice must match a choice.",
    );
  });
});

describe("validateGeneratedStudySet", () => {
  it("accepts generated sets with exactly 25 cards", () => {
    const set = createGeneratedSet();

    expect(validateGeneratedStudySet(set)).toEqual(set);
  });

  it("rejects generated sets with any other card count", () => {
    expect(() => validateGeneratedStudySet(createGeneratedSet(24))).toThrow(
      "cards: Generated study set must contain exactly 25 cards.",
    );

    expect(() => validateGeneratedStudySet(createGeneratedSet(26))).toThrow(
      "cards: Generated study set must contain exactly 25 cards.",
    );
  });

  it("accepts generated sets with a requested card count", () => {
    const set = createGeneratedSet(40);

    expect(validateGeneratedStudySet(set, { cardCount: 40 })).toEqual(set);
  });

  it("rejects generated card types outside the requested set", () => {
    const set = createGeneratedSet(1);
    set.cards[0].type = "true_false";
    set.cards[0].answer = true;

    expect(() =>
      validateGeneratedStudySet(set, {
        cardCount: 1,
        allowedCardTypes: ["short_answer"],
      }),
    ).toThrow("cards[0].type: Generated card type was not allowed.");
  });
});
