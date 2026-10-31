import * as React from "react";
import { toast } from "sonner";
import { Link, useNavigate, useSearchParams } from "react-router";
import { StudyAppHeader } from "@/components/study/study-app-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { apiRequest } from "@/lib/runtime-client";
import {
  activeJobStatuses,
  jobLabels,
  uploadGenerationSource,
} from "@/lib/generation-client";
import { supportedCardTypes } from "@/lib/study-set-validation";
import { humanizeType } from "@/lib/study-sets";
import { formatPageTitle } from "@/lib/app-config";
import { useStudySetsStore } from "@/stores/use-study-sets-store";

export function meta() {
  return [{ title: formatPageTitle("Generate cards") }];
}
export default function GenerateRoute() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const jobId = params.get("job");
  const [mode, setMode] = React.useState("file");
  const [file, setFile] = React.useState(null);
  const [text, setText] = React.useState("");
  const [sourceId, setSourceId] = React.useState("");
  const [sources, setSources] = React.useState([]);
  const [types, setTypes] = React.useState([...supportedCardTypes]);
  const [count, setCount] = React.useState("25");
  const [job, setJob] = React.useState(null);
  const [jobs, setJobs] = React.useState([]);
  const [busy, setBusy] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [ready, setReady] = React.useState(false);
  const [settings, setSettings] = React.useState(null);
  const requestRef = React.useRef(null);
  const preparedRef = React.useRef(null);
  const fileInput = React.useRef(null);
  const active = activeJobStatuses.has(job?.status);
  const selectedSource = sources.find((source) => source.id === sourceId);

  React.useEffect(() => {
    let stopped = false;
    Promise.all([
      apiRequest("/api/sources"),
      apiRequest("/api/generation/jobs"),
      apiRequest("/api/settings"),
    ])
      .then(([sourceResult, jobResult, nextSettings]) => {
        if (!stopped) {
          setSources(sourceResult.sources);
          setJobs(jobResult.jobs);
          setSettings(nextSettings);
          setReady(true);
        }
      })
      .catch((cause) => {
        if (!stopped) {
          setError(cause.message);
        }
      });
    return () => {
      stopped = true;
    };
  }, []);

  React.useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let stopped = false;
    let timer;
    async function poll() {
      try {
        const { job: next } = await apiRequest(
          `/api/generation/jobs/${encodeURIComponent(jobId)}`,
        );
        if (stopped) {
          return;
        }
        setJob(next);
        setJobs((current) => [
          next,
          ...current.filter((item) => item.id !== next.id),
        ]);
        if (next.status === "completed" && next.resultRecord?.slug) {
          await useStudySetsStore.getState().load();
          if (!stopped) {
            navigate(`/sets/${next.resultRecord.slug}`, { replace: true });
          }
          return;
        }
        if (activeJobStatuses.has(next.status)) {
          timer = setTimeout(poll, 1500);
        }
      } catch (cause) {
        if (!stopped) {
          setError(cause.message);
          timer = setTimeout(poll, 5000);
        }
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, navigate]);

  function chooseFile(next) {
    if (next && !/\.(pdf|txt|md)$/i.test(next.name)) {
      setError("Choose a PDF, TXT, or MD file.");
      return;
    }
    setFile(next);
    setSourceId("");
    setError(null);
    preparedRef.current = null;
  }
  async function submit(event) {
    event.preventDefault();
    setError(null);
    setBusy("Preparing source…");
    try {
      let source;
      if (sourceId) {
        source = selectedSource;
      } else if (mode === "text") {
        const signature = `text:${text}`;
        source =
          preparedRef.current?.signature === signature
            ? preparedRef.current.source
            : (
                await apiRequest("/api/sources/text", {
                  method: "POST",
                  body: { text },
                })
              ).source;
        preparedRef.current = { signature, source };
      } else {
        source =
          preparedRef.current?.file === file
            ? preparedRef.current.source
            : await uploadGenerationSource(file);
        preparedRef.current = { file, source };
      }
      if (!source) {
        throw new Error("Add a source.");
      }
      setSources((current) => [
        source,
        ...current.filter((item) => item.id !== source.id),
      ]);
      const body = {
        sourceId: source.id,
        questionCount: Number(count),
        cardTypes: types,
        model: settings?.model,
      };
      const signature = JSON.stringify(body);
      if (requestRef.current?.signature !== signature) {
        requestRef.current = {
          signature,
          mutationId: globalThis.crypto.randomUUID(),
        };
      }
      setBusy("Starting…");
      const { job: next } = await apiRequest("/api/generation/jobs", {
        method: "POST",
        body: { ...body, mutationId: requestRef.current.mutationId },
      });
      setJob(next);
      setParams({ job: next.id });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(null);
    }
  }
  async function cancel() {
    setBusy("Canceling…");
    setError(null);
    try {
      const result = await apiRequest(`/api/generation/jobs/${job.id}/cancel`, {
        method: "POST",
        body: {},
      });
      setJob(result.job);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(null);
    }
  }
  async function deleteSource(id) {
    if (!id || busy) {
      return;
    }
    setBusy("Deleting source…");
    setError(null);
    setSourceId((current) => (current === id ? "" : current));
    preparedRef.current = null;
    try {
      await apiRequest(`/api/sources/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setSources((current) => current.filter((source) => source.id !== id));
      toast.success("Source deleted");
    } catch (cause) {
      setError(cause.message);
      try {
        const result = await apiRequest("/api/sources");
        setSources(result.sources);
      } catch {
        /* Keep the deletion error visible. */
      }
    } finally {
      setBusy(null);
    }
  }
  function retry() {
    setSourceId(job.sourceId);
    setTypes(job.cardTypes);
    setCount(String(job.questionCount));
    requestRef.current = null;
    setParams({});
    setError(null);
  }
  const canSubmit =
    ready &&
    settings?.openRouterConfigured &&
    types.length > 0 &&
    Number.isSafeInteger(Number(count)) &&
    Number(count) > 0 &&
    (sourceId || (mode === "text" ? text.trim() : file));
  return (
    <div
      className="min-h-dvh bg-background"
      style={{ "--study-app-header-height": "56px" }}
    >
      <StudyAppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-8 sm:px-6">
        <h1 className="text-headline-lg">Generate cards</h1>
        {jobId ? (
          <section className="flex flex-col gap-4" aria-live="polite">
            <div className="flex items-center gap-3">
              {active && <Spinner />}
              <p className="text-title-lg">
                {job ? jobLabels[job.status] || job.status : "Loading…"}
              </p>
            </div>
            {job?.error && (
              <p role="alert" className="text-body-sm text-destructive">
                {typeof job.error === "string" ? job.error : job.error.message}
              </p>
            )}
            <div className="flex gap-2">
              {active ? (
                <Button
                  variant="outline"
                  onClick={cancel}
                  disabled={Boolean(busy)}
                >
                  Cancel
                </Button>
              ) : (
                job && (
                  <>
                    <Button onClick={retry}>Try again</Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        requestRef.current = null;
                        setParams({});
                      }}
                    >
                      New set
                    </Button>
                  </>
                )
              )}
            </div>
          </section>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <fieldset disabled={Boolean(busy) || !ready} className="contents">
              <div className="flex flex-col gap-3">
                <ToggleGroup
                  type="single"
                  value={mode}
                  onValueChange={(value) => {
                    if (value) {
                      setMode(value);
                      setSourceId("");
                    }
                  }}
                  aria-label="Source input"
                >
                  <ToggleGroupItem value="file">Upload file</ToggleGroupItem>
                  <ToggleGroupItem value="text">Paste text</ToggleGroupItem>
                </ToggleGroup>
                {sourceId ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-title-md">
                      {selectedSource?.name || "Selected source"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSourceId("")}
                    >
                      Remove
                    </Button>
                  </div>
                ) : mode === "file" ? (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-5"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!busy) {
                        chooseFile(event.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-title-md">
                        {file?.name || "Add source"}
                      </p>
                      <p className="mt-1 text-body-sm text-muted-foreground">
                        PDF, TXT, or MD
                      </p>
                    </div>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.txt,.md"
                      aria-label="Source file"
                      className="hidden"
                      onChange={(event) => {
                        chooseFile(event.target.files[0]);
                        event.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInput.current?.click()}
                    >
                      {file ? "Replace" : "Browse"}
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    aria-label="Source text"
                    placeholder="Paste your source text"
                    rows={10}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                )}
                {sources.length > 0 && (
                  <Combobox
                    items={sources
                      .filter(
                        (source) =>
                          !["uploading", "deleting"].includes(source.status),
                      )
                      .map((source) => source.id)}
                    value={sourceId || null}
                    itemToStringLabel={(id) =>
                      sources.find((source) => source.id === id)?.name || id
                    }
                    onValueChange={(value) => {
                      if (value) {
                        setSourceId(value);
                        setFile(null);
                      }
                    }}
                  >
                    <ComboboxTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          className="self-start"
                        />
                      }
                    >
                      Use a saved source
                    </ComboboxTrigger>
                    <ComboboxContent>
                      <ComboboxInput
                        aria-label="Search sources"
                        placeholder="Search sources…"
                        showTrigger={false}
                      />
                      <ComboboxEmpty>No sources found</ComboboxEmpty>
                      <ComboboxList>
                        {(id) => (
                          <ComboboxItem key={id} value={id}>
                            {sources.find((source) => source.id === id)?.name ||
                              id}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
                {sourceId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-destructive"
                    onClick={() => deleteSource(sourceId)}
                  >
                    Delete source
                  </Button>
                )}
              </div>
              {sources
                .filter((source) => source.status === "deleting")
                .map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body-sm">{source.name}</p>
                      <p
                        className="text-body-sm text-destructive"
                        title={source.deletionError || undefined}
                      >
                        {source.deletionError
                          ? "Delete failed"
                          : "Deletion incomplete"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSource(source.id)}
                    >
                      Retry delete
                    </Button>
                  </div>
                ))}
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-label-lg">Card types</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {supportedCardTypes.map((type) => (
                    <Label key={type} className="flex items-center gap-3">
                      <Checkbox
                        checked={types.includes(type)}
                        onCheckedChange={(checked) =>
                          setTypes((current) =>
                            checked
                              ? [...current, type]
                              : current.filter((item) => item !== type),
                          )
                        }
                      />
                      {humanizeType(type)}
                    </Label>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-center gap-4">
                <Label htmlFor="card-count">Cards</Label>
                <Input
                  id="card-count"
                  type="number"
                  min="1"
                  step="1"
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  className="w-24"
                  required
                />
              </div>
              {settings && !settings.openRouterConfigured && (
                <p className="text-body-sm text-muted-foreground">
                  <Link className="underline underline-offset-4" to="/settings">
                    Add your OpenRouter key
                  </Link>{" "}
                  to generate cards.
                </p>
              )}
              <Button
                className="self-end"
                disabled={!canSubmit || Boolean(busy)}
              >
                {busy && <Spinner />}
                {busy || "Generate"}
              </Button>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="text-body-sm text-destructive">
            {error}
          </p>
        )}
        {jobs.length > 0 && (
          <section className="flex flex-col gap-2 border-t pt-5">
            <h2 className="text-title-md">Recent generations</h2>
            {jobs.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span className="min-w-0 truncate text-body-sm">
                  {item.resultRecord?.rawSet?.title ||
                    sources.find((source) => source.id === item.sourceId)
                      ?.name ||
                    "Study set"}
                </span>
                {item.status === "completed" && item.resultRecord?.slug ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/sets/${item.resultRecord.slug}`}>Open set</Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setParams({ job: item.id })}
                  >
                    {jobLabels[item.status] || item.status}
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
