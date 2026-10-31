import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/runtime-client";

export function OpenRouterKeyDialog({ open, onOpenChange, onSaved }) {
  const id = React.useId();
  const [key, setKey] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setKey("");
      setError(null);
    }
  }, [open]);

  function changeOpen(nextOpen) {
    if (busy) {
      return;
    }
    if (!nextOpen) {
      setKey("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function save(event) {
    event.preventDefault();
    if (busy || !key.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const settings = await apiRequest("/api/settings", {
        method: "PUT",
        body: { openRouterKey: key.trim() },
      });
      setKey("");
      onSaved(settings);
      onOpenChange(false);
    } catch (cause) {
      setError(cause.message || "The key could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OpenRouter key</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>API key</Label>
            <Input
              id={id}
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="sk-or-…"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={busy}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            <a
              href="https://openrouter.ai/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-body-sm w-fit text-muted-foreground underline underline-offset-3 hover:text-foreground"
            >
              Get a key
            </a>
          </div>
          {error && (
            <p
              id={`${id}-error`}
              role="alert"
              className="text-body-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button disabled={busy || !key.trim()}>
              {busy ? "Saving…" : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
