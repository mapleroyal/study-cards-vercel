import Fuse from "fuse.js";

// One local index per collection. Token search tolerates typos and word order,
// while requiring every query word so adding words narrows the results.
export function createFuzzySearch(items, getText = String) {
  const index = new Fuse(
    items.map((item) => ({ item, text: getText(item) })),
    {
      keys: ["text"],
      useTokenSearch: true,
      tokenMatch: "all",
      threshold: 0.35,
      ignoreLocation: true,
      ignoreDiacritics: true,
    },
  );
  return (query) => {
    const text = query.trim();
    return text ? index.search(text).map(({ item }) => item.item) : items;
  };
}

// Base UI invokes a predicate for each item. Cache one result set per query,
// preserving its native selection, highlighting and keyboard behavior.
export function createFuzzyFilter(items, getText = String) {
  const search = createFuzzySearch(items, getText);
  let previousQuery;
  let matches;
  return (item, query) => {
    const text = query.trim();
    if (text !== previousQuery) {
      previousQuery = text;
      matches = new Set(search(text));
    }
    return matches.has(item);
  };
}
