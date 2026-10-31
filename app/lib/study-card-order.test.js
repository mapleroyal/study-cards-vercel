import { describe, expect, it } from "vitest";
import { createBalancedQuestionOrder } from "./study-card-order";

function makeCards(counts) {
  let id = 0;
  return counts.flatMap((count, type) =>
    Array.from({ length: count }, () => ({ id: id++, type: `type-${type}` })),
  );
}
function seededRandom(seed) {
  let state = seed;
  return () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
}
function typeSequence(cards, order) {
  const types = new Map(cards.map((card) => [card.id, card.type]));
  return order.map((id) => types.get(id));
}
function longestRun(values) {
  let longest = 0;
  let run = 0;
  let previous;
  for (const value of values) {
    run = value === previous ? run + 1 : 1;
    previous = value;
    longest = Math.max(longest, run);
  }
  return longest;
}

describe("balanced question order", () => {
  it.each([
    { counts: [4, 4, 4], maxRun: 1 },
    { counts: [3, 2, 2], maxRun: 1 },
    { counts: [2, 2, 2, 2, 2, 2, 1], maxRun: 1 },
    { counts: [8, 1, 1], maxRun: 3 },
    { counts: [1, 2, 2, 5], maxRun: 1 },
    { counts: [11, 3, 2, 1], maxRun: 2 },
    { counts: [100, 4, 3, 2, 1], maxRun: 10 },
  ])("spreads types proportionally for $counts", ({ counts, maxRun }) => {
    const cards = makeCards(counts);
    const original = globalThis.structuredClone(cards);
    for (const seed of [1, 3, 17, 42]) {
      const order = createBalancedQuestionOrder(cards, seededRandom(seed));
      expect([...order].sort((a, b) => a - b)).toEqual(
        cards.map((card) => card.id),
      );
      const types = typeSequence(cards, order);
      expect(longestRun(types)).toBeLessThanOrEqual(maxRun);
      const seen = new Map();
      for (let index = 0; index < types.length; index += 1) {
        seen.set(types[index], (seen.get(types[index]) || 0) + 1);
        counts.forEach((count, type) => {
          const expected = ((index + 1) * count) / cards.length;
          expect(
            Math.abs((seen.get(`type-${type}`) || 0) - expected),
          ).toBeLessThan(1);
        });
      }
    }
    expect(cards).toEqual(original);
  });

  it("never exceeds the smallest feasible run across bounded four-type count vectors", () => {
    for (let a = 1; a <= 4; a += 1) {
      for (let b = 1; b <= 4; b += 1) {
        for (let c = 1; c <= 4; c += 1) {
          for (let d = 1; d <= 5; d += 1) {
            const counts = [a, b, c, d];
            const cards = makeCards(counts);
            const largest = Math.max(...counts);
            const minimumRun = Math.ceil(
              largest / (cards.length - largest + 1),
            );
            for (const seed of [1, 17, 42]) {
              const order = createBalancedQuestionOrder(
                cards,
                seededRandom(seed),
              );
              expect(new Set(order).size).toBe(cards.length);
              expect(
                longestRun(typeSequence(cards, order)),
              ).toBeLessThanOrEqual(minimumRun);
            }
          }
        }
      }
    }
  });

  it("randomizes cards inside each type while preserving every ID", () => {
    const cards = makeCards([4, 4]);
    const order = createBalancedQuestionOrder(cards, () => 0);
    expect(order.filter((id) => id < 4)).toEqual([1, 2, 3, 0]);
    expect(order.filter((id) => id >= 4)).toEqual([5, 6, 7, 4]);
  });

  it("keeps retained within-type order while balancing added and removed cards", () => {
    const cards = makeCards([4, 3]);
    const original = createBalancedQuestionOrder(cards, seededRandom(42));
    const edited = cards.filter((card) => card.id !== 1);
    edited.push({ id: 7, type: "type-1" });
    const order = createBalancedQuestionOrder(
      edited,
      seededRandom(17),
      original,
    );
    expect(new Set(order)).toEqual(new Set(edited.map((card) => card.id)));
    for (const type of ["type-0", "type-1"]) {
      const retainedIds = new Set(
        edited
          .filter((card) => card.type === type && card.id !== 7)
          .map((card) => card.id),
      );
      expect(order.filter((id) => retainedIds.has(id))).toEqual(
        original.filter((id) => retainedIds.has(id)),
      );
    }
    expect(longestRun(typeSequence(edited, order))).toBe(1);
  });

  it("handles empty, singleton and single-type sets", () => {
    expect(createBalancedQuestionOrder([])).toEqual([]);
    expect(createBalancedQuestionOrder([{ id: 23, type: "one" }])).toEqual([
      23,
    ]);
    expect(createBalancedQuestionOrder(makeCards([5]), () => 0)).toEqual([
      1, 2, 3, 4, 0,
    ]);
  });
});
