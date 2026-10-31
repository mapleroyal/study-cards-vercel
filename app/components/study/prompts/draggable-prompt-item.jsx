import { DragHandleDots } from "@/components/study/prompts/drag-handle-dots";
import { cn } from "@/lib/utils";

export function DraggablePromptItem({
  body,
  beforeBody,
  className,
  bodyClassName,
  lifted = false,
  interactive = false,
}) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-body-md text-foreground transition-[background-color,box-shadow] duration-150",
        interactive && !lifted && "hover:bg-accent/50",
        lifted && "bg-popover shadow-md ring-1 ring-border",
        className,
      )}
    >
      <span className="flex shrink-0 items-center justify-center text-muted-foreground">
        <DragHandleDots />
      </span>
      {beforeBody}
      <span className={cn("min-w-0 flex-1", bodyClassName)}>{body}</span>
    </div>
  );
}
