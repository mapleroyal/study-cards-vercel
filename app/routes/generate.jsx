import * as React from "react";
import { toast } from "sonner";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { PlusIcon } from "@primer/octicons-react";
import { GenerationInstructions } from "@/components/study/generation-instructions";
import { GenerateCardsButton } from "@/components/study/generate-cards-button";
import { OpenRouterKeyDialog } from "@/components/study/openrouter-key-dialog";
import { ModelPicker } from "@/components/study/model-picker";
import { StudyAppHeader } from "@/components/study/study-app-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function isReusableSource(source) {
  return Boolean(source && !["uploading", "deleting"].includes(source.status));
}

function canCancelJob(job) {
  return (
    activeJobStatuses.has(job?.status) ||
    (job?.status === "canceled" && Boolean(job.cancellationError))
  );
}

export function meta({ location }) {
  const historyView =
    new globalThis.URLSearchParams(location.search).get("view") ===
    "generations";
  return [
    { title: formatPageTitle(historyView ? "Generations" : "Generate cards") },
  ];
}
export default function GenerateRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false);
  const [params, setParams] = useSearchParams();
  const jobId = params.get("job");
  const historyView = params.get("view") === "generations";
  const [mode, setMode] = React.useState("file");
  const [file, setFile] = React.useState(null);
  const [text, setText] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const retryInstructionsRef = React.useRef("");
  const [sourceId, setSourceId] = React.useState("");
  const [sources, setSources] = React.useState([]);
  const [highlightedSourceId, setHighlightedSourceId] = React.useState(null);
  const [types, setTypes] = React.useState([...supportedCardTypes]);
  const [count, setCount] = React.useState("25");
  const [job, setJob] = React.useState(null);
  const [jobs, setJobs] = React.useState([]);
  const [jobsLoaded, setJobsLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(null);
  const [cancelingId, setCancelingId] = React.useState(null);
  const cancelingRef = React.useRef(null);
  const [error, setError] = React.useState(null);
  const [ready, setReady] = React.useState(false);
  const [settings, setSettings] = React.useState(null);
  const [modelBusy, setModelBusy] = React.useState(false);
  const requestRef = React.useRef(null);
  const preparedRef = React.useRef(null);
  const fileInput = React.useRef(null);
  const librarySignature = useStudySetsStore((state) =>
    JSON.stringify(state.records.map(({ id, revision }) => [id, revision])),
  );
  const visibleJobs = jobs.filter(
    (item) => item.status !== "completed" || item.resultRecord?.slug,
  );
  const active = activeJobStatuses.has(job?.status);
  const hasActiveJobs = jobs.some((item) => activeJobStatuses.has(item.status));
  const selectedSource = sources.find((source) => source.id === sourceId);

  React.useEffect(() => {
    setInstructions(retryInstructionsRef.current);
    retryInstructionsRef.current = "";
  }, [location.key]);

  React.useEffect(() => {
    if (
      ready &&
      settings?.openRouterConfigured === false &&
      !jobId &&
      !historyView
    ) {
      setKeyDialogOpen(true);
    }
  }, [ready, settings?.openRouterConfigured, jobId, historyView, location.key]);

  React.useEffect(() => {
    let stopped = false;
    Promise.all([apiRequest("/api/sources"), apiRequest("/api/settings")])
      .then(([sourceResult, nextSettings]) => {
        if (!stopped) {
          setSources(sourceResult.sources);
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
    if (cancelingId) {
      return;
    }
    let stopped = false;
    let timer;
    async function refresh() {
      try {
        const result = await apiRequest("/api/generation/jobs");
        if (!stopped) {
          setJobs(result.jobs);
          setJobsLoaded(true);
          if (result.jobs.some((item) => activeJobStatuses.has(item.status))) {
            timer = setTimeout(refresh, 1500);
          }
        }
      } catch (cause) {
        if (!stopped) {
          setError(cause.message);
          if (hasActiveJobs) {
            timer = setTimeout(refresh, 5000);
          }
        }
      }
    }
    refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [librarySignature, hasActiveJobs, cancelingId]);

  React.useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    if (cancelingId === jobId) {
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
          const records = await useStudySetsStore.getState().load();
          if (!stopped) {
            const currentRecord = records.find(
              (record) => record.id === next.resultRecord.id,
            );
            if (currentRecord) {
              navigate(`/sets/${currentRecord.slug}`, { replace: true });
            } else {
              setJob({ ...next, resultRecord: null });
              setJobs((current) =>
                current.map((item) =>
                  item.id === next.id ? { ...item, resultRecord: null } : item,
                ),
              );
            }
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
  }, [jobId, navigate, cancelingId]);

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
        reasoningEffort: settings?.reasoningEffort,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
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
  async function cancel(id) {
    if (!id || cancelingRef.current) {
      return;
    }
    cancelingRef.current = id;
    setCancelingId(id);
    setError(null);
    try {
      const result = await apiRequest(
        `/api/generation/jobs/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
          body: {},
        },
      );
      setJob((current) => (current?.id === id ? result.job : current));
      setJobs((current) =>
        current.map((item) => (item.id === id ? result.job : item)),
      );
    } catch (cause) {
      setError(cause.message);
    } finally {
      cancelingRef.current = null;
      setCancelingId(null);
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
    const source = sources.find((item) => item.id === job.sourceId);
    setSourceId(isReusableSource(source) ? source.id : "");
    setFile(null);
    setText("");
    setTypes(job.cardTypes);
    setCount(String(job.questionCount));
    retryInstructionsRef.current = job.instructions || "";
    preparedRef.current = null;
    requestRef.current = null;
    setParams({});
    setError(
      isReusableSource(source) ? null : "Add the source again to retry.",
    );
  }
  const canSubmit =
    ready &&
    settings?.openRouterConfigured &&
    types.length > 0 &&
    Number.isSafeInteger(Number(count)) &&
    Number(count) > 0 &&
    (sourceId
      ? isReusableSource(selectedSource)
      : mode === "text"
        ? text.trim()
        : file);
  return (
    <div
      className="min-h-dvh bg-background"
      style={{ "--study-app-header-height": "56px" }}
    >
      <StudyAppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-headline-lg">
            {historyView ? "Generations" : "Generate cards"}
          </h1>
          {historyView && <GenerateCardsButton variant="outline" />}
        </div>
        {jobId ? (
          <section className="flex flex-col gap-4" aria-live="polite">
            <div className="flex items-center gap-3">
              {active && <Spinner />}
              <p className="text-title-lg">
                {job?.status === "completed" && !job.resultRecord
                  ? "Set deleted"
                  : job
                    ? jobLabels[job.status] || job.status
                    : "Loading…"}
              </p>
            </div>
            {job?.error && (
              <p role="alert" className="text-body-sm text-destructive">
                {typeof job.error === "string" ? job.error : job.error.message}
              </p>
            )}
            {job?.cancellationError && (
              <p role="alert" className="text-body-sm text-destructive">
                {job.cancellationError}
              </p>
            )}
            <div className="flex gap-2">
              {canCancelJob(job) ? (
                <Button
                  variant="outline"
                  onClick={() => cancel(job.id)}
                  disabled={Boolean(busy) || Boolean(cancelingId)}
                >
                  {cancelingId === job.id
                    ? "Canceling…"
                    : job.cancellationError
                      ? "Retry cancel"
                      : "Cancel"}
                </Button>
              ) : (
                job && (
                  <>
                    {job.status !== "completed" && (
                      <Button
                        onClick={retry}
                        disabled={!ready || Boolean(busy)}
                      >
                        Try again
                      </Button>
                    )}
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
        ) : !historyView ? (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <fieldset
              disabled={Boolean(busy) || modelBusy || !ready}
              className="contents"
            >
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
                    <span
                      className="truncate text-title-md"
                      title={selectedSource?.name}
                    >
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
                  <TooltipProvider>
                    <Combobox
                      onOpenChange={(open) => {
                        if (!open) {
                          setHighlightedSourceId(null);
                        }
                      }}
                      onItemHighlighted={(id, details) =>
                        setHighlightedSourceId(
                          details.reason === "none" ? null : id,
                        )
                      }
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
                          {(id) => {
                            const name =
                              sources.find((source) => source.id === id)
                                ?.name || id;
                            return (
                              <Tooltip
                                key={id}
                                open={highlightedSourceId === id}
                              >
                                <TooltipTrigger
                                  render={<ComboboxItem value={id} />}
                                >
                                  {name}
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <span className="min-w-0 [overflow-wrap:anywhere]">
                                    {name}
                                  </span>
                                </TooltipContent>
                              </Tooltip>
                            );
                          }}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </TooltipProvider>
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
              {settings && (
                <section
                  aria-label="Generation model"
                  className="flex flex-col gap-3"
                >
                  <h2 className="text-title-md">Model</h2>
                  <ModelPicker
                    value={{
                      model: settings.model,
                      reasoningEffort: settings.reasoningEffort,
                    }}
                    onChange={saveModel}
                    disabled={Boolean(busy) || modelBusy}
                  />
                </section>
              )}
              {settings && !settings.openRouterConfigured && (
                <Button
                  type="button"
                  variant="ghost"
                  className="self-start"
                  onClick={() => setKeyDialogOpen(true)}
                >
                  Add API key
                </Button>
              )}
              <div className="flex items-center justify-end gap-2">
                <GenerationInstructions
                  value={instructions}
                  onChange={setInstructions}
                  disabled={Boolean(busy) || modelBusy}
                />
                <Button disabled={!canSubmit || Boolean(busy) || modelBusy}>
                  {busy ? <Spinner /> : <PlusIcon aria-hidden="true" />}
                  {busy || "Generate"}
                </Button>
              </div>
            </fieldset>
          </form>
        ) : null}
        {error && (
          <p role="alert" className="text-body-sm text-destructive">
            {error}
          </p>
        )}
        {(visibleJobs.length > 0 || historyView) && (
          <section className="flex flex-col gap-2 border-t pt-5">
            <h2 className="text-title-md">Recent generations</h2>
            {visibleJobs.length === 0 && (
              <p className="text-body-sm text-muted-foreground">
                {jobsLoaded ? "No generations yet" : "Loading…"}
              </p>
            )}
            {visibleJobs.map((item) => {
              const title =
                item.resultRecord?.rawSet?.title ||
                sources.find((source) => source.id === item.sourceId)?.name ||
                item.sourceName ||
                "Study set";
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-body-sm">{title}</p>
                    {item.status !== "completed" && (
                      <p className="text-body-sm text-muted-foreground">
                        {item.cancellationError
                          ? "Cancellation unconfirmed"
                          : jobLabels[item.status] || item.status}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canCancelJob(item) && item.id !== jobId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancel(item.id)}
                        disabled={Boolean(cancelingId) || Boolean(busy)}
                        aria-label={
                          (item.cancellationError
                            ? "Retry cancel for "
                            : "Cancel generation for ") + title
                        }
                      >
                        {cancelingId === item.id
                          ? "Canceling…"
                          : item.cancellationError
                            ? "Retry cancel"
                            : "Cancel"}
                      </Button>
                    )}
                    {item.status === "completed" && item.resultRecord?.slug ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/sets/${item.resultRecord.slug}`}>
                          Open set
                        </Link>
                      </Button>
                    ) : item.id !== jobId ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to={`?${
                            historyView ? "view=generations&" : ""
                          }job=${encodeURIComponent(item.id)}`}
                          aria-label={`View details for ${title}`}
                        >
                          Details
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
      <OpenRouterKeyDialog
        open={keyDialogOpen}
        onOpenChange={setKeyDialogOpen}
        onSaved={setSettings}
      />
    </div>
  );
}
