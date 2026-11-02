import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraggablePromptItem } from "@/components/study/prompts/draggable-prompt-item";
import { cn } from "@/lib/utils";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";
import { useStudyReaderStore } from "@/stores/use-study-reader-store";

const MATCHING_BANK_ID = "matching-choice-bank";
const MATCHING_BANK_RESTING_CLASS = "bg-muted/50 ring-border/70";
const MATCHING_BANK_OVER_CLASS = "bg-accent ring-ring/50";
const MATCHING_BANK_CHOICE_HOVER_CLASS = "hover:bg-accent";
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function matchingCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  if (args.pointerCoordinates) {
    return rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.id === MATCHING_BANK_ID,
      ),
    });
  }

  return rectIntersection(args);
}

function MatchingChoiceContent({
  choice,
  className,
  interactive = false,
  lifted = false,
}) {
  return (
    <DraggablePromptItem
      body={choice}
      interactive={interactive}
      lifted={lifted}
      className={cn("inline-flex max-w-full", className)}
    />
  );
}

function DraggableMatchingChoice({
  choice,
  sourcePromptIndex,
  fullWidth = false,
  contentClassName,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useDraggable({
    id: `choice:${choice}`,
    data: {
      choice,
      sourcePromptIndex,
    },
  });
  const style = isDragging
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        transition,
      };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "max-w-full cursor-grab touch-manipulation rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:cursor-grabbing",
        fullWidth ? "flex w-full" : "inline-flex",
        isDragging && "opacity-0",
      )}
    >
      <MatchingChoiceContent
        choice={choice}
        interactive
        className={cn("max-w-full", fullWidth && "w-full", contentClassName)}
      />
    </button>
  );
}

function getFlexRowNodes(containerNode) {
  return Array.from(containerNode?.children ?? []);
}

function hasWrappedFlexRows(nodes) {
  const [firstNode] = nodes;

  if (!firstNode) {
    return false;
  }

  const firstRowTop = firstNode.offsetTop;

  return nodes.some((node) => node.offsetTop !== firstRowTop);
}

function MatchingPromptSlot({
  prompt,
  promptId,
  promptIndex,
  assignedChoices = [],
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot:${promptIndex}`,
  });
  const hasAssignedChoices = assignedChoices.length > 0;

  return (
    <div
      role="group"
      aria-labelledby={promptId}
      className="flex flex-col gap-2"
    >
      <span id={promptId} className="text-body-md text-foreground">
        {prompt}
      </span>
      <div
        ref={setNodeRef}
        aria-label={`Matches for ${prompt}`}
        className={cn(
          "min-h-10 rounded-lg transition-colors",
          hasAssignedChoices
            ? cn("flex flex-col gap-1 py-0.5", isOver && "bg-accent")
            : cn(
                "flex items-center border border-dashed",
                isOver ? "border-ring/50 bg-accent" : "border-border",
              ),
        )}
      >
        {hasAssignedChoices ? (
          assignedChoices.map((assignedChoice) => (
            <DraggableMatchingChoice
              key={assignedChoice}
              choice={assignedChoice}
              sourcePromptIndex={promptIndex}
              fullWidth
            />
          ))
        ) : (
          <span className="flex min-h-10 w-full items-center px-3 py-2 text-body-sm text-muted-foreground">
            No match yet
          </span>
        )}
      </div>
    </div>
  );
}

function MatchingChoiceBank({ choices }) {
  const bankContentRef = React.useRef(null);
  const [hasWrappedRows, setHasWrappedRows] = React.useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: MATCHING_BANK_ID,
  });
  const measureChoiceRows = React.useCallback(() => {
    const choiceNodes = getFlexRowNodes(bankContentRef.current);
    const wrappedRows = hasWrappedFlexRows(choiceNodes);

    setHasWrappedRows((currentWrappedRows) =>
      currentWrappedRows === wrappedRows ? currentWrappedRows : wrappedRows,
    );
  }, []);

  useIsomorphicLayoutEffect(() => {
    measureChoiceRows();
  }, [choices, measureChoiceRows]);

  React.useEffect(() => {
    const choiceNodes = getFlexRowNodes(bankContentRef.current);
    const observedNodes = [bankContentRef.current, ...choiceNodes].filter(
      Boolean,
    );

    if (observedNodes.length === 0) {
      return undefined;
    }

    if (typeof window.ResizeObserver === "undefined") {
      window.addEventListener("resize", measureChoiceRows);

      return () => {
        window.removeEventListener("resize", measureChoiceRows);
      };
    }

    const resizeObserver = new window.ResizeObserver(measureChoiceRows);

    observedNodes.forEach((node) => resizeObserver.observe(node));

    return () => {
      resizeObserver.disconnect();
    };
  }, [choices, measureChoiceRows]);

  return (
    <div
      aria-label="Unassigned choices bank"
      role="group"
      className={cn(
        "relative min-h-16 rounded-lg p-2 ring-1 ring-inset transition-[background-color,box-shadow]",
        isOver ? MATCHING_BANK_OVER_CLASS : MATCHING_BANK_RESTING_CLASS,
      )}
    >
      <div
        ref={setNodeRef}
        aria-hidden="true"
        className="absolute inset-0 rounded-lg"
      />
      <div
        ref={bankContentRef}
        className={cn(
          "relative flex min-h-12 flex-wrap content-center items-center gap-1",
          hasWrappedRows ? "justify-start" : "justify-center",
        )}
      >
        {choices.map((choice) => (
          <DraggableMatchingChoice
            key={choice}
            choice={choice}
            contentClassName={MATCHING_BANK_CHOICE_HOVER_CLASS}
          />
        ))}
        {choices.length === 0 ? (
          <span className="text-body-sm text-muted-foreground">
            All choices assigned
          </span>
        ) : null}
      </div>
    </div>
  );
}

function getAssignedPromptIndex(assignments, choice) {
  return assignments.findIndex((assignedChoices) =>
    assignedChoices.includes(choice),
  );
}

function MatchingMenus({
  assignments,
  card,
  clearMatchingAssignment,
  questionId,
  setSlug,
  assignMatchingChoice,
}) {
  function handleAssignmentChange(choice, nextValue) {
    const currentPromptIndex = getAssignedPromptIndex(assignments, choice);

    if (nextValue === "unassigned") {
      if (currentPromptIndex !== -1) {
        clearMatchingAssignment(setSlug, card, currentPromptIndex, choice);
      }

      return;
    }

    if (typeof nextValue !== "string" || !nextValue.startsWith("prompt:")) {
      return;
    }

    const nextPromptIndex = Number(nextValue.slice("prompt:".length));

    if (
      Number.isInteger(nextPromptIndex) &&
      nextPromptIndex >= 0 &&
      nextPromptIndex < card.prompts.length
    ) {
      assignMatchingChoice(setSlug, card, nextPromptIndex, choice);
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      className="flex flex-col gap-3 pb-1"
    >
      {card.choices.map((choice) => {
        const promptIndex = getAssignedPromptIndex(assignments, choice);

        return (
          <div
            key={choice}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.8fr)] sm:items-center"
          >
            <span className="text-body-md text-foreground">{choice}</span>
            <Select
              items={[
                { value: "unassigned", label: "Unassigned" },
                ...card.prompts.map((prompt, index) => ({
                  value: `prompt:${index}`,
                  label: prompt,
                })),
              ]}
              value={
                promptIndex === -1 ? "unassigned" : `prompt:${promptIndex}`
              }
              onValueChange={(nextValue) =>
                handleAssignmentChange(choice, nextValue)
              }
            >
              <SelectTrigger aria-label={`Match ${choice}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {card.prompts.map((prompt, index) => (
                  <SelectItem key={prompt} value={`prompt:${index}`}>
                    {prompt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

export function MatchingPrompt({ card, interaction, questionId, setSlug }) {
  const [activeChoice, setActiveChoice] = React.useState(null);
  const matchingMode = useStudyReaderStore((state) => state.matchingMode);
  const setMatchingMode = useStudyReaderStore((state) => state.setMatchingMode);
  const assignMatchingChoice = useStudyInteractionsStore(
    (state) => state.assignMatchingChoice,
  );
  const clearMatchingAssignment = useStudyInteractionsStore(
    (state) => state.clearMatchingAssignment,
  );
  const unassignedChoices = React.useMemo(
    () =>
      card.choices.filter((choice) =>
        interaction.assignments.every(
          (assignedChoices) => !assignedChoices.includes(choice),
        ),
      ),
    [card.choices, interaction.assignments],
  );
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event) {
    setActiveChoice(event.active.data.current?.choice ?? null);
  }

  function handleDragEnd(event) {
    const choice = event.active.data.current?.choice;
    const sourcePromptIndex = event.active.data.current?.sourcePromptIndex;
    const overId = event.over?.id;

    setActiveChoice(null);

    if (!choice || !overId) {
      return;
    }

    if (overId === MATCHING_BANK_ID) {
      if (Number.isInteger(sourcePromptIndex)) {
        clearMatchingAssignment(setSlug, card, sourcePromptIndex, choice);
      }
      return;
    }

    if (typeof overId === "string" && overId.startsWith("slot:")) {
      const promptIndex = Number(overId.slice(5));

      if (!Number.isNaN(promptIndex)) {
        assignMatchingChoice(setSlug, card, promptIndex, choice);
      }
    }
  }

  function handleDragCancel() {
    setActiveChoice(null);
  }

  return (
    <CardContent className="flex flex-col gap-3 pb-4">
      <ToggleGroup
        size="sm"
        aria-label="Matching input mode"
        value={[matchingMode]}
        onValueChange={([mode]) => {
          if (!mode) {
            return;
          }
          setActiveChoice(null);
          setMatchingMode(mode);
        }}
      >
        <ToggleGroupItem value="drag" aria-label="Match by dragging">
          Drag
        </ToggleGroupItem>
        <ToggleGroupItem value="menus" aria-label="Match using menus">
          Menus
        </ToggleGroupItem>
      </ToggleGroup>
      {matchingMode === "menus" ? (
        <MatchingMenus
          assignments={interaction.assignments}
          card={card}
          clearMatchingAssignment={clearMatchingAssignment}
          questionId={questionId}
          setSlug={setSlug}
          assignMatchingChoice={assignMatchingChoice}
        />
      ) : (
        <DndContext
          collisionDetection={matchingCollisionDetection}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            role="group"
            aria-labelledby={questionId}
            className="flex flex-col gap-3"
          >
            {card.prompts.map((prompt, promptIndex) => (
              <MatchingPromptSlot
                key={`${promptIndex}:${prompt}`}
                prompt={prompt}
                promptId={`${questionId}-matching-prompt-${promptIndex}`}
                promptIndex={promptIndex}
                assignedChoices={interaction.assignments[promptIndex]}
              />
            ))}
            <MatchingChoiceBank choices={unassignedChoices} />
          </div>
          <DragOverlay dropAnimation={null}>
            {activeChoice ? (
              <MatchingChoiceContent
                choice={activeChoice}
                lifted
                className="inline-flex max-w-full"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </CardContent>
  );
}
