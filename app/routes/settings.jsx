import * as React from "react";
import { toast } from "@/components/ui/toast";
import { ButtonLink } from "@/components/button-link";
import { GenerationNotice } from "@/components/study/generation-status";
import { ModelPicker } from "@/components/study/model-picker";
import { ShuffleSettings } from "@/components/study/shuffle-settings";
import { StudyAppHeader } from "@/components/study/study-app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/runtime-client";
import { downloadUnsyncedChanges, signOut } from "@/lib/sign-out";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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
  const [unsyncedSignOut, setUnsyncedSignOut] = React.useState(false);
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
      toast.add({ title: "OpenRouter key saved", type: "success" });
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
      toast.add({ title: "OpenRouter key removed", type: "success" });
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
  async function handleSignOut(discardUnsynced = false) {
    setBusy(true);
    setError(null);
    try {
      await signOut({ discardUnsynced });
    } catch (cause) {
      setError(cause.message);
      setUnsyncedSignOut(cause.code === "UNSYNCED_CHANGES");
      setBusy(false);
    }
  }
  async function downloadPending() {
    setBusy(true);
    try {
      await downloadUnsyncedChanges();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="min-h-dvh bg-background"
      style={{ "--study-app-header-height": "56px" }}
    >
      <StudyAppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-headline-lg">Settings</h1>
          <ButtonLink variant="ghost" to="/generate?view=generations">
            Generations
          </ButtonLink>
        </div>
        <section
          aria-labelledby="study-settings-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="study-settings-heading" className="text-title-lg">
            Study
          </h2>
          <ShuffleSettings />
        </section>
        <section
          aria-labelledby="connection-heading"
          className="grid min-w-0 gap-5 border-t pt-6 sm:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-1">
            <h2 id="connection-heading" className="text-title-lg">
              OpenRouter
            </h2>
            <span className="text-body-sm text-muted-foreground">
              {settings
                ? settings.openRouterConfigured
                  ? "Connected"
                  : "Not connected"
                : "Loading…"}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Generation model"
              className="flex min-w-0 flex-col gap-3"
            >
              <h3 className="text-title-md">Generation model</h3>
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
            <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
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
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={busy || modelBusy || !key.trim()}
                >
                  {keyAction === "save" ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </section>
        <section
          aria-labelledby="session-heading"
          className="flex flex-col gap-3 border-t pt-6"
        >
          <h2 id="session-heading" className="text-title-lg">
            Session
          </h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleSignOut()}
            className="self-start"
            disabled={busy || modelBusy}
          >
            Sign out
          </Button>
          {unsyncedSignOut && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" disabled={busy} onClick={downloadPending}>
                Download unsynced changes
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="ghost" disabled={busy} />}
                >
                  Discard changes and sign out
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Discard unsynced changes?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Unsynced answers and favorites on this device will be
                      erased. Download a recovery copy first if you need to keep
                      them. The recovery file is for reviewing changes, not
                      importing a study set.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep changes</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => handleSignOut(true)}
                    >
                      Discard and sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </section>
        <GenerationNotice>{error}</GenerationNotice>
      </main>
    </div>
  );
}
