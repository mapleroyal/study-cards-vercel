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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function GenerationInstructions({ value, onChange, disabled }) {
  const hasInstructions = Boolean(value.trim());
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    className={
                      hasInstructions ? undefined : "text-muted-foreground"
                    }
                  />
                }
              />
            }
            aria-label={hasInstructions ? "Message added" : "Message"}
          >
            <QuestionIcon aria-hidden="true" />
            Message
            {hasInstructions && (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-current"
              />
            )}
          </TooltipTrigger>
          <TooltipContent>Include a message to the AI?</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)]"
        viewportClassName="flex min-h-0 flex-col gap-4"
      >
        <DialogHeader>
          <DialogTitle>Message</DialogTitle>
        </DialogHeader>
        <Textarea
          aria-label="Message"
          placeholder="Add instructions for these cards…"
          rows={8}
          className="min-h-36 resize-none"
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
          <DialogClose render={<Button type="button" variant="ghost" />}>
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
