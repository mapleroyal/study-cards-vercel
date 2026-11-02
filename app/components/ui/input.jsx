import * as React from "react";

import { cn } from "@/lib/utils";

// Native controls cannot paint the SVG pseudo-elements used by the Safari
// corner fallback. Keep form semantics on the control and paint its surface
// on a normal element. InputGroup uses the bare control below.
function InputControl({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      data-corner-shape="round"
      className={cn(
        "text-body-lg h-9 w-full min-w-0 border-0 bg-transparent px-3 py-1 outline-none file:mr-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-label-lg file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-body-md",
        className,
      )}
      {...props}
    />
  );
}

function Input({ className, style, type, ...props }) {
  if (type === "hidden") {
    return (
      <InputControl
        type={type}
        className={className}
        style={style}
        {...props}
      />
    );
  }
  return (
    <div
      data-slot="input-surface"
      data-app-corner-focus-within=""
      data-corner-shape={props["data-corner-shape"]}
      hidden={props.hidden}
      className={cn(
        "text-body-lg relative flex h-9 w-full min-w-0 items-center rounded-3xl border border-transparent bg-input/50 has-[>input:not(:disabled)]:hover:bg-input/70 px-3 py-1 transition-[color,box-shadow,background-color] has-[>input:focus-visible]:border-ring has-[>input:focus-visible]:ring-[3px] has-[>input:focus-visible]:ring-ring/30 has-[>input:disabled]:pointer-events-none has-[>input:disabled]:cursor-not-allowed has-[>input:disabled]:opacity-50 has-[>input[aria-invalid=true]]:border-destructive has-[>input[aria-invalid=true]]:ring-[3px] has-[>input[aria-invalid=true]]:ring-destructive/20 md:text-body-md dark:has-[>input[aria-invalid=true]]:border-destructive/50 dark:has-[>input[aria-invalid=true]]:ring-destructive/40",
        className,
      )}
      style={style}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && event.button === 0) {
          event.preventDefault();
          event.currentTarget.querySelector("input")?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.currentTarget.querySelector("input")?.click();
        }
      }}
    >
      <InputControl
        type={type}
        className="h-full p-0 text-[length:inherit] leading-[inherit] md:text-[length:inherit]"
        {...props}
        data-corner-shape="round"
      />
    </div>
  );
}

export { Input, InputControl };
