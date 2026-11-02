import { PreviewCard as HoverCardPrimitive } from "@base-ui/react/preview-card";

import { cn } from "@/lib/utils";
import { SurfaceViewport } from "@/components/surface-viewport";

function HoverCard({ ...props }) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  viewportClassName,
  children,
  align = "center",
  side = "bottom",
  sideOffset = 4,
  alignOffset = 0,
  collisionPadding = 8,
  ...props
}) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Positioner
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
      >
        <HoverCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "text-body-md z-50 w-72 max-w-[calc(100vw-1rem)] max-h-(--available-height) flex flex-col origin-(--transform-origin) [--surface-radius:--theme(--radius-3xl)] rounded-(--surface-radius) bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SurfaceViewport className={cn("p-4", viewportClassName)}>
            {children}
          </SurfaceViewport>
        </HoverCardPrimitive.Popup>
      </HoverCardPrimitive.Positioner>
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
