import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@/lib/utils";

function Drawer({ ...props }) {
  return <DrawerPrimitive.Root {...props} />;
}

function DrawerTrigger({ ...props }) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({ className, ...props }) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:transition-none",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({ className, children, ...props }) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="fixed inset-0 z-50"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "group/drawer-content text-body-md fixed m-2 flex h-auto max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-4xl border border-border bg-popover p-2 text-popover-foreground outline-none",
            "data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:mt-24 data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:mb-24 data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:w-3/4 data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:w-3/4 data-[swipe-direction=left]:sm:max-w-sm data-[swipe-direction=right]:sm:max-w-sm",
            "[transform:translate(var(--drawer-swipe-movement-x,0px),calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))] transition-transform duration-200 ease-out data-swiping:transition-none data-swipe-dismiss:duration-[calc(200ms*var(--drawer-swipe-strength,1))] motion-reduce:transition-none",
            "data-[swipe-direction=down]:data-starting-style:[transform:translateY(calc(100%+1rem))] data-[swipe-direction=down]:data-ending-style:[transform:translateY(calc(100%+1rem))] data-[swipe-direction=up]:data-starting-style:[transform:translateY(calc(-100%-1rem))] data-[swipe-direction=up]:data-ending-style:[transform:translateY(calc(-100%-1rem))] data-[swipe-direction=left]:data-starting-style:[transform:translateX(calc(-100%-1rem))] data-[swipe-direction=left]:data-ending-style:[transform:translateX(calc(-100%-1rem))] data-[swipe-direction=right]:data-starting-style:[transform:translateX(calc(100%+1rem))] data-[swipe-direction=right]:data-ending-style:[transform:translateX(calc(100%+1rem))]",
            className,
          )}
          {...props}
        >
          <div
            aria-hidden="true"
            data-slot="drawer-handle"
            className="mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full bg-muted group-data-[swipe-direction=down]/drawer-content:block"
          />
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-title-lg", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-body-md text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
