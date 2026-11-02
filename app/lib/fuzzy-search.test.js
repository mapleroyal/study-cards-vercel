import { describe, expect, it } from "vitest";
import { createFuzzyFilter, createFuzzySearch } from "./fuzzy-search";

describe("local fuzzy search", () => {
  const items = [
    {
      id: "security",
      text: "Chapter 4: Network Security. Computing / Certification",
    },
    { id: "biology", text: "Cell Biology. Science" },
    { id: "cafe", text: "Café vocabulary. Languages" },
  ];
  const search = createFuzzySearch(items, (item) => item.text);

  it("updates from partial words, misspellings, reordered terms and category words", () => {
    for (const query of [
      "net",
      "netwrok",
      "securty netwrok",
      "certifiction network",
    ]) {
      expect(search(query).map((item) => item.id)).toEqual(["security"]);
    }
    expect(search("CAFE").map((item) => item.id)).toEqual(["cafe"]);
  });

  it("narrows on every word and preserves the original collection when cleared", () => {
    expect(search("network biology")).toEqual([]);
    expect(search("zzzzzzzzzz")).toEqual([]);
    expect(search("  ")).toBe(items);
    expect(search("biology")[0]).toBe(items[1]);
    expect(items.map((item) => item.id)).toEqual([
      "security",
      "biology",
      "cafe",
    ]);
  });

  it("finds terms past the beginning of a long title", () => {
    const item =
      "A long title with many introductory words before the specific topic: Cryptography";
    expect(createFuzzySearch([item])("cryptograpy")).toEqual([item]);
  });

  it("lets Base UI filter stable IDs without changing selected values", () => {
    const ids = ["provider/model-a", "provider/model-b"];
    const filter = createFuzzyFilter(ids, (id) =>
      id === ids[0] ? "Claude Haiku" : "GPT Sol",
    );
    expect(ids.filter((id) => filter(id, "haikuu"))).toEqual([ids[0]]);
    expect(ids.filter((id) => filter(id, "sol"))).toEqual([ids[1]]);
    expect(ids.filter((id) => filter(id, ""))).toEqual(ids);
    expect(createFuzzySearch([])("test")).toEqual([]);
  });
});
