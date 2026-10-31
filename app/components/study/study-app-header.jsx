import { Link, useLocation } from "react-router";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { SetChooser } from "@/components/study/set-chooser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const STUDY_APP_HEADER_HEIGHT = 56;

export function StudyAppHeader({
  activeSlug,
  className,
  onMenuOpenChange,
  ...props
}) {
  const { pathname } = useLocation();
  return (
    <header
      className={cn(
        "h-[var(--study-app-header-height)] bg-background",
        className,
      )}
      {...props}
    >
      <div className="relative mx-auto flex h-[var(--study-app-header-height)] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          aria-label="Open start screen"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <BrandLockup />
        </Link>
        <div className="flex items-center gap-1">
          {pathname !== "/" && pathname !== "/generate" && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/generate">Generate cards</Link>
            </Button>
          )}
          <SetChooser activeSlug={activeSlug} onOpenChange={onMenuOpenChange} />
        </div>
      </div>
    </header>
  );
}
