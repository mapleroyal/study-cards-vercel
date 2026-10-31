import { QuestionIcon } from "@primer/octicons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function GenerationInstructions({ value, onChange, disabled }) {
  const hasInstructions = Boolean(value.trim());
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            className={hasInstructions ? undefined : "text-muted-foreground"}
          />
        }
        aria-label={hasInstructions ? "Instructions added" : "Instructions"}
      >
        <QuestionIcon aria-hidden="true" />
        Instructions
        {hasInstructions && (
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Instructions</DialogTitle>
        </DialogHeader>
        <Textarea
          aria-label="Instructions"
          placeholder="Add instructions for these cards…"
          rows={6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange("")}
            disabled={!value}
          >
            Clear
          </Button>
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
