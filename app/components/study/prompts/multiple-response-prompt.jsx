import { SelectionPromptOptions } from "@/components/study/prompts/selection-prompt-options";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";

export function MultipleResponsePrompt({
  card,
  interaction,
  questionId,
  setSlug,
}) {
  const toggleSelectedResponseOption = useStudyInteractionsStore(
    (state) => state.toggleSelectedResponseOption,
  );

  return (
    <SelectionPromptOptions
      card={card}
      questionId={questionId}
      mode="multiple"
      isOptionChecked={(optionKey) =>
        interaction.selectedOptions.includes(optionKey)
      }
      onOptionPress={(optionKey) =>
        toggleSelectedResponseOption(setSlug, card, optionKey)
      }
    />
  );
}
