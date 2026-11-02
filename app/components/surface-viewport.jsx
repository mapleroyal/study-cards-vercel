import { cn } from "@/lib/utils";

// Keep scrolling and clipping inside the painted shell so its border, shadow,
// and focus ring can extend beyond the content viewport. A shared radius token
// stays intact when the corner fallback replaces the shell's native border radius.
export function SurfaceViewport({ className, ...props }) {
  return (
    <div
      data-slot="surface-viewport"
      className={cn(
        "min-h-0 min-w-0 overflow-x-hidden overflow-y-auto rounded-(--surface-radius)",
        className,
      )}
      {...props}
    />
  );
}
