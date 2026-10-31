import { cn } from "@/lib/utils";

export function DragHandleDots({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid grid-cols-2 gap-0.5", className)}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="size-1 rounded-full bg-current"
          data-corner-shape="round"
        />
      ))}
    </span>
  );
}
