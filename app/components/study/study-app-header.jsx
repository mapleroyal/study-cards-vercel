import { Link, NavLink, useLocation } from "react-router";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { SetChooser } from "@/components/study/set-chooser";
import { GenerateCardsButton } from "@/components/study/generate-cards-button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const STUDY_APP_HEADER_HEIGHT = 56;

export function StudyAppHeader({
  activeSlug,
  className,
  onMenuOpenChange,
  ...props
}) {
  const { pathname } = useLocation();
  const reading = Boolean(activeSlug);
  return (
    <header
      className={cn(
        "h-[var(--study-app-header-height)] bg-background",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "relative mx-auto flex h-[var(--study-app-header-height)] w-full max-w-6xl items-center justify-between px-4 sm:px-6",
          !reading && "gap-4",
        )}
      >
        <Link
          to="/"
          aria-label="Open start screen"
          className={cn(
            "rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            !reading && "shrink-0",
          )}
        >
          <BrandLockup />
        </Link>
        {!reading && (
          <nav
            aria-label="Main navigation"
            className="hidden flex-1 items-center gap-1 md:flex md:pl-5"
          >
            {[
              ["/", "Library"],
              ["/generate", "Generate"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                data-slot="button-link"
                data-variant="ghost"
                data-active={
                  (to === "/"
                    ? pathname === "/"
                    : pathname === to || pathname.startsWith(`${to}/`)) ||
                  undefined
                }
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "text-muted-foreground",
                )}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-1">
          {reading && pathname !== "/" && pathname !== "/generate" && (
            <GenerateCardsButton variant="ghost" size="sm" />
          )}
          <SetChooser activeSlug={activeSlug} onOpenChange={onMenuOpenChange} />
        </div>
      </div>
    </header>
  );
}
