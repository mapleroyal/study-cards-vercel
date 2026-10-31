import { STUDY_FAVORITES_STORAGE_KEY } from "@/lib/app-config";
import {
  getStoredStudyPackIds,
  getUnappliedStudyPackDefaultFavorites,
  markStudyPackDefaultFavoritesApplied,
} from "@/lib/study-pack-activation";
import {
  getSetCategories,
  getSetCategoryPath,
  getSetNavigationTree,
  normalizeCategoryPath,
} from "@/lib/study-sets";

export { STUDY_FAVORITES_STORAGE_KEY };

function resolveStorage(storage) {
  return storage ?? globalThis?.window?.localStorage;
}

function getSetCategoryStoragePath(set) {
  return getSetCategories(set).join("/");
}

export function normalizeFavoriteCategoryPath(path) {
  if (Array.isArray(path)) {
    return normalizeCategoryPath(path.join("/")).join("/");
  }

  return normalizeCategoryPath(path).join("/");
}

export function normalizeFavoriteItem(item) {
  if (item?.type === "set" && typeof item.slug === "string") {
    const slug = item.slug.trim();

    return slug ? { type: "set", slug } : null;
  }

  if (item?.type === "category") {
    const path = normalizeFavoriteCategoryPath(item.path);

    return path ? { type: "category", path } : null;
  }

  return null;
}

export function getFavoriteItemKey(item) {
  const normalizedItem = normalizeFavoriteItem(item);

  if (!normalizedItem) {
    return null;
  }

  return normalizedItem.type === "set"
    ? `set:${normalizedItem.slug}`
    : `category:${normalizedItem.path}`;
}

export function normalizeFavoriteItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seenKeys = new Set();
  const favorites = [];

  for (const item of items) {
    const normalizedItem = normalizeFavoriteItem(item);
    const key = getFavoriteItemKey(normalizedItem);

    if (!normalizedItem || !key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    favorites.push(normalizedItem);
  }

  return favorites;
}

export function areFavoriteItemListsEqual(leftItems, rightItems) {
  const left = normalizeFavoriteItems(leftItems);
  const right = normalizeFavoriteItems(rightItems);

  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    return getFavoriteItemKey(item) === getFavoriteItemKey(right[index]);
  });
}

export function hasFavoriteItem(items, item) {
  const key = getFavoriteItemKey(item);

  if (!key) {
    return false;
  }

  return normalizeFavoriteItems(items).some(
    (favorite) => getFavoriteItemKey(favorite) === key,
  );
}

export function addFavoriteItem(items, item) {
  const normalizedItems = normalizeFavoriteItems(items);
  const normalizedItem = normalizeFavoriteItem(item);
  const key = getFavoriteItemKey(normalizedItem);

  if (
    !normalizedItem ||
    !key ||
    hasFavoriteItem(normalizedItems, normalizedItem)
  ) {
    return normalizedItems;
  }

  return [...normalizedItems, normalizedItem];
}

export function removeFavoriteItem(items, item) {
  const key = getFavoriteItemKey(item);

  if (!key) {
    return normalizeFavoriteItems(items);
  }

  return normalizeFavoriteItems(items).filter(
    (favorite) => getFavoriteItemKey(favorite) !== key,
  );
}

export function toggleFavoriteItem(items, item) {
  return hasFavoriteItem(items, item)
    ? removeFavoriteItem(items, item)
    : addFavoriteItem(items, item);
}

export function getCategoryFavoritePathsForSets(sets = []) {
  const categoryPaths = new Set();

  for (const set of sets) {
    const categoryPath = getSetCategories(set);

    for (let index = 1; index <= categoryPath.length; index += 1) {
      categoryPaths.add(categoryPath.slice(0, index).join("/"));
    }
  }

  return categoryPaths;
}

function isStoredItemAlreadyNormalized(item, normalizedItem) {
  if (!normalizedItem || item?.type !== normalizedItem.type) {
    return false;
  }

  return normalizedItem.type === "set"
    ? item.slug === normalizedItem.slug
    : item.path === normalizedItem.path;
}

export function pruneFavoriteItems(items, sets = []) {
  const normalizedItems = normalizeFavoriteItems(items);
  const normalizedChanged =
    !Array.isArray(items) ||
    items.length !== normalizedItems.length ||
    normalizedItems.some(
      (item, index) => !isStoredItemAlreadyNormalized(items[index], item),
    );
  const setSlugs = new Set(
    sets
      .map((set) => (typeof set?.slug === "string" ? set.slug : null))
      .filter(Boolean),
  );
  const categoryPaths = getCategoryFavoritePathsForSets(sets);
  const favorites = normalizedItems.filter((item) => {
    return item.type === "set"
      ? setSlugs.has(item.slug)
      : categoryPaths.has(item.path);
  });

  return {
    favorites,
    changed:
      normalizedChanged ||
      !areFavoriteItemListsEqual(normalizedItems, favorites),
  };
}

function isCategoryPathCoveredByFavorite(path, favoriteCategoryPaths) {
  const normalizedPath = normalizeFavoriteCategoryPath(path);

  if (!normalizedPath) {
    return false;
  }

  for (const favoritePath of favoriteCategoryPaths) {
    if (
      normalizedPath === favoritePath ||
      normalizedPath.startsWith(`${favoritePath}/`)
    ) {
      return true;
    }
  }

  return false;
}

function cloneNavigationNode(node) {
  if (node.type === "category") {
    return {
      ...node,
      children: node.children.map(cloneNavigationNode),
    };
  }

  return { ...node };
}

function buildFavoriteCategoryNodes(nodes, favoriteCategoryPaths) {
  const selectedNodes = [];

  for (const node of nodes) {
    if (node.type !== "category") {
      continue;
    }

    if (favoriteCategoryPaths.has(node.path)) {
      selectedNodes.push(cloneNavigationNode(node));
      continue;
    }

    const children = buildFavoriteCategoryNodes(
      node.children,
      favoriteCategoryPaths,
    );

    if (children.length) {
      selectedNodes.push({
        ...node,
        children,
      });
    }
  }

  return selectedNodes;
}

function compressCategoryRoot(node, favoriteCategoryPaths) {
  let currentNode = node;

  while (
    currentNode.type === "category" &&
    !favoriteCategoryPaths.has(currentNode.path) &&
    currentNode.children.length === 1 &&
    currentNode.children[0].type === "category"
  ) {
    currentNode = currentNode.children[0];
  }

  return currentNode;
}

function collectStandaloneFavoriteSetNodes(
  nodes,
  favoriteSetSlugs,
  favoriteCategoryPaths,
) {
  const setNodes = [];

  for (const node of nodes) {
    if (node.type === "set") {
      if (
        favoriteSetSlugs.has(node.set.slug) &&
        !isCategoryPathCoveredByFavorite(
          getSetCategoryStoragePath(node.set),
          favoriteCategoryPaths,
        )
      ) {
        setNodes.push({
          ...node,
          categoryPathLabel: getSetCategoryPath(node.set),
        });
      }

      continue;
    }

    setNodes.push(
      ...collectStandaloneFavoriteSetNodes(
        node.children,
        favoriteSetSlugs,
        favoriteCategoryPaths,
      ),
    );
  }

  return setNodes;
}

function indexNavigationNodes(nodes, indexes, nextIndex) {
  for (const node of nodes) {
    indexes.set(node.key, nextIndex.value);
    nextIndex.value += 1;

    if (node.type === "category") {
      indexNavigationNodes(node.children, indexes, nextIndex);
    }
  }
}

export function buildFavoriteNavigationTree(sets = [], items = []) {
  const { favorites } = pruneFavoriteItems(items, sets);
  const favoriteCategoryPaths = new Set(
    favorites
      .filter((favorite) => favorite.type === "category")
      .map((favorite) => favorite.path),
  );
  const favoriteSetSlugs = new Set(
    favorites
      .filter((favorite) => favorite.type === "set")
      .map((favorite) => favorite.slug),
  );

  if (!favoriteCategoryPaths.size && !favoriteSetSlugs.size) {
    return [];
  }

  const navigationTree = getSetNavigationTree(sets);
  const navigationIndexes = new Map();
  indexNavigationNodes(navigationTree, navigationIndexes, { value: 0 });

  const categoryNodes = buildFavoriteCategoryNodes(
    navigationTree,
    favoriteCategoryPaths,
  ).map((node) => compressCategoryRoot(node, favoriteCategoryPaths));
  const standaloneSetNodes = collectStandaloneFavoriteSetNodes(
    navigationTree,
    favoriteSetSlugs,
    favoriteCategoryPaths,
  );

  return [...categoryNodes, ...standaloneSetNodes].sort((left, right) => {
    return (
      (navigationIndexes.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
      (navigationIndexes.get(right.key) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

export function resolveFavoriteStart(sets = [], items = []) {
  const { favorites, changed } = pruneFavoriteItems(items, sets);

  if (favorites.length === 1 && favorites[0].type === "set") {
    return {
      mode: "redirect",
      slug: favorites[0].slug,
      favorites,
      nodes: [],
      changed,
    };
  }

  if (!favorites.length) {
    return {
      mode: "empty",
      slug: null,
      favorites,
      nodes: [],
      changed,
    };
  }

  return {
    mode: "favorites",
    slug: null,
    favorites,
    nodes: buildFavoriteNavigationTree(sets, favorites),
    changed,
  };
}

export function getStoredStudyFavorites(storage) {
  const resolvedStorage = resolveStorage(storage);

  if (typeof resolvedStorage?.getItem !== "function") {
    return [];
  }

  const storedValue = resolvedStorage.getItem(STUDY_FAVORITES_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    return normalizeFavoriteItems(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

export function setStoredStudyFavorites(items, storage) {
  const resolvedStorage = resolveStorage(storage);
  const favorites = normalizeFavoriteItems(items);

  if (typeof resolvedStorage?.setItem !== "function") {
    return favorites;
  }

  resolvedStorage.setItem(
    STUDY_FAVORITES_STORAGE_KEY,
    JSON.stringify(favorites),
  );

  return favorites;
}

export function initializeStoredStudyFavorites(sets = [], storage) {
  const resolvedStorage = resolveStorage(storage);
  let favorites = getStoredStudyFavorites(resolvedStorage);
  const unappliedPackDefaults = getUnappliedStudyPackDefaultFavorites(
    getStoredStudyPackIds(resolvedStorage),
    resolvedStorage,
  );

  if (unappliedPackDefaults.favorites.length) {
    for (const defaultFavorite of normalizeFavoriteItems(
      unappliedPackDefaults.favorites,
    )) {
      favorites = addFavoriteItem(favorites, defaultFavorite);
    }
  }

  const pruned = pruneFavoriteItems(favorites, sets);
  const shouldPersist =
    unappliedPackDefaults.packIds.length > 0 ||
    pruned.changed ||
    !areFavoriteItemListsEqual(favorites, pruned.favorites);

  if (shouldPersist) {
    const storedFavorites = setStoredStudyFavorites(
      pruned.favorites,
      resolvedStorage,
    );

    markStudyPackDefaultFavoritesApplied(
      unappliedPackDefaults.packIds,
      resolvedStorage,
    );

    return storedFavorites;
  }

  return pruned.favorites;
}
