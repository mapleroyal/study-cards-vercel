import * as React from "react";
import { useCapabilities } from "@/lib/runtime-client";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function StudyResetControl({ visible, onReset, className }) {
  const capabilities = useCapabilities();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setOpen(false);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  function handleReset() {
    onReset();
    setOpen(false);
  }

  if (capabilities?.server) {
    return (
      <Button
        type="button"
        aria-label="Reset study set progress"
        variant="ghost"
        size="icon-xs"
        className={cn("text-muted-foreground hover:text-foreground", className)}
        onClick={handleReset}
      >
        <HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} />
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            aria-label="Reset study set progress"
            variant="ghost"
            size="icon-xs"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              className,
            )}
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-fit min-w-0 gap-3">
        <PopoverHeader>
          <PopoverTitle>Reset this set?</PopoverTitle>
          <PopoverDescription className="text-body-sm">
            Clear saved answers and progress.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
