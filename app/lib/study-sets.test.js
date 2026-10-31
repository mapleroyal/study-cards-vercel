import { describe, expect, it, vi } from "vitest";

import {
  deriveSetSlug,
  fallbackSetSlug,
  formatAnswer,
  getBundledStudySetSourcesForPackIds,
  getFallbackStudySet,
  getSetCategories,
  getSetNavigationTree,
  getStudySetContentFingerprint,
  getStudySetFromRecord,
  MILITARY_STUDIES_PACK_ID,
  normalizeStudySets,
  selectFirstLocalSet,
  selectLocalSetBySlug,
  selectLocalStudySets,
} from "./study-sets";

describe("fallback study set", () => {
  it("normalizes the bundled fallback set", () => {
    const set = getFallbackStudySet();

    expect(set).toHaveProperty("slug");
    expect(set).toHaveProperty("title");
    expect(set).toHaveProperty("category");
    expect(set).toHaveProperty("cards");
    expect(fallbackSetSlug).toBe(set.slug);
  });

  it("keeps bundled fallback answer order stable across module reloads", async () => {
    const firstFallback = JSON.parse(JSON.stringify(getFallbackStudySet()));

    vi.resetModules();
    const reloadedStudySets = await import("./study-sets");

    expect(reloadedStudySets.getFallbackStudySet()).toEqual(firstFallback);
  });
});

describe("deriveSetSlug", () => {
  it("builds a slug from the category path and title", () => {
    expect(
      deriveSetSlug({
        title: "Science & Nature",
        category: " First Quarter / Classes / Science ",
      }),
    ).toBe("first-quarter-classes-science-science-and-nature");
  });

  it("falls back to the title when there is no category path", () => {
    expect(
      deriveSetSlug({
        title: "Standalone Set",
      }),
    ).toBe("standalone-set");
  });
});

describe("normalizeStudySets", () => {
  it("normalizes category paths and derived slugs", () => {
    const sets = normalizeStudySets([
      {
        title: "Science Review",
        category: " First Quarter / Science ",
        cards: [],
      },
    ]);

    expect(sets).toEqual([
      {
        title: "Science Review",
        category: "First Quarter/Science",
        cards: [],
        slug: "first-quarter-science-science-review",
      },
    ]);
  });

  it("throws when two sets derive the same slug", () => {
    expect(() =>
      normalizeStudySets([
        {
          title: "Science Review",
          category: "First Quarter/Science",
          cards: [],
        },
        {
          title: "Science Review",
          category: "First Quarter/Science",
          cards: [],
        },
      ]),
    ).toThrow(
      'Duplicate study set slug "first-quarter-science-science-review"',
    );
  });
});

describe("bundled study set content fingerprints", () => {
  it("is stable across object key order and changes when content changes", () => {
    expect(getStudySetContentFingerprint({ b: 2, a: 1 })).toBe(
      getStudySetContentFingerprint({ a: 1, b: 2 }),
    );
    expect(getStudySetContentFingerprint({ a: 1 })).not.toBe(
      getStudySetContentFingerprint({ a: 2 }),
    );
  });

  it("exposes source fingerprints for active bundled packs", () => {
    const sources = getBundledStudySetSourcesForPackIds([
      MILITARY_STUDIES_PACK_ID,
    ]);

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.map((source) => source.slug)).toEqual(
      sources.map((source) => source.set.slug),
    );
    expect(
      sources.every(
        (source) =>
          source.packId === MILITARY_STUDIES_PACK_ID &&
          typeof source.contentFingerprint === "string" &&
          source.contentFingerprint.length > 0,
      ),
    ).toBe(true);
  });
});

describe("answer order randomization", () => {
  function getCorrectLabels(card) {
    return card.type === "multiple_choice"
      ? [card.options[card.answer]]
      : card.answer.map((answerKey) => card.options[answerKey]);
  }

  it("randomizes selection, ordering, and matching cards while preserving correct answers", () => {
    const set = {
      title: "Answer Order",
      category: "Course / Unit",
      cards: [
        {
          id: 1,
          type: "multiple_choice",
          question: "Choose one.",
          options: {
            a: "Alpha",
            b: "Beta",
            c: "Gamma",
            d: "Delta",
          },
          answer: "a",
          explanation: "Alpha is correct.",
        },
        {
          id: 2,
          type: "multiple_response",
          question: "Choose many.",
          options: {
            a: "Alpha",
            b: "Beta",
            c: "Gamma",
            d: "Delta",
          },
          answer: ["a", "b"],
          explanation: "Alpha and Beta are correct.",
        },
        {
          id: 3,
          type: "ordering",
          question: "Order these.",
          unordered_items: ["First", "Second", "Third"],
          answer: ["First", "Second", "Third"],
          explanation: "That is the order.",
        },
        {
          id: 4,
          type: "matching",
          question: "Match these.",
          prompts: ["Letters", "Numbers", "Colors"],
          choices: ["A", "1", "Blue"],
          answer: [
            { prompt: "Letters", choices: ["A"] },
            { prompt: "Numbers", choices: ["1"] },
            { prompt: "Colors", choices: ["Blue"] },
          ],
          explanation: "Each prompt has one match.",
        },
      ],
    };

    const normalizedSet = normalizeStudySets([set])[0];
    const [choiceCard, responseCard, orderingCard, matchingCard] =
      normalizedSet.cards;

    expect(normalizedSet).not.toHaveProperty("answerOrderRandomizationVersion");
    expect(Object.keys(choiceCard.options)).toEqual(["a", "b", "c", "d"]);
    expect(new Set(Object.values(choiceCard.options))).toEqual(
      new Set(Object.values(set.cards[0].options)),
    );
    expect(choiceCard.answer).not.toBe(set.cards[0].answer);
    expect(getCorrectLabels(choiceCard)).toEqual(["Alpha"]);

    expect(Object.keys(responseCard.options)).toEqual(["a", "b", "c", "d"]);
    expect(new Set(Object.values(responseCard.options))).toEqual(
      new Set(Object.values(set.cards[1].options)),
    );
    expect([...responseCard.answer].sort()).not.toEqual(
      [...set.cards[1].answer].sort(),
    );
    expect(new Set(getCorrectLabels(responseCard))).toEqual(
      new Set(["Alpha", "Beta"]),
    );

    expect(orderingCard.unordered_items).not.toEqual(
      set.cards[2].unordered_items,
    );
    expect(orderingCard.answer).toEqual(set.cards[2].answer);

    expect(matchingCard.prompts).not.toEqual(set.cards[3].prompts);
    expect(matchingCard.choices).not.toEqual(set.cards[3].choices);
    expect(new Set(matchingCard.prompts)).toEqual(
      new Set(set.cards[3].prompts),
    );
    expect(new Set(matchingCard.choices)).toEqual(
      new Set(set.cards[3].choices),
    );
    expect(matchingCard.answer).toEqual(
      matchingCard.prompts.map((prompt) =>
        set.cards[3].answer.find((answer) => answer.prompt === prompt),
      ),
    );
  });

  it("removes stale answer-order version metadata during normalization", () => {
    const normalizedSet = normalizeStudySets([
      {
        title: "Legacy Metadata",
        category: "Course / Unit",
        answerOrderRandomizationVersion: 1,
        cards: [],
      },
    ])[0];

    expect(normalizedSet).not.toHaveProperty("answerOrderRandomizationVersion");
  });
});

describe("local set selectors", () => {
  const records = [
    {
      slug: "first-set",
      rawSet: {
        title: "First Set",
        category: "Imported",
        cards: [],
      },
    },
    {
      slug: "second-set",
      rawSet: {
        title: "Second Set",
        category: "Imported",
        cards: [],
      },
    },
  ];

  it("maps storage records to normalized local sets", () => {
    expect(selectLocalStudySets(records).map((set) => set.slug)).toEqual([
      "first-set",
      "second-set",
    ]);
  });

  it("selects first and matching local sets without fallback behavior", () => {
    expect(selectFirstLocalSet(records).slug).toBe("first-set");
    expect(selectLocalSetBySlug(records, "second-set").title).toBe(
      "Second Set",
    );
    expect(selectFirstLocalSet([])).toBeNull();
    expect(selectLocalSetBySlug(records, "missing")).toBeNull();
  });

  it("projects persisted answer order idempotently", () => {
    const record = {
      slug: "stable-answers",
      rawSet: {
        title: "Stable Answers",
        category: "Imported",
        cards: [
          {
            id: 1,
            type: "multiple_choice",
            question: "Choose one.",
            options: { a: "Gamma", b: "Alpha", c: "Beta" },
            answer: "b",
            explanation: "Alpha is correct.",
          },
          {
            id: 2,
            type: "matching",
            question: "Match these.",
            prompts: ["Third", "First", "Second"],
            choices: ["C", "A", "B"],
            answer: [
              { prompt: "Third", choices: ["C"] },
              { prompt: "First", choices: ["A"] },
              { prompt: "Second", choices: ["B"] },
            ],
            explanation: "Each prompt matches its initial.",
          },
        ],
      },
    };

    const firstProjection = getStudySetFromRecord(record);

    expect(getStudySetFromRecord(record)).toEqual(firstProjection);
    expect(getStudySetFromRecord(record)).toEqual(firstProjection);
    expect(
      firstProjection.cards[0].options[firstProjection.cards[0].answer],
    ).toBe("Alpha");
    expect(firstProjection.cards[1].prompts).toEqual([
      "Third",
      "First",
      "Second",
    ]);
  });
});

describe("getSetCategories", () => {
  it("returns an empty array when a set does not define a category path", () => {
    expect(getSetCategories({})).toEqual([]);
  });

  it("splits a slash-delimited category path into folder segments", () => {
    expect(
      getSetCategories({
        category: "First Quarter/Classes/Science",
      }),
    ).toEqual(["First Quarter", "Classes", "Science"]);
  });

  it("trims whitespace and ignores empty segments", () => {
    expect(
      getSetCategories({
        category: " First Quarter / / Classes / Science / ",
      }),
    ).toEqual(["First Quarter", "Classes", "Science"]);
  });
});

describe("getSetNavigationTree", () => {
  function simplifyTree(nodes) {
    return nodes.map((node) =>
      node.type === "category"
        ? {
            type: node.type,
            name: node.name,
            path: node.path,
            children: simplifyTree(node.children),
          }
        : {
            type: node.type,
            slug: node.set.slug,
            title: node.set.title,
          },
    );
  }

  it("groups sets into shared folder branches and uses the title for leaves", () => {
    const tree = getSetNavigationTree([
      {
        slug: "science-review",
        title: "Science Review",
        category: "First Quarter/Classes/Science",
      },
      {
        slug: "lab-practice",
        title: "Lab Practice",
        category: "First Quarter/Classes/Science",
      },
      {
        slug: "warmup-quiz",
        title: "Warmup Quiz",
        category: "First Quarter/Warmups",
      },
      {
        slug: "standalone",
        title: "Standalone Set",
      },
    ]);

    expect(simplifyTree(tree)).toEqual([
      {
        type: "category",
        name: "First Quarter",
        path: "First Quarter",
        children: [
          {
            type: "category",
            name: "Classes",
            path: "First Quarter/Classes",
            children: [
              {
                type: "category",
                name: "Science",
                path: "First Quarter/Classes/Science",
                children: [
                  {
                    type: "set",
                    slug: "science-review",
                    title: "Science Review",
                  },
                  {
                    type: "set",
                    slug: "lab-practice",
                    title: "Lab Practice",
                  },
                ],
              },
            ],
          },
          {
            type: "category",
            name: "Warmups",
            path: "First Quarter/Warmups",
            children: [
              {
                type: "set",
                slug: "warmup-quiz",
                title: "Warmup Quiz",
              },
            ],
          },
        ],
      },
      {
        type: "set",
        slug: "standalone",
        title: "Standalone Set",
      },
    ]);
  });
});

describe("formatAnswer", () => {
  it.each([
    [{ type: "true_false", answer: true }, "True"],
    [{ type: "true_false", answer: false }, "False"],
    [
      {
        type: "multiple_choice",
        options: { a: "Alpha", b: "Beta", c: "Gamma" },
        answer: "b",
      },
      "B. Beta",
    ],
    [
      {
        type: "multiple_response",
        options: { a: "Alpha", b: "Beta", c: "Gamma" },
        answer: ["a", "c"],
      },
      "A. Alpha, C. Gamma",
    ],
    [
      { type: "fill_in_the_blank", answer: ["core", "inner core"] },
      "core or inner core",
    ],
    [
      { type: "ordering", answer: ["First", "Second", "Third"] },
      "1. First\n2. Second\n3. Third",
    ],
    [
      {
        type: "matching",
        answer: [
          { prompt: "A", choices: ["1", "3"] },
          { prompt: "B", choices: ["2"] },
        ],
      },
      "A → 1, 3\nB → 2",
    ],
    [{ type: "short_answer", answer: "Some answer" }, "Some answer"],
  ])("formats %s answers", (card, expected) => {
    expect(formatAnswer(card)).toBe(expected);
  });
});
