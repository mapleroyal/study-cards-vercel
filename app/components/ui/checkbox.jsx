import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { MinusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons";

function Checkbox({ className, style, ...props }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-app-corner-focus-within=""
      className="group/checkbox peer relative flex shrink-0 items-center justify-center outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed"
      {...props}
      data-corner-shape="round"
    >
      {/* Keep the expanded hit area outside the shape's clipping boundary. */}
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-surface"
        aria-hidden="true"
        aria-invalid={props["aria-invalid"]}
        data-corner-shape={props["data-corner-shape"]}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[6px] border border-input transition-[border-color,box-shadow] group-hover/checkbox:not-data-disabled:border-foreground/40 outline-none group-has-disabled/field:opacity-50 group-focus-visible/checkbox:border-ring group-focus-visible/checkbox:ring-[3px] group-focus-visible/checkbox:ring-ring/30 data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:data-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:data-indeterminate:bg-primary",
          className,
        )}
        style={style}
      >
        <span
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
        >
          <HugeiconsIcon
            icon={Tick02Icon}
            strokeWidth={2}
            className="hidden group-data-checked/checkbox:block"
          />
          <HugeiconsIcon
            icon={MinusSignIcon}
            strokeWidth={2}
            className="hidden group-data-indeterminate/checkbox:block"
          />
        </span>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
