import { studyPacks as rawStudyPacks } from "@/content/study-packs";
import { randomizeStudySetAnswerOrder } from "@/lib/study-set-answer-order";

export const MILITARY_STUDIES_PACK_ID = "military-studies";
export const BUNDLED_STUDY_SET_SOURCE_TYPE = "bundled";

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((sortedValue, key) => {
      sortedValue[key] = sortObjectKeys(value[key]);
      return sortedValue;
    }, {});
}

function hashStringToUint32(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function hashString(value) {
  return hashStringToUint32(value).toString(36);
}

function createSeededRandom(seed) {
  let state = hashStringToUint32(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getStudySetContentFingerprint(set) {
  return hashString(JSON.stringify(sortObjectKeys(set ?? {})));
}

export function normalizeCategoryPath(category) {
  if (typeof category !== "string") {
    return [];
  }

  return category
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function slugifySegment(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deriveSetSlug(set) {
  const slugParts = [...normalizeCategoryPath(set?.category), set?.title]
    .map(slugifySegment)
    .filter(Boolean);

  return slugParts.join("-") || "untitled-study-set";
}

function normalizeStudySetMetadata(set) {
  const sourceSet = set ?? {};
  const categoryPath = normalizeCategoryPath(sourceSet.category);
  const normalizedCategory = categoryPath.join("/");
  const normalizedSet = {
    ...sourceSet,
    category: normalizedCategory,
  };

  delete normalizedSet.answerOrderRandomizationVersion;

  return {
    ...normalizedSet,
    slug: deriveSetSlug({
      ...normalizedSet,
      category: normalizedCategory,
    }),
  };
}

export function normalizeStudySet(set, randomizationOptions) {
  return normalizeStudySetMetadata(
    randomizeStudySetAnswerOrder(set ?? {}, randomizationOptions),
  );
}

export function normalizeStoredStudySet(set) {
  return normalizeStudySetMetadata(set ?? {});
}

export function ensureUniqueSetSlugs(sourceSets) {
  const seenSlugs = new Set();

  for (const set of sourceSets) {
    if (seenSlugs.has(set.slug)) {
      throw new Error(
        `Duplicate study set slug "${set.slug}" derived from category "${set.category}" and title "${set.title}".`,
      );
    }

    seenSlugs.add(set.slug);
  }

  return sourceSets;
}

export function normalizeStudySets(sourceSets) {
  return ensureUniqueSetSlugs(sourceSets.map(normalizeStudySet));
}

function normalizePackRevision(revision) {
  return Number.isInteger(revision) && revision > 0 ? revision : 1;
}

function normalizeStudyPack(pack) {
  const sourceStudySets = pack.studySets ?? [];
  const normalizedStudySets = ensureUniqueSetSlugs(
    sourceStudySets.map((set) => {
      const contentFingerprint = getStudySetContentFingerprint(set);

      return normalizeStudySet(set, {
        random: createSeededRandom(contentFingerprint),
      });
    }),
  );

  return {
    id: pack.id,
    title: pack.title ?? pack.id,
    directory: pack.directory,
    revision: normalizePackRevision(pack.revision),
    fallback: Boolean(pack.fallback),
    defaultFavorites: pack.defaultFavorites ?? [],
    studySets: normalizedStudySets,
    studySetSources: normalizedStudySets.map((set, index) => ({
      type: BUNDLED_STUDY_SET_SOURCE_TYPE,
      packId: pack.id,
      slug: set.slug,
      contentFingerprint: getStudySetContentFingerprint(sourceStudySets[index]),
    })),
  };
}

function ensureUniqueStudyPackIds(sourcePacks) {
  const seenIds = new Set();

  for (const pack of sourcePacks) {
    if (!pack.id) {
      throw new Error("Study packs must have a folder-derived id.");
    }

    if (seenIds.has(pack.id)) {
      throw new Error(`Duplicate study pack id "${pack.id}".`);
    }

    seenIds.add(pack.id);
  }

  return sourcePacks;
}

function ensureUniqueStudySetSlugsAcrossPacks(sourcePacks) {
  const seenSlugs = new Map();

  for (const pack of sourcePacks) {
    for (const set of pack.studySets) {
      const existingPackId = seenSlugs.get(set.slug);

      if (existingPackId) {
        throw new Error(
          `Duplicate study set slug "${set.slug}" found in study packs "${existingPackId}" and "${pack.id}".`,
        );
      }

      seenSlugs.set(set.slug, pack.id);
    }
  }

  return sourcePacks;
}

function normalizeStudyPacks(sourcePacks) {
  return ensureUniqueStudySetSlugsAcrossPacks(
    ensureUniqueStudyPackIds(sourcePacks.map(normalizeStudyPack)),
  );
}

const bundledStudyPacks = normalizeStudyPacks(rawStudyPacks);
const bundledStudySets = bundledStudyPacks.flatMap((pack) => pack.studySets);

export function getBundledStudyPacks() {
  return bundledStudyPacks;
}

export function getStudyPackById(packId) {
  return bundledStudyPacks.find((pack) => pack.id === packId) ?? null;
}

export function getStudySetsForPackIds(packIds = []) {
  const activePackIds = new Set(packIds);

  return bundledStudyPacks
    .filter((pack) => activePackIds.has(pack.id))
    .flatMap((pack) => pack.studySets);
}

export function getBundledStudySetSourcesForPackIds(packIds = []) {
  const activePackIds = new Set(packIds);

  return bundledStudyPacks
    .filter((pack) => activePackIds.has(pack.id))
    .flatMap((pack) =>
      pack.studySets.map((set, index) => ({
        ...pack.studySetSources[index],
        set,
      })),
    );
}

export function getDefaultStudySets(packIds = []) {
  return getStudySetsForPackIds(packIds);
}

export const fallbackStudySet =
  bundledStudyPacks.find((pack) => pack.fallback)?.studySets[0] ??
  bundledStudySets[0];
export const fallbackSetSlug = fallbackStudySet?.slug ?? "untitled-study-set";

export function getFallbackStudySet() {
  return fallbackStudySet;
}

export function getFallbackSetBySlug(slug) {
  return slug === fallbackSetSlug ? fallbackStudySet : null;
}

export function getStudySetFromRecord(record) {
  if (!record?.rawSet) {
    return null;
  }

  // Answer order is part of the persisted record. Projecting a record must be
  // idempotent because interactions refer to option keys and prompt indexes.
  const set = normalizeStoredStudySet(record.rawSet);
  const projectedSet = {
    ...set,
    slug: record.slug ?? set.slug,
  };

  if (record.source) {
    projectedSet.source = record.source;
  }

  return projectedSet;
}

export function selectLocalStudySets(records = []) {
  return records.map(getStudySetFromRecord).filter(Boolean);
}

export function selectFirstLocalSet(records = []) {
  return selectLocalStudySets(records)[0] ?? null;
}

export function selectLocalSetBySlug(records = [], slug) {
  return (
    records.reduce((matchingSet, record) => {
      if (matchingSet || record.slug !== slug) {
        return matchingSet;
      }

      return getStudySetFromRecord(record);
    }, null) ?? null
  );
}

export function getSetCategories(set) {
  return normalizeCategoryPath(set?.category);
}

export function getSetCategoryPath(set) {
  return getSetCategories(set).join(" / ");
}

function createCategoryNode(path, name) {
  const normalizedPath = path.join("/");

  return {
    type: "category",
    key: `category:${normalizedPath}`,
    name,
    path: normalizedPath,
    children: [],
  };
}

function createSetNode(set) {
  return {
    type: "set",
    key: `set:${set.slug}`,
    set,
  };
}

function addSetToNavigationTree(nodes, set, path, depth = 0) {
  if (depth >= path.length) {
    nodes.push(createSetNode(set));
    return;
  }

  const currentPath = path.slice(0, depth + 1);
  const folderName = path[depth];
  let categoryNode = nodes.find(
    (node) => node.type === "category" && node.name === folderName,
  );

  if (!categoryNode) {
    categoryNode = createCategoryNode(currentPath, folderName);
    nodes.push(categoryNode);
  }

  addSetToNavigationTree(categoryNode.children, set, path, depth + 1);
}

export function getSetNavigationTree(sourceSets = []) {
  const tree = [];

  for (const set of sourceSets) {
    addSetToNavigationTree(tree, set, getSetCategories(set));
  }

  return tree;
}

const typeLabels = {
  true_false: "True / False",
  multiple_choice: "Multiple Choice",
  multiple_response: "Multiple Response",
  fill_in_the_blank: "Fill in the Blank",
  ordering: "Ordering",
  matching: "Matching",
  short_answer: "Short Answer",
};

export function humanizeType(type) {
  return typeLabels[type] ?? type;
}

export function formatAnswer(card) {
  switch (card.type) {
    case "true_false":
      return card.answer ? "True" : "False";

    case "multiple_choice":
      return `${card.answer.toUpperCase()}. ${card.options[card.answer]}`;

    case "multiple_response":
      return card.answer
        .map((key) => `${key.toUpperCase()}. ${card.options[key]}`)
        .join(", ");

    case "fill_in_the_blank":
      return card.answer.join(" or ");

    case "ordering":
      return card.answer.map((item, i) => `${i + 1}. ${item}`).join("\n");

    case "matching":
      return card.answer
        .map((pair) => `${pair.prompt} → ${pair.choices.join(", ")}`)
        .join("\n");

    case "short_answer":
      return card.answer;

    default:
      return String(card.answer);
  }
}
