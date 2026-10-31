import { HugeiconsIcon } from "@hugeicons/react";
import { FullScreenIcon, MinimizeScreenIcon } from "@hugeicons/core-free-icons";

import { useBrowserFullscreen } from "@/hooks/use-browser-fullscreen";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

export function StudyFullscreenControl({ onToggleComplete }) {
  const isMobile = useIsMobile();
  const { isFullscreen, isPending, isSupported, toggleFullscreen } =
    useBrowserFullscreen();

  if (!isMobile || !isSupported) {
    return null;
  }

  const label = isFullscreen ? "Exit fullscreen" : "Fullscreen";

  async function handleClick() {
    const didToggle = await toggleFullscreen();

    if (didToggle) {
      onToggleComplete?.();
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={isFullscreen}
      disabled={isPending}
      onClick={handleClick}
      className="text-muted-foreground hover:text-foreground"
    >
      <HugeiconsIcon
        icon={isFullscreen ? MinimizeScreenIcon : FullScreenIcon}
        className="size-4"
      />
      {label}
    </Button>
  );
}
