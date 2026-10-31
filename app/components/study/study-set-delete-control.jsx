import * as React from "react";
import { useCapabilities } from "@/lib/runtime-client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function StudySetDeleteControl({ set, onDelete, className }) {
  const capabilities = useCapabilities();
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    await onDelete();
    setOpen(false);
  }

  if (capabilities?.server) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Delete ${set.title}`}
        className={cn("text-destructive hover:text-destructive/80", className)}
        onClick={handleDelete}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${set.title}`}
            className={cn(
              "text-destructive hover:text-destructive/80",
              className,
            )}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-fit min-w-0 gap-3">
        <PopoverHeader>
          <PopoverTitle>Delete this set?</PopoverTitle>
          <PopoverDescription className="text-body-sm">
            Remove it from local study sets.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
