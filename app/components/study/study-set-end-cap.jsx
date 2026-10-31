import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export function StudySetEndCap({ className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-2 py-4 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex w-full items-center gap-4 text-primary/40"
      >
        <span className="h-px flex-1 bg-border" />
        <HugeiconsIcon
          icon={SparklesIcon}
          strokeWidth={1.8}
          className="size-6"
        />
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="max-w-md text-balance font-oooh-baby text-headline-sm text-muted-foreground sm:text-headline-md">
        You&apos;ve reached the end of this set.
      </p>
    </div>
  );
}
