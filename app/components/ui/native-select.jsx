import * as React from "react";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

function NativeSelect({ className, size = "default", ...props }) {
  return (
    <div
      className={cn(
        "group/native-select relative inline-flex w-fit items-center rounded-3xl border border-transparent bg-input/50 has-[>select:not(:disabled)]:hover:bg-input/70 transition-[color,box-shadow,background-color] has-[>select:focus-visible]:border-ring has-[>select:focus-visible]:ring-3 has-[>select:focus-visible]:ring-ring/30 has-[>select:disabled]:opacity-50 has-[>select[aria-invalid=true]]:border-destructive has-[>select[aria-invalid=true]]:ring-3 has-[>select[aria-invalid=true]]:ring-destructive/20 dark:has-[>select[aria-invalid=true]]:border-destructive/50 dark:has-[>select[aria-invalid=true]]:ring-destructive/40",
        className,
      )}
      data-slot="native-select-wrapper"
      data-app-corner-focus-within=""
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        data-corner-shape="round"
        className="h-[calc(--spacing(9)-2px)] w-full min-w-0 appearance-none border-0 bg-transparent py-1 pr-8 pl-3 text-body-lg md:text-body-md outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-[calc(--spacing(8)-2px)]"
        {...props}
      />
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ className, ...props }) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({ className, ...props }) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
