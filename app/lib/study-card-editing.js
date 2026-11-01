// Correct order and the order first shown to the learner are separate data.
export function editOrderingCard(card, answer, change) {
  const unorderedItems = [...card.unordered_items];
  if (change.kind === "edit") {
    const index = unorderedItems.indexOf(card.answer[change.index]);
    if (index !== -1) {
      unorderedItems[index] = answer[change.index];
    }
  } else if (change.kind === "remove") {
    const index = unorderedItems.indexOf(card.answer[change.index]);
    if (index !== -1) {
      unorderedItems.splice(index, 1);
    }
  } else if (change.kind === "add") {
    unorderedItems.unshift(answer.at(-1));
  }
  return { ...card, answer, unordered_items: unorderedItems };
}
