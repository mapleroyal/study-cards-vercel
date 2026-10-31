import { z } from "zod";

const supportedCardTypes = [
  "true_false",
  "multiple_choice",
  "multiple_response",
  "fill_in_the_blank",
  "ordering",
  "matching",
  "short_answer",
];
const generatedStudySetCardCount = {
  min: 1,
  default: 25,
};

// Validate the study-set contract, not arbitrary text lengths or collection sizes.
const nonEmptyString = z.string().trim().min(1, "Required.");
const titleSchema = nonEmptyString;
const categorySchema = nonEmptyString;
const questionSchema = nonEmptyString;
const explanationSchema = nonEmptyString;
const answerStringSchema = nonEmptyString;
const optionKeySchema = nonEmptyString;
const answerStringArraySchema = z.array(answerStringSchema);
const optionsSchema = z
  .record(optionKeySchema, answerStringSchema)
  .refine((options) => Object.keys(options).length > 0, {
    message: "At least one option is required.",
  });

const baseCardSchema = z.object({
  id: z
    .number()
    .int("Card ID must be a whole number.")
    .min(0, "Card ID must be zero or greater.")
    .max(Number.MAX_SAFE_INTEGER, "Card ID is too large."),
  question: questionSchema,
  explanation: explanationSchema,
});

function hasDuplicateValues(values) {
  return new Set(values).size !== values.length;
}

function countValues(values) {
  const counts = new Map();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function haveSameMembers(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  const leftCounts = countValues(left);
  const rightCounts = countValues(right);

  if (leftCounts.size !== rightCounts.size) {
    return false;
  }

  for (const [value, count] of leftCounts) {
    if (rightCounts.get(value) !== count) {
      return false;
    }
  }

  return true;
}

function requireOptionKey(card, value, ctx, path = ["answer"]) {
  if (!Object.hasOwn(card.options, value)) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "Answer must match an option key.",
    });
  }
}

const trueFalseCardSchema = baseCardSchema.extend({
  type: z.literal("true_false"),
  answer: z.boolean(),
});

const multipleChoiceCardSchema = baseCardSchema
  .extend({
    type: z.literal("multiple_choice"),
    options: optionsSchema,
    answer: optionKeySchema,
  })
  .superRefine((card, ctx) => {
    requireOptionKey(card, card.answer, ctx);
  });

const multipleResponseCardSchema = baseCardSchema
  .extend({
    type: z.literal("multiple_response"),
    options: optionsSchema,
    answer: answerStringArraySchema.min(1, "At least one answer is required."),
  })
  .superRefine((card, ctx) => {
    if (hasDuplicateValues(card.answer)) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "Answer option keys must be unique.",
      });
    }

    card.answer.forEach((answer, index) => {
      requireOptionKey(card, answer, ctx, ["answer", index]);
    });
  });

const fillInTheBlankCardSchema = baseCardSchema.extend({
  type: z.literal("fill_in_the_blank"),
  answer: answerStringArraySchema.min(1, "At least one answer is required."),
});

const orderingCardSchema = baseCardSchema
  .extend({
    type: z.literal("ordering"),
    unordered_items: z
      .array(answerStringSchema)
      .min(1, "At least one item is required."),
    answer: z
      .array(answerStringSchema)
      .min(1, "At least one answer is required."),
  })
  .superRefine((card, ctx) => {
    if (hasDuplicateValues(card.unordered_items)) {
      ctx.addIssue({
        code: "custom",
        path: ["unordered_items"],
        message: "Ordering items must be unique.",
      });
    }

    if (!haveSameMembers(card.answer, card.unordered_items)) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "Answer must contain the same items as unordered_items.",
      });
    }
  });

const matchingAnswerSchema = z.object({
  prompt: answerStringSchema,
  choices: z
    .array(answerStringSchema)
    .min(1, "At least one choice is required."),
});

const matchingCardSchema = baseCardSchema
  .extend({
    type: z.literal("matching"),
    prompts: z
      .array(answerStringSchema)
      .min(1, "At least one prompt is required."),
    choices: z
      .array(answerStringSchema)
      .min(1, "At least one choice is required."),
    answer: z.array(matchingAnswerSchema),
  })
  .superRefine((card, ctx) => {
    if (hasDuplicateValues(card.prompts)) {
      ctx.addIssue({
        code: "custom",
        path: ["prompts"],
        message: "Prompts must be unique.",
      });
    }

    if (hasDuplicateValues(card.choices)) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choices must be unique.",
      });
    }

    const promptSet = new Set(card.prompts);
    const choiceSet = new Set(card.choices);
    const answeredPrompts = new Set();
    const assignedChoices = new Set();

    if (card.answer.length !== card.prompts.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "Provide one answer entry for each prompt.",
      });
    }

    card.answer.forEach((answer, answerIndex) => {
      if (!promptSet.has(answer.prompt)) {
        ctx.addIssue({
          code: "custom",
          path: ["answer", answerIndex, "prompt"],
          message: "Answer prompt must match a prompt.",
        });
      }

      if (answeredPrompts.has(answer.prompt)) {
        ctx.addIssue({
          code: "custom",
          path: ["answer", answerIndex, "prompt"],
          message: "Answer prompts must be unique.",
        });
      }

      answeredPrompts.add(answer.prompt);

      answer.choices.forEach((choice, choiceIndex) => {
        if (!choiceSet.has(choice)) {
          ctx.addIssue({
            code: "custom",
            path: ["answer", answerIndex, "choices", choiceIndex],
            message: "Answer choice must match a choice.",
          });
        }

        if (assignedChoices.has(choice)) {
          ctx.addIssue({
            code: "custom",
            path: ["answer", answerIndex, "choices", choiceIndex],
            message: "Answer choices must be assigned once.",
          });
        }

        assignedChoices.add(choice);
      });
    });
  });

const shortAnswerCardSchema = baseCardSchema.extend({
  type: z.literal("short_answer"),
  answer: answerStringSchema,
});

export const studySetImportSchema = z
  .object({
    title: titleSchema,
    category: categorySchema,
    cards: z
      .array(
        z.discriminatedUnion("type", [
          trueFalseCardSchema,
          multipleChoiceCardSchema,
          multipleResponseCardSchema,
          fillInTheBlankCardSchema,
          orderingCardSchema,
          matchingCardSchema,
          shortAnswerCardSchema,
        ]),
      )
      .min(1, "At least one card is required."),
  })
  .superRefine((set, ctx) => {
    const seenCardIds = new Set();

    set.cards.forEach((card, index) => {
      if (seenCardIds.has(card.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["cards", index, "id"],
          message: "Card IDs must be unique.",
        });
      }

      seenCardIds.add(card.id);
    });
  });

export class StudySetValidationError extends Error {
  constructor(issues) {
    super(formatStudySetValidationIssues(issues));
    this.name = "StudySetValidationError";
    this.issues = issues;
  }
}

function formatIssuePath(path) {
  if (!path.length) {
    return "Study set";
  }

  return path.reduce((formattedPath, segment) => {
    if (typeof segment === "number") {
      return `${formattedPath}[${segment}]`;
    }

    return formattedPath ? `${formattedPath}.${segment}` : segment;
  }, "");
}

export function formatStudySetValidationIssues(issues) {
  const issue = issues[0];

  if (!issue) {
    return "Study set JSON is invalid.";
  }

  if (issue.code === "invalid_union" && issue.discriminator === "type") {
    return `${formatIssuePath(issue.path)}: Unsupported card type.`;
  }

  return `${formatIssuePath(issue.path)}: ${issue.message}`;
}

export function validateStudySetImport(input) {
  const result = studySetImportSchema.safeParse(input);

  if (!result.success) {
    throw new StudySetValidationError(result.error.issues);
  }

  return result.data;
}

function normalizeGeneratedCardCount(cardCount) {
  if (cardCount === undefined) {
    return generatedStudySetCardCount.default;
  }

  if (
    !Number.isSafeInteger(cardCount) ||
    cardCount < generatedStudySetCardCount.min
  ) {
    throw new StudySetValidationError([
      {
        code: "custom",
        path: ["cards"],
        message:
          "Generated study set card count must be a positive safe integer.",
      },
    ]);
  }

  return cardCount;
}

function normalizeGeneratedCardTypes(allowedCardTypes) {
  const normalizedTypes = Array.isArray(allowedCardTypes)
    ? allowedCardTypes.filter((type) => supportedCardTypes.includes(type))
    : supportedCardTypes;

  if (!normalizedTypes.length) {
    throw new StudySetValidationError([
      {
        code: "custom",
        path: ["cards"],
        message: "At least one generated study set card type is required.",
      },
    ]);
  }

  return new Set(normalizedTypes);
}

export function validateGeneratedStudySet(input, options = {}) {
  const set = validateStudySetImport(input);
  const cardCount = normalizeGeneratedCardCount(options.cardCount);
  const allowedCardTypes = normalizeGeneratedCardTypes(
    options.allowedCardTypes,
  );

  if (set.cards.length !== cardCount) {
    throw new StudySetValidationError([
      {
        code: "custom",
        path: ["cards"],
        message: `Generated study set must contain exactly ${cardCount} cards.`,
      },
    ]);
  }

  const disallowedCardIndex = set.cards.findIndex(
    (card) => !allowedCardTypes.has(card.type),
  );

  if (disallowedCardIndex >= 0) {
    throw new StudySetValidationError([
      {
        code: "custom",
        path: ["cards", disallowedCardIndex, "type"],
        message: "Generated card type was not allowed.",
      },
    ]);
  }

  return set;
}

export function getStudySetImportErrorMessage(error) {
  if (error instanceof SyntaxError) {
    return "That file is not valid JSON.";
  }

  if (error instanceof StudySetValidationError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Study set could not be imported.";
}

export { generatedStudySetCardCount, supportedCardTypes };
