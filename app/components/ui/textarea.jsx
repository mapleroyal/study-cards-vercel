import * as React from "react";

import { cn } from "@/lib/utils";

function TextareaControl({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      data-corner-shape="round"
      className={cn(
        "field-sizing-content min-h-16 w-full min-w-0 resize-none border-0 bg-transparent px-3 py-3 text-body-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-body-md",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, style, ...props }) {
  return (
    <div
      data-slot="textarea-surface"
      data-app-corner-focus-within=""
      data-corner-shape={props["data-corner-shape"]}
      hidden={props.hidden}
      className={cn(
        "relative flex min-h-16 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 has-[>textarea:not(:disabled)]:hover:bg-input/70 px-3 py-3 text-body-lg transition-[color,box-shadow,background-color] has-[>textarea:focus-visible]:border-ring has-[>textarea:focus-visible]:ring-[3px] has-[>textarea:focus-visible]:ring-ring/30 has-[>textarea:disabled]:cursor-not-allowed has-[>textarea:disabled]:opacity-50 has-[>textarea[aria-invalid=true]]:border-destructive has-[>textarea[aria-invalid=true]]:ring-[3px] has-[>textarea[aria-invalid=true]]:ring-destructive/20 md:text-body-md dark:has-[>textarea[aria-invalid=true]]:border-destructive/50 dark:has-[>textarea[aria-invalid=true]]:ring-destructive/40",
        className,
      )}
      style={style}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && event.button === 0) {
          event.preventDefault();
          event.currentTarget.querySelector("textarea")?.focus();
        }
      }}
    >
      <TextareaControl
        className="min-h-0 flex-1 p-0 text-[length:inherit] leading-[inherit] md:text-[length:inherit]"
        {...props}
        data-corner-shape="round"
      />
    </div>
  );
}

export { Textarea, TextareaControl };
