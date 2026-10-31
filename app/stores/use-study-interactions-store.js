import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STUDY_INTERACTIONS_STORAGE_KEY } from "@/lib/app-config";

export { STUDY_INTERACTIONS_STORAGE_KEY };

export const studyInteractionLimits = Object.freeze({
  maxTextResponseCharacters: 5_000,
});

function resolveStorage(storage) {
  return storage ?? globalThis?.window?.localStorage;
}

function createStateStorage(storage) {
  return {
    getItem(name) {
      const resolvedStorage = resolveStorage(storage);

      if (typeof resolvedStorage?.getItem !== "function") {
        return null;
      }

      try {
        return resolvedStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const resolvedStorage = resolveStorage(storage);

      if (typeof resolvedStorage?.setItem !== "function") {
        return;
      }

      try {
        resolvedStorage.setItem(name, value);
      } catch {
        // Interaction persistence is best-effort when storage is unavailable.
      }
    },
    removeItem(name) {
      const resolvedStorage = resolveStorage(storage);

      if (typeof resolvedStorage?.removeItem !== "function") {
        return;
      }

      try {
        resolvedStorage.removeItem(name);
      } catch {
        // Interaction persistence is best-effort when storage is unavailable.
      }
    },
  };
}

function countValues(values) {
  const counts = new Map();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function haveSameMembers(left, right) {
  if (!Array.isArray(left) || left.length !== right.length) {
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

function hasCardOption(card, optionKey) {
  return Object.hasOwn(card.options ?? {}, optionKey);
}

function sanitizeSelectedOption(card, selectedOption) {
  if (hasCardOption(card, selectedOption)) {
    return selectedOption;
  }

  return null;
}

function sanitizeSelectedOptions(card, selectedOptions) {
  if (!Array.isArray(selectedOptions)) {
    return [];
  }

  const seen = new Set();

  return selectedOptions.filter((optionKey) => {
    if (!hasCardOption(card, optionKey) || seen.has(optionKey)) {
      return false;
    }

    seen.add(optionKey);
    return true;
  });
}

function sanitizeTrueFalseAnswer(selectedAnswer) {
  return typeof selectedAnswer === "boolean" ? selectedAnswer : null;
}

function sanitizeTextResponse(response) {
  return typeof response === "string"
    ? response.slice(0, studyInteractionLimits.maxTextResponseCharacters)
    : "";
}

function sanitizeOrderedItems(card, items) {
  if (!haveSameMembers(items, card.unordered_items)) {
    return [...card.unordered_items];
  }

  return [...items];
}

function sanitizeMatchingAssignments(card, assignments) {
  const defaults = card.prompts.map(() => []);

  if (!Array.isArray(assignments)) {
    return defaults;
  }

  const usedChoices = new Set();

  return defaults.map((_, index) => {
    const assignedChoices = assignments[index];

    if (!Array.isArray(assignedChoices)) {
      return [];
    }

    return assignedChoices.filter((choice) => {
      if (
        typeof choice !== "string" ||
        !card.choices.includes(choice) ||
        usedChoices.has(choice)
      ) {
        return false;
      }

      usedChoices.add(choice);
      return true;
    });
  });
}

function isArrayEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => {
    const rightValue = right[index];

    if (Array.isArray(value) && Array.isArray(rightValue)) {
      return isArrayEqual(value, rightValue);
    }

    return value === rightValue;
  });
}

function isPatchEqual(left, right) {
  const leftKeys = Object.keys(left ?? {});
  const rightKeys = Object.keys(right ?? {});

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      return isArrayEqual(leftValue, rightValue);
    }

    return leftValue === rightValue;
  });
}

function getNextSetInteractions(setInteractions, cardId, patch) {
  const nextSetInteractions = { ...setInteractions };

  if (Object.keys(patch).length === 0) {
    delete nextSetInteractions[cardId];
  } else {
    nextSetInteractions[cardId] = patch;
  }

  return nextSetInteractions;
}

export function getDefaultStudyInteraction(card) {
  const baseInteraction = { answerOpen: false };

  switch (card.type) {
    case "multiple_choice":
      return {
        ...baseInteraction,
        selectedOption: null,
      };

    case "multiple_response":
      return {
        ...baseInteraction,
        selectedOptions: [],
      };

    case "ordering":
      return {
        ...baseInteraction,
        items: [...card.unordered_items],
      };

    case "matching":
      return {
        ...baseInteraction,
        assignments: card.prompts.map(() => []),
      };

    case "true_false":
      return {
        ...baseInteraction,
        selectedAnswer: null,
      };

    case "fill_in_the_blank":
    case "short_answer":
      return {
        ...baseInteraction,
        response: "",
      };

    default:
      return baseInteraction;
  }
}

export function mergeStudyInteraction(card, persistedPatch) {
  const defaultInteraction = getDefaultStudyInteraction(card);

  if (!persistedPatch) {
    return defaultInteraction;
  }

  const mergedInteraction = {
    ...defaultInteraction,
    answerOpen: persistedPatch.answerOpen === true,
  };

  switch (card.type) {
    case "multiple_choice":
      mergedInteraction.selectedOption = sanitizeSelectedOption(
        card,
        persistedPatch.selectedOption,
      );
      break;

    case "multiple_response":
      mergedInteraction.selectedOptions = sanitizeSelectedOptions(
        card,
        persistedPatch.selectedOptions,
      );
      break;

    case "ordering":
      mergedInteraction.items = sanitizeOrderedItems(
        card,
        persistedPatch.items,
      );
      break;

    case "matching":
      mergedInteraction.assignments = sanitizeMatchingAssignments(
        card,
        persistedPatch.assignments,
      );
      break;

    case "true_false":
      mergedInteraction.selectedAnswer = sanitizeTrueFalseAnswer(
        persistedPatch.selectedAnswer,
      );
      break;

    case "fill_in_the_blank":
    case "short_answer":
      mergedInteraction.response = sanitizeTextResponse(
        persistedPatch.response,
      );
      break;
  }

  return mergedInteraction;
}

export function getStudyInteractionPatch(card, interaction) {
  const defaultInteraction = getDefaultStudyInteraction(card);
  const mergedInteraction = mergeStudyInteraction(card, interaction);
  const patch = {};

  if (mergedInteraction.answerOpen !== defaultInteraction.answerOpen) {
    patch.answerOpen = mergedInteraction.answerOpen;
  }

  switch (card.type) {
    case "multiple_choice":
      if (
        mergedInteraction.selectedOption !== defaultInteraction.selectedOption
      ) {
        patch.selectedOption = mergedInteraction.selectedOption;
      }
      break;

    case "multiple_response":
      if (
        !isArrayEqual(
          mergedInteraction.selectedOptions,
          defaultInteraction.selectedOptions,
        )
      ) {
        patch.selectedOptions = mergedInteraction.selectedOptions;
      }
      break;

    case "ordering":
      if (!isArrayEqual(mergedInteraction.items, defaultInteraction.items)) {
        patch.items = mergedInteraction.items;
      }
      break;

    case "matching":
      if (
        !isArrayEqual(
          mergedInteraction.assignments,
          defaultInteraction.assignments,
        )
      ) {
        patch.assignments = mergedInteraction.assignments;
      }
      break;

    case "true_false":
      if (mergedInteraction.selectedAnswer !== null) {
        patch.selectedAnswer = mergedInteraction.selectedAnswer;
      }
      break;

    case "fill_in_the_blank":
    case "short_answer":
      if (mergedInteraction.response !== "") {
        patch.response = mergedInteraction.response;
      }
      break;
  }

  return patch;
}

export function isStudyInteractionDirty(card, persistedPatch) {
  return Object.keys(getStudyInteractionPatch(card, persistedPatch)).length > 0;
}

export function hasDirtyStudyInteractions(cards, setInteractions = {}) {
  return cards.some((card) =>
    isStudyInteractionDirty(card, setInteractions?.[card.id]),
  );
}

export function assignMatchingChoiceToPrompt(assignments, promptIndex, choice) {
  const currentAssignments = assignments.map((assignedChoices) =>
    Array.isArray(assignedChoices) ? assignedChoices : [],
  );

  if (
    !Number.isInteger(promptIndex) ||
    promptIndex < 0 ||
    promptIndex >= currentAssignments.length
  ) {
    return currentAssignments;
  }

  const targetChoices = currentAssignments[promptIndex] ?? [];

  if (targetChoices.includes(choice)) {
    return currentAssignments;
  }

  return currentAssignments.map((assignedChoices, index) => {
    const nextChoices = assignedChoices.filter(
      (assignedChoice) => assignedChoice !== choice,
    );

    if (index === promptIndex) {
      return [...nextChoices, choice];
    }

    return nextChoices;
  });
}

export function clearMatchingChoiceFromPrompt(
  assignments,
  promptIndex,
  choice,
) {
  if (
    !Number.isInteger(promptIndex) ||
    promptIndex < 0 ||
    promptIndex >= assignments.length
  ) {
    return assignments.map((assignedChoices) =>
      Array.isArray(assignedChoices) ? assignedChoices : [],
    );
  }

  return assignments.map((assignedChoices, index) => {
    const nextChoices = Array.isArray(assignedChoices) ? assignedChoices : [];

    if (index !== promptIndex) {
      return nextChoices;
    }

    if (typeof choice !== "string") {
      return [];
    }

    return nextChoices.filter((assignedChoice) => assignedChoice !== choice);
  });
}

function updateStudyInteraction(interactionsBySet, setSlug, card, updater) {
  const setInteractions = interactionsBySet[setSlug] ?? {};
  const currentPatch = setInteractions[card.id];
  const currentInteraction = mergeStudyInteraction(card, currentPatch);
  const nextInteraction = updater(currentInteraction);
  const nextPatch = getStudyInteractionPatch(card, nextInteraction);

  if (isPatchEqual(currentPatch, nextPatch)) {
    return interactionsBySet;
  }

  const nextSetInteractions = getNextSetInteractions(
    setInteractions,
    card.id,
    nextPatch,
  );

  if (Object.keys(nextSetInteractions).length === 0) {
    if (!(setSlug in interactionsBySet)) {
      return interactionsBySet;
    }

    const remainingInteractions = { ...interactionsBySet };
    delete remainingInteractions[setSlug];
    return remainingInteractions;
  }

  return {
    ...interactionsBySet,
    [setSlug]: nextSetInteractions,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizePersistedInteractionsBySet(value) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([setSlug, setInteractions]) =>
          setSlug.length > 0 && isRecord(setInteractions),
      )
      .map(([setSlug, setInteractions]) => [
        setSlug,
        Object.fromEntries(
          Object.entries(setInteractions).filter(([, patch]) =>
            isRecord(patch),
          ),
        ),
      ]),
  );
}

function mergePersistedState(persistedState, currentState) {
  return {
    ...currentState,
    interactionsBySet: sanitizePersistedInteractionsBySet(
      isRecord(persistedState) ? persistedState.interactionsBySet : null,
    ),
  };
}

export function createStudyInteractionsStore({ storage } = {}) {
  return create(
    persist(
      (set) => ({
        interactionsBySet: {},
        setAnswerOpen: (setSlug, card, answerOpen) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                answerOpen,
              }),
            ),
          })),
        toggleAnswerOpen: (setSlug, card) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                answerOpen: !interaction.answerOpen,
              }),
            ),
          })),
        setSelectedOption: (setSlug, card, selectedOption) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                selectedOption,
              }),
            ),
          })),
        toggleSelectedOption: (setSlug, card, optionKey) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                selectedOption:
                  interaction.selectedOption === optionKey ? null : optionKey,
              }),
            ),
          })),
        toggleSelectedResponseOption: (setSlug, card, optionKey) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                selectedOptions: interaction.selectedOptions.includes(optionKey)
                  ? interaction.selectedOptions.filter(
                      (selectedOption) => selectedOption !== optionKey,
                    )
                  : [...interaction.selectedOptions, optionKey],
              }),
            ),
          })),
        setOrderingItems: (setSlug, card, items) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                items,
              }),
            ),
          })),
        assignMatchingChoice: (setSlug, card, promptIndex, choice) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                assignments: assignMatchingChoiceToPrompt(
                  interaction.assignments,
                  promptIndex,
                  choice,
                ),
              }),
            ),
          })),
        clearMatchingAssignment: (setSlug, card, promptIndex, choice) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                assignments: clearMatchingChoiceFromPrompt(
                  interaction.assignments,
                  promptIndex,
                  choice,
                ),
              }),
            ),
          })),
        setTrueFalseAnswer: (setSlug, card, selectedAnswer) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                selectedAnswer,
              }),
            ),
          })),
        setTextResponse: (setSlug, card, response) =>
          set((state) => ({
            interactionsBySet: updateStudyInteraction(
              state.interactionsBySet,
              setSlug,
              card,
              (interaction) => ({
                ...interaction,
                response: sanitizeTextResponse(response),
              }),
            ),
          })),
        resetSet: (setSlug) =>
          set((state) => {
            if (!(setSlug in state.interactionsBySet)) {
              return state;
            }

            const remainingInteractions = { ...state.interactionsBySet };
            delete remainingInteractions[setSlug];

            return {
              interactionsBySet: remainingInteractions,
            };
          }),
        resetSets: (setSlugs) =>
          set((state) => {
            const normalizedSetSlugs = new Set(
              Array.isArray(setSlugs)
                ? setSlugs.filter(
                    (setSlug) =>
                      typeof setSlug === "string" && setSlug.length > 0,
                  )
                : [],
            );

            if (
              !Object.keys(state.interactionsBySet).some((setSlug) =>
                normalizedSetSlugs.has(setSlug),
              )
            ) {
              return state;
            }

            const remainingInteractions = Object.fromEntries(
              Object.entries(state.interactionsBySet).filter(
                ([setSlug]) => !normalizedSetSlugs.has(setSlug),
              ),
            );

            return { interactionsBySet: remainingInteractions };
          }),
      }),
      {
        name: STUDY_INTERACTIONS_STORAGE_KEY,
        storage: createJSONStorage(() => createStateStorage(storage)),
        partialize: (state) => ({
          interactionsBySet: state.interactionsBySet,
        }),
        merge: mergePersistedState,
      },
    ),
  );
}

export const useStudyInteractionsStore = createStudyInteractionsStore();

export function useStudyInteraction(setSlug, card) {
  const persistedPatch = useStudyInteractionsStore(
    (state) => state.interactionsBySet[setSlug]?.[card.id],
  );

  return useMemo(
    () => mergeStudyInteraction(card, persistedPatch),
    [card, persistedPatch],
  );
}
