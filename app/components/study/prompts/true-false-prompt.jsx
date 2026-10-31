import { SelectionPromptOptions } from "@/components/study/prompts/selection-prompt-options";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";

const TRUE_FALSE_OPTIONS = {
  true: "True",
  false: "False",
};

export function TrueFalsePrompt({ card, interaction, questionId, setSlug }) {
  const setTrueFalseAnswer = useStudyInteractionsStore(
    (state) => state.setTrueFalseAnswer,
  );

  return (
    <SelectionPromptOptions
      card={card}
      options={TRUE_FALSE_OPTIONS}
      questionId={questionId}
      showOptionKeys={false}
      isOptionChecked={(optionKey) =>
        interaction.selectedAnswer === (optionKey === "true")
      }
      onOptionPress={(optionKey) =>
        setTrueFalseAnswer(setSlug, card, optionKey === "true")
      }
    />
  );
}
