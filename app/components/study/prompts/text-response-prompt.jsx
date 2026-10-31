import * as React from "react";

import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";

export function TextResponsePrompt({
  card,
  interaction,
  multiline = false,
  questionId,
  setSlug,
}) {
  const responseId = React.useId();
  const setTextResponse = useStudyInteractionsStore(
    (state) => state.setTextResponse,
  );
  const ResponseControl = multiline ? Textarea : Input;

  return (
    <CardContent className="pb-4">
      <ResponseControl
        id={responseId}
        aria-labelledby={questionId}
        autoComplete="off"
        value={interaction.response ?? ""}
        onChange={(event) => setTextResponse(setSlug, card, event.target.value)}
        placeholder="Type your answer"
        className={multiline ? "min-h-24" : undefined}
      />
    </CardContent>
  );
}
