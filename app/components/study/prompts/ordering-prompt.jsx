import * as React from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { CardContent } from "@/components/ui/card";
import { DraggablePromptItem } from "@/components/study/prompts/draggable-prompt-item";
import { cn } from "@/lib/utils";
import { useStudyInteractionsStore } from "@/stores/use-study-interactions-store";

function OrderingItemContent({ item, index, lifted = false, className }) {
  return (
    <DraggablePromptItem
      lifted={lifted}
      interactive
      className={cn("w-full", className)}
      beforeBody={
        <span className="w-5 shrink-0 text-label-md text-muted-foreground type-numeric">
          {index + 1}
        </span>
      }
      body={item}
    />
  );
}

function SortableOrderingRow({ item, index }) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("list-none", isDragging && "relative z-10")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          "w-full cursor-grab touch-manipulation rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:cursor-grabbing",
          isDragging && "opacity-0",
        )}
      >
        <OrderingItemContent item={item} index={index} />
      </button>
    </li>
  );
}

export function OrderingPrompt({ card, interaction, questionId, setSlug }) {
  const [activeItem, setActiveItem] = React.useState(null);
  const setOrderingItems = useStudyInteractionsStore(
    (state) => state.setOrderingItems,
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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItemIndex =
    activeItem !== null ? interaction.items.indexOf(activeItem) : -1;

  function handleDragStart(event) {
    setActiveItem(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    setActiveItem(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = interaction.items.indexOf(active.id);
    const newIndex = interaction.items.indexOf(over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    setOrderingItems(
      setSlug,
      card,
      arrayMove(interaction.items, oldIndex, newIndex),
    );
  }

  function handleDragCancel() {
    setActiveItem(null);
  }

  return (
    <CardContent className="pb-4">
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={interaction.items}
          strategy={verticalListSortingStrategy}
        >
          <ol
            aria-labelledby={questionId}
            className="flex list-none flex-col gap-1"
          >
            {interaction.items.map((item, index) => (
              <SortableOrderingRow key={item} item={item} index={index} />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem !== null && activeItemIndex !== -1 ? (
            <OrderingItemContent
              item={activeItem}
              index={activeItemIndex}
              lifted
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </CardContent>
  );
}
