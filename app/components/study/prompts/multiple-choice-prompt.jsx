import { SelectionPromptOptions } from "@/components/study/prompts/selection-prompt-options";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";

export function MultipleChoicePrompt({
  card,
  interaction,
  questionId,
  setSlug,
}) {
  const setSelectedOption = useStudyInteractionsStore(
    (state) => state.setSelectedOption,
  );

  return (
    <SelectionPromptOptions
      card={card}
      questionId={questionId}
      isOptionChecked={(optionKey) => interaction.selectedOption === optionKey}
      onOptionPress={(optionKey) => setSelectedOption(setSlug, card, optionKey)}
    />
  );
}
