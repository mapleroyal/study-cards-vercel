import * as React from "react";
import {
  LaptopPhoneSyncIcon,
  Moon02Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { resolveAppearanceLayout } from "@/components/theme/appearance-layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const APPEARANCE_OPTIONS = [
  { value: "light", label: "Light", icon: Sun01Icon },
  { value: "system", label: "System", icon: LaptopPhoneSyncIcon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
];

const appearanceIndexes = {
  light: 0,
  system: 1,
  dark: 2,
};

function AppearanceGlyph({ option, className }) {
  return (
    <HugeiconsIcon
      aria-hidden="true"
      icon={option.icon}
      strokeWidth={2.5}
      className={cn("size-4", className)}
    />
  );
}

function ExpandedAppearanceProbe({ ref }) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 right-0 invisible grid h-9 w-28 min-w-28 grid-cols-3 items-center rounded-4xl p-0.5"
    >
      {APPEARANCE_OPTIONS.map((option) => (
        <span
          key={option.value}
          className="flex h-full w-full items-center justify-center"
        >
          <AppearanceGlyph option={option} />
        </span>
      ))}
    </div>
  );
}

function ExpandedAppearanceControl({ value, onValueChange }) {
  const handleKeyDown = React.useCallback(
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof globalThis.HTMLButtonElement)) {
        return;
      }
      const currentIndex = APPEARANCE_OPTIONS.findIndex(
        (option) => option.value === target.dataset.appearanceValue,
      );
      if (currentIndex < 0) {
        return;
      }

      let nextIndex;
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex =
            (currentIndex - 1 + APPEARANCE_OPTIONS.length) %
            APPEARANCE_OPTIONS.length;
          break;
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (currentIndex + 1) % APPEARANCE_OPTIONS.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = APPEARANCE_OPTIONS.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const next = APPEARANCE_OPTIONS[nextIndex];
      onValueChange(next.value);
      event.currentTarget
        .querySelector(`[data-appearance-value="${next.value}"]`)
        ?.focus({ preventScroll: true });
    },
    [onValueChange],
  );

  return (
    <div
      aria-label="Appearance mode"
      className="relative grid h-9 w-28 min-w-28 grid-cols-3 items-center rounded-4xl bg-muted p-0.5 shadow-inner transition-colors duration-300"
      role="radiogroup"
      style={{ "--appearance-index": appearanceIndexes[value] }}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        data-slot="appearance-mode-indicator"
        data-theme-transition="preserve"
        className="pointer-events-none absolute top-0.5 left-0.5 h-8 w-[calc((100%-0.25rem)/3)] rounded-4xl border border-border bg-background shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none"
        style={{
          transform: "translateX(calc(var(--appearance-index) * 100%))",
        }}
      />

      {APPEARANCE_OPTIONS.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-checked={value === option.value}
              aria-label={option.label}
              className={cn(
                "relative z-10 flex h-full w-full items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors duration-200 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                value === option.value &&
                  "text-foreground hover:text-foreground",
              )}
              data-appearance-value={option.value}
              role="radio"
              tabIndex={value === option.value ? 0 : -1}
              onClick={() => onValueChange(option.value)}
            >
              <AppearanceGlyph option={option} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{option.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function CompactAppearanceControl({ value, onValueChange }) {
  const selected =
    APPEARANCE_OPTIONS.find((option) => option.value === value) ??
    APPEARANCE_OPTIONS[1];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                aria-label={`Appearance: ${selected.label}`}
                size="icon-sm"
                variant="ghost"
              >
                <AppearanceGlyph option={selected} />
              </Button>
            }
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">Appearance</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {APPEARANCE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              closeOnClick
            >
              <AppearanceGlyph option={option} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The direct parent is the stable available-width slot. Keeping that boundary
// separate lets this control shrink to 36px without feeding its own width back
// into the compact/expanded decision.
export function AppearanceModeControl({ className, value, onValueChange }) {
  const hostRef = React.useRef(null);
  const probeRef = React.useRef(null);
  const [layout, setLayout] = React.useState("compact");

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    const probe = probeRef.current;
    const availableSpace = host?.parentElement;
    const ResizeObserver = globalThis.ResizeObserver;
    if (
      !host ||
      !probe ||
      !availableSpace ||
      typeof ResizeObserver !== "function"
    ) {
      return undefined;
    }

    const measure = () => {
      const nextLayout = resolveAppearanceLayout({
        availableWidth: availableSpace.clientWidth,
        expandedWidth: probe.getBoundingClientRect().width,
      });
      setLayout((current) => (current === nextLayout ? current : nextLayout));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(availableSpace);
    observer.observe(probe);
    measure();

    return () => observer.disconnect();
  }, []);

  return (
    <TooltipProvider>
      <div
        ref={hostRef}
        className={cn(
          "relative flex h-9 items-center justify-end overflow-visible",
          layout === "expanded" ? "w-28 min-w-28" : "w-9 min-w-9",
          className,
        )}
        data-appearance-layout={layout}
      >
        <ExpandedAppearanceProbe ref={probeRef} />
        {layout === "expanded" ? (
          <ExpandedAppearanceControl
            value={value}
            onValueChange={onValueChange}
          />
        ) : (
          <CompactAppearanceControl
            value={value}
            onValueChange={onValueChange}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
