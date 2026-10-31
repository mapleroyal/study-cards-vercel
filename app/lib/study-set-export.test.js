import { describe, expect, it } from "vitest";
import studyPack from "@/content/study-packs/public/general-knowledge.json";
import { validateStudySetImport } from "@/lib/study-set-validation";
import { createStudySetExport } from "./study-set-export";

describe("portable study-set export", () => {
  it("round-trips every card type in saved order without exporting account or reader state", () => {
    const rawSet = globalThis.structuredClone({
      ...studyPack,
      cards: studyPack.cards.slice(0, 7),
    });
    const choice = rawSet.cards.find((card) => card.type === "multiple_choice");
    choice.options = Object.fromEntries(
      Object.entries(choice.options).reverse(),
    );
    const before = globalThis.structuredClone(rawSet);
    const { content } = createStudySetExport({
      id: "private-record-id",
      slug: "private-record-slug",
      revision: 9,
      source: { sourceId: "private-source-id" },
      openRouterKey: "private-key-sentinel",
      interactions: { 1: { selectedAnswer: true } },
      questionOrder: [...rawSet.cards].reverse().map((card) => card.id),
      rawSet,
    });
    const exported = JSON.parse(content);
    expect(validateStudySetImport(exported)).toEqual(rawSet);
    expect(new Set(exported.cards.map((card) => card.type)).size).toBe(7);
    expect(
      Object.keys(
        exported.cards.find((card) => card.type === "multiple_choice").options,
      ),
    ).toEqual(Object.keys(choice.options));
    expect(exported).toEqual(before);
    expect(rawSet).toEqual(before);
    expect(content).not.toMatch(/private-|questionOrder|interactions/);
  });

  it("creates usable filenames for path punctuation, non-Latin titles and very long titles", () => {
    for (const title of [
      "../CON: biology / cells?",
      "細胞と遺伝子",
      "A".repeat(500),
      "... / ",
    ]) {
      const { filename } = createStudySetExport({
        rawSet: { title, category: "Science", cards: [] },
      });
      expect(filename).toMatch(/^study-cards-.+\.json$/);
      expect(filename).not.toMatch(/[<>:"/\\|?*]/);
      expect(new globalThis.TextEncoder().encode(filename).length).toBeLessThan(
        255,
      );
    }
  });
});
