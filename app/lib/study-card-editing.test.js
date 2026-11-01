import { describe, expect, it } from "vitest";
import { editOrderingCard } from "./study-card-editing";

const card = {
  id: 1,
  type: "ordering",
  question: "Order the stages.",
  answer: ["First", "Second", "Third"],
  unordered_items: ["Third", "First", "Second"],
};

describe("ordering card edits", () => {
  it("updates an item's text in its presentation position", () => {
    const next = editOrderingCard(
      card,
      ["First corrected", "Second", "Third"],
      { kind: "edit", index: 0 },
    );
    expect(next.unordered_items).toEqual([
      "Third",
      "First corrected",
      "Second",
    ]);
    expect(card.unordered_items).toEqual(["Third", "First", "Second"]);
  });
  it("changes the correct order without copying it into the starting order", () => {
    const next = editOrderingCard(card, ["Second", "First", "Third"], {
      kind: "move",
      from: 0,
      to: 1,
    });
    expect(next.answer).toEqual(["Second", "First", "Third"]);
    expect(next.unordered_items).toEqual(card.unordered_items);
  });
  it("adds and renames an item without reordering existing presentation items", () => {
    const added = editOrderingCard(card, [...card.answer, ""], { kind: "add" });
    const renamed = editOrderingCard(added, [...card.answer, "Fourth"], {
      kind: "edit",
      index: 3,
    });
    expect(renamed.unordered_items).toEqual([
      "Fourth",
      ...card.unordered_items,
    ]);
    expect(renamed.answer).toEqual([...card.answer, "Fourth"]);
  });
  it("removes the corresponding presentation item and preserves the others", () => {
    const next = editOrderingCard(card, ["First", "Third"], {
      kind: "remove",
      index: 1,
    });
    expect(next.unordered_items).toEqual(["Third", "First"]);
  });
});
