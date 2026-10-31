import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const ScrollViewportContext = React.createContext(null);

function ScrollArea({ className, children, ...props }) {
  const viewportRef = React.useRef(null);
  const viewportId = React.useId();

  return (
    <ScrollViewportContext.Provider value={{ viewportRef, viewportId }}>
      <ScrollAreaPrimitive.Root
        data-slot="scroll-area"
        className={cn("relative", className)}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          id={viewportId}
          data-slot="scroll-area-viewport"
          className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-1"
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner className="bg-transparent" />
      </ScrollAreaPrimitive.Root>
    </ScrollViewportContext.Provider>
  );
}

function ScrollArrow({ orientation, direction }) {
  const viewport = React.useContext(ScrollViewportContext);
  const repeatTimer = React.useRef(null);
  const vertical = orientation === "vertical";
  const backward = direction === -1;

  function stopScrolling() {
    clearTimeout(repeatTimer.current);
    repeatTimer.current = null;
  }

  React.useEffect(() => stopScrolling, []);

  function scroll() {
    viewport?.viewportRef.current?.scrollBy({
      [vertical ? "top" : "left"]: direction * 40,
      behavior: "instant",
    });
  }

  return (
    <button
      type="button"
      data-slot="scroll-area-arrow"
      aria-label={`Scroll ${vertical ? (backward ? "up" : "down") : backward ? "left" : "right"}`}
      aria-controls={viewport?.viewportId}
      className={cn(
        "absolute flex size-3.5 items-center justify-center border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
        backward
          ? "top-0 left-0"
          : vertical
            ? "bottom-0 left-0"
            : "top-0 right-0",
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Arrow presses must not trigger Radix's track-click/drag handler.
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        stopScrolling();
        scroll();
        const repeat = () => {
          scroll();
          repeatTimer.current = setTimeout(repeat, 60);
        };
        repeatTimer.current = setTimeout(repeat, 350);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        stopScrolling();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={stopScrolling}
      onLostPointerCapture={stopScrolling}
      onBlur={stopScrolling}
      onClick={(event) => {
        event.stopPropagation();
        // Keyboard and assistive technology clicks have no pointer press.
        if (event.detail === 0) scroll();
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 8 8"
        className={cn(
          "size-2 fill-current",
          vertical
            ? !backward && "rotate-180"
            : backward
              ? "-rotate-90"
              : "rotate-90",
        )}
      >
        <path d="M4 1 7 6H1Z" />
      </svg>
    </button>
  );
}

function ScrollBar({ className, orientation = "vertical", ...props }) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none border-0 bg-transparent select-none data-[orientation=horizontal]:h-3.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:px-3.5 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:w-3.5 data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-3.5",
        className,
      )}
      {...props}
    >
      {/* Radix includes this end padding in its native thumb and drag geometry. */}
      <ScrollArrow orientation={orientation} direction={-1} />
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-muted-foreground hover:bg-foreground"
      />
      <ScrollArrow orientation={orientation} direction={1} />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
