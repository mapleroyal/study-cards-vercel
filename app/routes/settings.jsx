import * as React from "react";
import { toast } from "sonner";
import { ModelPicker } from "@/components/study/model-picker";
import { ShuffleSettings } from "@/components/study/shuffle-settings";
import { StudyAppHeader } from "@/components/study/study-app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/runtime-client";
import { signOut } from "@/lib/sign-out";
import { formatPageTitle } from "@/lib/app-config";
export function meta() {
  return [{ title: formatPageTitle("Settings") }];
}
export default function SettingsRoute() {
  const [settings, setSettings] = React.useState(null);
  const [key, setKey] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [modelBusy, setModelBusy] = React.useState(false);
  const [keyAction, setKeyAction] = React.useState(null);
  React.useEffect(() => {
    let active = true;
    apiRequest("/api/settings")
      .then((value) => {
        if (active) {
          setSettings(value);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setKeyAction("save");
    setError(null);
    try {
      const next = await apiRequest("/api/settings", {
        method: "PUT",
        body: { openRouterKey: key.trim() },
      });
      setSettings(next);
      setKey("");
      toast.success("OpenRouter key saved");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
      setKeyAction(null);
    }
  }
  async function removeKey() {
    setBusy(true);
    setKeyAction("remove");
    setError(null);
    try {
      const next = await apiRequest("/api/settings", {
        method: "PUT",
        body: { openRouterKey: "" },
      });
      setSettings(next);
      setKey("");
      toast.success("OpenRouter key removed");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
      setKeyAction(null);
    }
  }
  async function saveModel(selection) {
    setModelBusy(true);
    setError(null);
    try {
      const next = await apiRequest("/api/settings", {
        method: "PUT",
        body: selection,
      });
      setSettings(next);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setModelBusy(false);
    }
  }
  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  }
  return (
    <div
      className="min-h-dvh bg-background"
      style={{ "--study-app-header-height": "56px" }}
    >
      <StudyAppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="text-headline-lg">Settings</h1>
        <ShuffleSettings />
        <section
          aria-label="Generation model"
          className="flex flex-col gap-3 border-t pt-5"
        >
          <h2 className="text-title-md">Model</h2>
          {settings ? (
            <ModelPicker
              value={{
                model: settings.model,
                reasoningEffort: settings.reasoningEffort,
              }}
              onChange={saveModel}
              disabled={busy || modelBusy}
            />
          ) : (
            <p role="status" className="text-body-sm text-muted-foreground">
              Loading…
            </p>
          )}
        </section>
        <form onSubmit={save} className="flex flex-col gap-4 border-t pt-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="openrouter-key">OpenRouter API key</Label>
            <Input
              id="openrouter-key"
              type="password"
              autoComplete="off"
              disabled={busy}
              placeholder={
                settings?.openRouterConfigured ? "Key saved" : "sk-or-…"
              }
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            {settings?.openRouterConfigured && (
              <Button
                type="button"
                variant="ghost"
                onClick={removeKey}
                disabled={busy || modelBusy}
              >
                {keyAction === "remove" ? "Removing…" : "Remove key"}
              </Button>
            )}
            <Button disabled={busy || modelBusy || !key.trim()}>
              {keyAction === "save" ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
        <div className="border-t pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            disabled={busy || modelBusy}
          >
            Sign out
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-body-sm text-destructive">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
