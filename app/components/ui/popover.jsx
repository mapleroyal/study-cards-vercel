import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SurfaceViewport } from "@/components/surface-viewport";

function Popover({ ...props }) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ className, render, ...props }) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      render={render}
      className={cn(!render && buttonVariants({ variant: "ghost" }), className)}
      {...props}
    />
  );
}

function PopoverContent({
  className,
  viewportClassName,
  children,
  align = "center",
  side = "bottom",
  sideOffset = 4,
  alignOffset = 0,
  anchor,
  ...props
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        data-slot="popover-positioner"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-72 max-w-[calc(100vw-1rem)] max-h-(--available-height) origin-(--transform-origin) flex-col [--surface-radius:--theme(--radius-3xl)] rounded-(--surface-radius) bg-popover text-body-md text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SurfaceViewport
            className={cn("flex flex-col gap-4 p-4", viewportClassName)}
          >
            {children}
          </SurfaceViewport>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-body-md", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-title-lg", className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
