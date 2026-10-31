import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export function SelectionOptionRow({
  controlId,
  optionKey,
  checked,
  mode = "single",
  onPress,
  showOptionKey = true,
  children,
}) {
  return (
    <label
      htmlFor={controlId}
      className={cn(
        "flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150",
        checked ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      {mode === "multiple" ? (
        <Checkbox id={controlId} checked={checked} onCheckedChange={onPress} />
      ) : (
        <RadioGroupItem id={controlId} value={optionKey} />
      )}
      {showOptionKey ? (
        <span className="w-5 shrink-0 text-label-md text-muted-foreground type-numeric">
          {optionKey.toUpperCase()}.
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-body-md text-foreground">
        {children}
      </span>
    </label>
  );
}
