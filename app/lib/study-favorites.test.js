import { describe, expect, it } from "vitest";

import {
  STUDY_FAVORITES_STORAGE_KEY,
  addFavoriteItem,
  buildFavoriteNavigationTree,
  initializeStoredStudyFavorites,
  normalizeFavoriteCategoryPath,
  normalizeFavoriteItems,
  pruneFavoriteItems,
  removeFavoriteItem,
  resolveFavoriteStart,
  toggleFavoriteItem,
} from "./study-favorites";
import {
  STUDY_PACK_DEFAULTS_STORAGE_KEY,
  STUDY_PACKS_STORAGE_KEY,
} from "./study-pack-activation";

const studySets = [
  {
    slug: "biology",
    title: "Biology",
    category: "Term 1/Science/Biology",
  },
  {
    slug: "chemistry",
    title: "Chemistry",
    category: "Term 1/Science/Chemistry",
  },
  {
    slug: "history",
    title: "History",
    category: "Term 1/Humanities",
  },
  {
    slug: "standalone",
    title: "Standalone",
  },
];

const militaryStudySets = [
  {
    slug: "joint-operations-set-1",
    title: "Joint Operations Set 1",
    category: "Military Studies/Day 1/Joint Operations",
  },
  {
    slug: "joint-operations-set-2",
    title: "Joint Operations Set 2",
    category: "Military Studies/Day 1/Joint Operations",
  },
];

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

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
          categoryPathLabel: node.categoryPathLabel,
        },
  );
}

describe("favorite normalization", () => {
  it("normalizes category paths like study-set categories", () => {
    expect(normalizeFavoriteCategoryPath(" Term 1 / / Science / ")).toBe(
      "Term 1/Science",
    );
  });

  it("drops invalid items and prevents duplicates", () => {
    expect(
      normalizeFavoriteItems([
        { type: "set", slug: " biology " },
        { type: "set", slug: "biology" },
        { type: "category", path: " Term 1 / Science " },
        { type: "category", path: "" },
        { type: "unknown", slug: "missing" },
      ]),
    ).toEqual([
      { type: "set", slug: "biology" },
      { type: "category", path: "Term 1/Science" },
    ]);
  });

  it("adds, removes, and toggles normalized favorites", () => {
    const added = addFavoriteItem([], {
      type: "category",
      path: " Term 1 / Science ",
    });

    expect(added).toEqual([{ type: "category", path: "Term 1/Science" }]);
    expect(addFavoriteItem(added, added[0])).toEqual(added);
    expect(toggleFavoriteItem(added, added[0])).toEqual([]);
    expect(toggleFavoriteItem([], { type: "set", slug: "biology" })).toEqual([
      { type: "set", slug: "biology" },
    ]);
    expect(removeFavoriteItem(added, added[0])).toEqual([]);
  });
});

describe("default study favorites", () => {
  it("applies active pack default favorites once per pack revision", () => {
    const storage = createMemoryStorage({
      [STUDY_PACKS_STORAGE_KEY]: JSON.stringify(["military-studies"]),
    });

    expect(initializeStoredStudyFavorites(militaryStudySets, storage)).toEqual([
      { type: "category", path: "Military Studies" },
    ]);
    expect(JSON.parse(storage.getItem(STUDY_FAVORITES_STORAGE_KEY))).toEqual([
      { type: "category", path: "Military Studies" },
    ]);
    expect(
      JSON.parse(storage.getItem(STUDY_PACK_DEFAULTS_STORAGE_KEY)),
    ).toEqual({
      "military-studies": 1,
    });

    storage.setItem(STUDY_FAVORITES_STORAGE_KEY, JSON.stringify([]));

    expect(initializeStoredStudyFavorites(militaryStudySets, storage)).toEqual(
      [],
    );
  });

  it("merges default favorites into existing favorites before marking initialized", () => {
    const storage = createMemoryStorage({
      [STUDY_PACKS_STORAGE_KEY]: JSON.stringify(["military-studies"]),
      [STUDY_FAVORITES_STORAGE_KEY]: JSON.stringify([
        { type: "set", slug: "joint-operations-set-1" },
      ]),
    });

    expect(initializeStoredStudyFavorites(militaryStudySets, storage)).toEqual([
      { type: "set", slug: "joint-operations-set-1" },
      { type: "category", path: "Military Studies" },
    ]);
  });
});

describe("pruneFavoriteItems", () => {
  it("removes deleted set and category favorites", () => {
    expect(
      pruneFavoriteItems(
        [
          { type: "set", slug: "biology" },
          { type: "set", slug: "missing" },
          { type: "category", path: "Term 1/Science" },
          { type: "category", path: "Deleted" },
        ],
        studySets,
      ).favorites,
    ).toEqual([
      { type: "set", slug: "biology" },
      { type: "category", path: "Term 1/Science" },
    ]);
  });
});

describe("resolveFavoriteStart", () => {
  it("redirects when exactly one valid favorite is a study set", () => {
    expect(
      resolveFavoriteStart(studySets, [{ type: "set", slug: "biology" }]),
    ).toMatchObject({
      mode: "redirect",
      slug: "biology",
    });
  });

  it("returns empty mode when no valid favorites remain", () => {
    expect(
      resolveFavoriteStart(studySets, [{ type: "set", slug: "missing" }]),
    ).toMatchObject({
      mode: "empty",
      favorites: [],
    });
  });
});

describe("buildFavoriteNavigationTree", () => {
  it("renders a favorite category as a full subtree root", () => {
    expect(
      simplifyTree(
        buildFavoriteNavigationTree(studySets, [
          { type: "category", path: "Term 1/Science" },
        ]),
      ),
    ).toEqual([
      {
        type: "category",
        name: "Science",
        path: "Term 1/Science",
        children: [
          {
            type: "category",
            name: "Biology",
            path: "Term 1/Science/Biology",
            children: [
              {
                type: "set",
                slug: "biology",
                title: "Biology",
                categoryPathLabel: undefined,
              },
            ],
          },
          {
            type: "category",
            name: "Chemistry",
            path: "Term 1/Science/Chemistry",
            children: [
              {
                type: "set",
                slug: "chemistry",
                title: "Chemistry",
                categoryPathLabel: undefined,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("merges related favorite categories into one visual tree", () => {
    expect(
      simplifyTree(
        buildFavoriteNavigationTree(studySets, [
          { type: "category", path: "Term 1/Science/Biology" },
          { type: "category", path: "Term 1/Science/Chemistry" },
        ]),
      ),
    ).toEqual([
      {
        type: "category",
        name: "Science",
        path: "Term 1/Science",
        children: [
          {
            type: "category",
            name: "Biology",
            path: "Term 1/Science/Biology",
            children: [
              {
                type: "set",
                slug: "biology",
                title: "Biology",
                categoryPathLabel: undefined,
              },
            ],
          },
          {
            type: "category",
            name: "Chemistry",
            path: "Term 1/Science/Chemistry",
            children: [
              {
                type: "set",
                slug: "chemistry",
                title: "Chemistry",
                categoryPathLabel: undefined,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("lets ancestor category favorites subsume descendant roots", () => {
    expect(
      simplifyTree(
        buildFavoriteNavigationTree(studySets, [
          { type: "category", path: "Term 1/Science" },
          { type: "category", path: "Term 1/Science/Biology" },
        ]),
      ),
    ).toHaveLength(1);
  });

  it("renders favorite sets outside favorite categories as root items", () => {
    expect(
      simplifyTree(
        buildFavoriteNavigationTree(studySets, [
          { type: "set", slug: "history" },
          { type: "set", slug: "standalone" },
        ]),
      ),
    ).toEqual([
      {
        type: "set",
        slug: "history",
        title: "History",
        categoryPathLabel: "Term 1 / Humanities",
      },
      {
        type: "set",
        slug: "standalone",
        title: "Standalone",
        categoryPathLabel: "",
      },
    ]);
  });

  it("does not duplicate a favorite set covered by a favorite category", () => {
    expect(
      simplifyTree(
        buildFavoriteNavigationTree(studySets, [
          { type: "category", path: "Term 1" },
          { type: "set", slug: "history" },
        ]),
      ),
    ).toHaveLength(1);
  });
});
