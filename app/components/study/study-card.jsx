import { CardEditControl } from "@/components/study/study-edit-controls";
import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { QuestionTypeLabel } from "@/components/study/question-type-label";
import { FillInTheBlankPrompt } from "@/components/study/prompts/fill-in-the-blank-prompt";
import { MatchingPrompt } from "@/components/study/prompts/matching-prompt";
import { MultipleChoicePrompt } from "@/components/study/prompts/multiple-choice-prompt";
import { MultipleResponsePrompt } from "@/components/study/prompts/multiple-response-prompt";
import { OrderingPrompt } from "@/components/study/prompts/ordering-prompt";
import { ShortAnswerPrompt } from "@/components/study/prompts/short-answer-prompt";
import { TrueFalsePrompt } from "@/components/study/prompts/true-false-prompt";
import { cn } from "@/lib/utils";
import { formatAnswer } from "@/lib/study-sets";
import {
  useStudyInteraction,
  useStudyInteractionsStore,
} from "@/stores/use-study-interactions-store";

function CardPrompt({ card, interaction, questionId, setSlug }) {
  switch (card.type) {
    case "true_false":
      return (
        <TrueFalsePrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    case "multiple_choice":
      return (
        <MultipleChoicePrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    case "multiple_response":
      return (
        <MultipleResponsePrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    case "fill_in_the_blank":
      return (
        <FillInTheBlankPrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    case "ordering":
      return (
        <OrderingPrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    case "matching":
      return (
        <MatchingPrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    case "short_answer":
      return (
        <ShortAnswerPrompt
          card={card}
          interaction={interaction}
          questionId={questionId}
          setSlug={setSlug}
        />
      );

    default:
      break;
  }

  return <CardContent className="pb-4" />;
}

export function StudyCard({ card, index, setSlug }) {
  const questionId = React.useId();
  const setAnswerOpen = useStudyInteractionsStore(
    (state) => state.setAnswerOpen,
  );
  const interaction = useStudyInteraction(setSlug, card);

  return (
    <Card
      role="article"
      data-study-card-id={card.id}
      aria-labelledby={questionId}
      size="sm"
      className="[--surface-radius:var(--radius-xl)]"
      viewportClassName="gap-0 py-0 group-data-[size=sm]/card:gap-0 group-data-[size=sm]/card:py-0"
    >
      <CardHeader className="gap-3 pt-4 pb-4">
        <QuestionTypeLabel type={card.type} />
        <CardAction className="flex items-center gap-2">
          <span className="text-label-md text-muted-foreground type-numeric">
            {index + 1}
          </span>
          <CardEditControl card={card} setSlug={setSlug} />
        </CardAction>
        <CardTitle>
          <h2 id={questionId}>{card.question}</h2>
        </CardTitle>
      </CardHeader>

      <CardPrompt
        card={card}
        interaction={interaction}
        questionId={questionId}
        setSlug={setSlug}
      />

      <Collapsible
        open={interaction.answerOpen}
        onOpenChange={(open) => setAnswerOpen(setSlug, card, open)}
        className="w-full"
      >
        <CollapsibleTrigger
          render={<button type="button" />}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 border-t px-4 py-2.5 text-left text-label-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset",
            interaction.answerOpen && "text-foreground",
          )}
        >
          {interaction.answerOpen ? "Hide answer" : "Show answer"}
          <HugeiconsIcon
            aria-hidden="true"
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={cn(
              "size-4 transition-transform duration-200",
              interaction.answerOpen && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="flex flex-col gap-2 px-4 pb-4">
            <p className="text-body-md whitespace-pre-line">
              {formatAnswer(card)}
            </p>
            <p className="text-body-md text-muted-foreground">
              {card.explanation}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
