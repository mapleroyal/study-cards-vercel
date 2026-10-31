import { randomizeValues } from "./study-set-answer-order";

// Smooth weighted round-robin spreads each type in proportion to its count.
// A continuation-capacity check also guarantees the smallest feasible maximum
// run: the largest type can occupy at most (other cards + 1) separate runs.
// Random ties avoid a fixed type sequence; cards within each type are shuffled.
export function createBalancedQuestionOrder(
  cards,
  random = Math.random,
  previousOrder,
) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const retained = (previousOrder || []).filter((id) => byId.has(id));
  const seen = new Set(retained);
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.type)) {
      groups.set(card.type, {
        type: card.type,
        ids: [],
        added: [],
        weight: 0,
        score: 0,
        cursor: 0,
      });
    }
    const group = groups.get(card.type);
    group.weight += 1;
    if (!seen.has(card.id)) {
      group.added.push(card.id);
    }
  }
  for (const id of retained) {
    groups.get(byId.get(id).type).ids.push(id);
  }
  for (const group of groups.values()) {
    group.ids.push(...randomizeValues(group.added, random));
  }

  const order = [];
  const largestGroup = Math.max(
    0,
    ...[...groups.values()].map((group) => group.weight),
  );
  const maxRun = Math.max(
    1,
    Math.ceil(largestGroup / (cards.length - largestGroup + 1)),
  );
  let previousType;
  let runLength = 0;
  for (let position = 0; position < cards.length; position += 1) {
    const available = [...groups.values()].filter(
      (group) => group.cursor < group.ids.length,
    );
    for (const group of available) {
      group.score += group.weight;
    }
    const lastType = previousType;
    const currentRun = runLength;
    const remainingAfterPick = cards.length - position - 1;
    const feasible = available.filter((candidate) => {
      const nextRun = candidate.type === lastType ? currentRun + 1 : 1;
      if (nextRun > maxRun) {
        return false;
      }
      return [...groups.values()].every((group) => {
        const remaining =
          group.ids.length - group.cursor - (group === candidate ? 1 : 0);
        const otherCards = remainingAfterPick - remaining;
        // For the selected type the first run is already partly occupied.
        const capacity =
          maxRun * (otherCards + 1) - (group === candidate ? nextRun : 0);
        return remaining <= capacity;
      });
    });
    const highestScore = Math.max(...feasible.map((group) => group.score));
    let candidates = feasible.filter((group) => group.score === highestScore);
    const otherTypes = candidates.filter((group) => group.type !== lastType);
    if (otherTypes.length) {
      candidates = otherTypes;
    }
    const group = candidates[Math.floor(random() * candidates.length)];
    order.push(group.ids[group.cursor++]);
    group.score -= cards.length;
    runLength = group.type === previousType ? runLength + 1 : 1;
    previousType = group.type;
  }
  return order;
}
