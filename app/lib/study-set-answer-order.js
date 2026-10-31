function shuffleValues(values, random) {
  const shuffledValues = [...values];

  for (let index = shuffledValues.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffledValues[index], shuffledValues[swapIndex]] = [
      shuffledValues[swapIndex],
      shuffledValues[index],
    ];
  }

  return shuffledValues;
}

export function randomizeValues(values, random = Math.random) {
  if (values.length < 2) {
    return values;
  }

  const shuffledValues = shuffleValues(values, random);

  return areArraysEqual(shuffledValues, values)
    ? rotateValues(values, 1)
    : shuffledValues;
}

function rotateValues(values, offset) {
  if (values.length < 2) {
    return values;
  }

  const normalizedOffset = offset % values.length;

  return [
    ...values.slice(normalizedOffset),
    ...values.slice(0, normalizedOffset),
  ];
}

function areArraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function mapOptionEntries(optionEntries, shuffledEntries) {
  const oldToNewKey = new Map();
  const nextOptions = {};

  optionEntries.forEach(([nextKey], index) => {
    const [previousKey, label] = shuffledEntries[index];
    nextOptions[nextKey] = label;
    oldToNewKey.set(previousKey, nextKey);
  });

  return { nextOptions, oldToNewKey };
}

function getMappedAnswerKeys(card, optionEntries, shuffledEntries) {
  const { oldToNewKey } = mapOptionEntries(optionEntries, shuffledEntries);

  if (card.type === "multiple_choice") {
    return [oldToNewKey.get(card.answer) ?? card.answer];
  }

  const optionOrder = new Map(
    optionEntries.map(([optionKey], index) => [optionKey, index]),
  );

  return card.answer
    .map((answerKey) => oldToNewKey.get(answerKey) ?? answerKey)
    .sort((left, right) => optionOrder.get(left) - optionOrder.get(right));
}

function getAnswerSignature(answerKeys) {
  return [...answerKeys].sort().join("\u0000");
}

function canChangeAnswerSelection(card, optionEntries) {
  if (card.type === "multiple_choice") {
    return optionEntries.length > 1;
  }

  return card.answer.length > 0 && card.answer.length < optionEntries.length;
}

function chooseOptionOrder(card, optionEntries, random) {
  const originalAnswerSignature = getAnswerSignature(
    card.type === "multiple_choice" ? [card.answer] : card.answer,
  );
  const candidates = [
    shuffleValues(optionEntries, random),
    ...optionEntries
      .slice(1)
      .map((_, index) => rotateValues(optionEntries, index + 1)),
  ];

  for (const candidate of candidates) {
    if (areArraysEqual(candidate, optionEntries)) {
      continue;
    }

    const nextAnswerSignature = getAnswerSignature(
      getMappedAnswerKeys(card, optionEntries, candidate),
    );

    if (
      !canChangeAnswerSelection(card, optionEntries) ||
      nextAnswerSignature !== originalAnswerSignature
    ) {
      return candidate;
    }
  }

  return optionEntries;
}

function randomizeOptionCardAnswerOrder(card, random) {
  const optionEntries = Object.entries(card.options ?? {});

  if (optionEntries.length < 2) {
    return card;
  }

  const shuffledEntries = chooseOptionOrder(card, optionEntries, random);

  if (shuffledEntries === optionEntries) {
    return card;
  }

  const { nextOptions, oldToNewKey } = mapOptionEntries(
    optionEntries,
    shuffledEntries,
  );

  if (card.type === "multiple_choice") {
    return {
      ...card,
      options: nextOptions,
      answer: oldToNewKey.get(card.answer) ?? card.answer,
    };
  }

  const optionOrder = new Map(
    optionEntries.map(([optionKey], index) => [optionKey, index]),
  );

  return {
    ...card,
    options: nextOptions,
    answer: card.answer
      .map((answerKey) => oldToNewKey.get(answerKey) ?? answerKey)
      .sort((left, right) => optionOrder.get(left) - optionOrder.get(right)),
  };
}

function randomizeOrderingCardAnswerOrder(card, random) {
  const items = card.unordered_items ?? [];

  if (items.length < 2) {
    return card;
  }

  return {
    ...card,
    unordered_items: randomizeValues(items, random),
  };
}

function randomizeMatchingCardAnswerOrder(card, random) {
  const prompts = card.prompts ?? [];
  const choices = card.choices ?? [];

  if (prompts.length < 2 && choices.length < 2) {
    return card;
  }

  const nextPrompts = randomizeValues(prompts, random);
  const nextChoices = randomizeValues(choices, random);
  const choiceOrder = new Map(
    nextChoices.map((choice, index) => [choice, index]),
  );
  const answersByPrompt = new Map(
    (card.answer ?? []).map((answer) => [answer.prompt, answer]),
  );

  return {
    ...card,
    prompts: nextPrompts,
    choices: nextChoices,
    answer: nextPrompts
      .map((prompt) => answersByPrompt.get(prompt))
      .filter(Boolean)
      .map((answer) => ({
        ...answer,
        choices: answer.choices
          .filter((choice) => nextChoices.includes(choice))
          .sort(
            (left, right) => choiceOrder.get(left) - choiceOrder.get(right),
          ),
      })),
  };
}

function randomizeCardAnswerOrder(card, random) {
  switch (card.type) {
    case "multiple_choice":
    case "multiple_response":
      return randomizeOptionCardAnswerOrder(card, random);

    case "ordering":
      return randomizeOrderingCardAnswerOrder(card, random);

    case "matching":
      return randomizeMatchingCardAnswerOrder(card, random);

    default:
      return card;
  }
}

export function randomizeStudySetAnswerOrder(
  set,
  { random = Math.random } = {},
) {
  const cards = Array.isArray(set?.cards) ? set.cards : [];
  const randomizedSet = { ...set };

  delete randomizedSet.answerOrderRandomizationVersion;

  return {
    ...randomizedSet,
    cards: cards.map((card) => randomizeCardAnswerOrder(card, random)),
  };
}
