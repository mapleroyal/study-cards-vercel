import * as React from "react";

import { CardContent } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/radio-group";
import { SelectionOptionRow } from "@/components/study/prompts/selection-option-row";

export function SelectionPromptOptions({
  card,
  options = card.options,
  questionId,
  mode = "single",
  isOptionChecked,
  onOptionPress,
  showOptionKeys = true,
}) {
  const controlGroupId = React.useId();
  const optionEntries = Object.entries(options);
  const optionRows = optionEntries.map(([optionKey, label], optionIndex) => (
    <SelectionOptionRow
      key={optionKey}
      controlId={`${controlGroupId}-${optionIndex}`}
      optionKey={optionKey}
      mode={mode}
      checked={isOptionChecked(optionKey)}
      onPress={() => onOptionPress(optionKey)}
      showOptionKey={showOptionKeys}
    >
      {label}
    </SelectionOptionRow>
  ));

  return (
    <CardContent className="pb-4">
      {mode === "multiple" ? (
        <fieldset
          aria-labelledby={questionId}
          className="flex min-w-0 flex-col gap-1"
        >
          {optionRows}
        </fieldset>
      ) : (
        <RadioGroup
          aria-labelledby={questionId}
          value={optionEntries.find(([key]) => isOptionChecked(key))?.[0] ?? ""}
          onValueChange={onOptionPress}
          className="gap-1"
        >
          {optionRows}
        </RadioGroup>
      )}
    </CardContent>
  );
}
