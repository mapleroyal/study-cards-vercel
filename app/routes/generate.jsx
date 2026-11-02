import * as React from "react";
import { toast } from "@/components/ui/toast";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  CheckIcon,
  PencilIcon,
  FileIcon,
  KebabHorizontalIcon,
  XIcon,
} from "@primer/octicons-react";
import { ButtonLink } from "@/components/button-link";
import {
  GenerationNotice,
  GenerationStatus,
} from "@/components/study/generation-status";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
} from "@/components/ui/attachment";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { createFuzzyFilter } from "@/lib/fuzzy-search";
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

function sourceDetails(source) {
  const parts = [];
  const createdAt = new Date(source?.createdAt);
  if (!Number.isNaN(createdAt.getTime())) {
    parts.push(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(createdAt),
    );
  }
  if (Number.isFinite(source?.size)) {
    const unit =
      source.size >= 1024 * 1024 ? "MB" : source.size >= 1024 ? "KB" : "B";
    const divisor = unit === "MB" ? 1024 * 1024 : unit === "KB" ? 1024 : 1;
    parts.push(
      `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(source.size / divisor)} ${unit}`,
    );
  }
  return parts.join(" · ");
}

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
  const [typesOpen, setTypesOpen] = React.useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = React.useState(null);
  const [types, setTypes] = React.useState([...supportedCardTypes]);
  const [count, setCount] = React.useState("25");
  const [loadedJob, setJob] = React.useState(null);
  const job = loadedJob?.id === jobId ? loadedJob : null;
  const [jobError, setJobError] = React.useState(null);
  const [historyError, setHistoryError] = React.useState(null);
  const [editingSourceName, setEditingSourceName] = React.useState(false);
  const [sourceName, setSourceName] = React.useState("");
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
  const historyVisible = historyView || visibleJobs.length > 0;
  const sourcesById = React.useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const selectedSource = sourcesById.get(sourceId);
  const reusableSourceIds = React.useMemo(
    () => sources.filter(isReusableSource).map((source) => source.id),
    [sources],
  );
  const sourceFilter = React.useMemo(
    () =>
      createFuzzyFilter(
        reusableSourceIds,
        (id) => sourcesById.get(id)?.name || id,
      ),
    [sourcesById, reusableSourceIds],
  );

  React.useEffect(() => {
    setEditingSourceName(false);
  }, [sourceId]);

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
    let inFlight = false;
    let timer;
    const visible = () => document.visibilityState !== "hidden";
    async function refresh() {
      clearTimeout(timer);
      if (stopped || inFlight || !visible()) {
        return;
      }
      inFlight = true;
      let delay;
      try {
        const result = await apiRequest("/api/generation/jobs");
        if (!stopped) {
          setJobs(result.jobs);
          setJobsLoaded(true);
          setHistoryError(null);
          if (result.jobs.some((item) => activeJobStatuses.has(item.status))) {
            delay = 1500;
          } else if (
            historyVisible ||
            result.jobs.some(
              (item) => item.status !== "completed" || item.resultRecord?.slug,
            )
          ) {
            delay = 10000;
          }
        }
      } catch (cause) {
        if (!stopped) {
          setHistoryError(cause.message);
          delay = 5000;
        }
      } finally {
        inFlight = false;
        if (!stopped && visible() && delay) {
          timer = setTimeout(refresh, delay);
        }
      }
    }
    function resume() {
      clearTimeout(timer);
      if (visible()) {
        refresh();
      }
    }
    refresh();
    document.addEventListener("visibilitychange", resume);
    globalThis.addEventListener("focus", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      globalThis.removeEventListener("focus", resume);
    };
  }, [librarySignature, historyVisible, cancelingId]);

  React.useEffect(() => {
    setJobError(null);
    setJob((current) => (current?.id === jobId ? current : null));
    if (!jobId) {
      setJob(null);
      return;
    }
    if (cancelingId === jobId) {
      return;
    }
    let stopped = false;
    let inFlight = false;
    let timer;
    const visible = () => document.visibilityState !== "hidden";
    async function poll() {
      clearTimeout(timer);
      if (stopped || inFlight || !visible()) {
        return;
      }
      inFlight = true;
      let delay;
      try {
        const { job: next } = await apiRequest(
          `/api/generation/jobs/${encodeURIComponent(jobId)}`,
        );
        if (stopped) {
          return;
        }
        setJob(next);
        setJobError(null);
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
            const libraryError = useStudySetsStore.getState().error;
            if (!currentRecord && libraryError) {
              throw new Error(libraryError);
            }
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
          delay = 1500;
        }
      } catch (cause) {
        if (!stopped) {
          setJobError(cause.message);
          delay = 5000;
        }
      } finally {
        inFlight = false;
        if (!stopped && visible() && delay) {
          timer = setTimeout(poll, delay);
        }
      }
    }
    function resume() {
      clearTimeout(timer);
      if (visible()) {
        poll();
      }
    }
    poll();
    document.addEventListener("visibilitychange", resume);
    globalThis.addEventListener("focus", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      globalThis.removeEventListener("focus", resume);
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
      if (cause.pendingSource) {
        setSources((current) => [
          cause.pendingSource,
          ...current.filter((item) => item.id !== cause.pendingSource.id),
        ]);
      }
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
  async function renameSource() {
    if (!selectedSource || busy || !sourceName.trim()) {
      return;
    }
    setBusy("Saving source…");
    setError(null);
    try {
      const { source } = await apiRequest(
        `/api/sources/${encodeURIComponent(selectedSource.id)}`,
        { method: "PATCH", body: { name: sourceName.trim() } },
      );
      setSources((current) =>
        current.map((item) => (item.id === source.id ? source : item)),
      );
      setEditingSourceName(false);
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
      try {
        await apiRequest(`/api/sources/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch (cause) {
        if (cause.status !== 404) {
          throw cause;
        }
      }
      setSources((current) => current.filter((source) => source.id !== id));
      toast.add({ title: "Source deleted", type: "success" });
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
    if (!job) {
      return;
    }
    const source = sourcesById.get(job.sourceId);
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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-headline-lg">
            {historyView ? "Generations" : "Generate cards"}
          </h1>
          <div className="flex shrink-0 gap-1">
            {historyView || jobId ? (
              <GenerateCardsButton />
            ) : (
              <ButtonLink variant="ghost" to="/generate?view=generations">
                Generations
              </ButtonLink>
            )}
          </div>
        </div>
        {jobId ? (
          <section
            aria-label="Generation details"
            className="flex max-w-2xl flex-col gap-5"
          >
            <GenerationStatus job={job} error={jobError} />
            <div className="flex gap-2">
              {canCancelJob(job) ? (
                <Button
                  variant="ghost"
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
                        variant="ghost"
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
          <form onSubmit={submit} className="min-w-0">
            <fieldset
              disabled={Boolean(busy) || modelBusy || !ready}
              className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12"
            >
              <section
                aria-labelledby="source-heading"
                className="flex min-w-0 flex-col gap-4"
              >
                <h2 id="source-heading" className="text-title-lg">
                  Source
                </h2>
                <ToggleGroup
                  variant="outline"
                  spacing={0}
                  value={[mode]}
                  onValueChange={(values) => {
                    const value = values[0];
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
                  <Attachment className="w-full flex-nowrap">
                    <AttachmentMedia>
                      <FileIcon />
                    </AttachmentMedia>
                    <AttachmentContent>
                      {editingSourceName ? (
                        <Input
                          aria-label="Source name"
                          autoFocus
                          value={sourceName}
                          onChange={(event) =>
                            setSourceName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              renameSource();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingSourceName(false);
                            }
                          }}
                        />
                      ) : (
                        <AttachmentTitle title={selectedSource?.name}>
                          {selectedSource?.name || "Selected source"}
                        </AttachmentTitle>
                      )}
                      <AttachmentDescription
                        title={sourceDetails(selectedSource)}
                      >
                        {sourceDetails(selectedSource)}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      {editingSourceName ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Save source name"
                            onClick={renameSource}
                            disabled={!sourceName.trim()}
                          >
                            <CheckIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Cancel source rename"
                            onClick={() => setEditingSourceName(false)}
                          >
                            <XIcon />
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Rename source"
                          onClick={() => {
                            setSourceName(selectedSource?.name || "");
                            setEditingSourceName(true);
                          }}
                        >
                          <PencilIcon />
                        </Button>
                      )}
                      {!editingSourceName && (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Source options"
                                />
                              }
                            >
                              <KebabHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => deleteSource(sourceId)}
                              >
                                Delete source
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove source"
                            onClick={() => setSourceId("")}
                          >
                            <XIcon />
                          </Button>
                        </>
                      )}
                    </AttachmentActions>
                  </Attachment>
                ) : mode === "file" ? (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-5"
                    onDragOver={(event) => {
                      if (
                        Array.from(event.dataTransfer.types).includes("Files")
                      ) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      if (
                        !Array.from(event.dataTransfer.types).includes("Files")
                      ) {
                        return;
                      }
                      event.preventDefault();
                      if (
                        !busy &&
                        !modelBusy &&
                        ready &&
                        event.dataTransfer.files[0]
                      ) {
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
                      variant="ghost"
                      onClick={() => fileInput.current?.click()}
                    >
                      {file ? "Replace" : "Browse"}
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    aria-label="Source text"
                    placeholder="Paste your source text"
                    rows={12}
                    className="min-h-64"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                )}
                {sources.some(isReusableSource) && (
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
                      items={reusableSourceIds}
                      filter={sourceFilter}
                      value={sourceId || null}
                      itemToStringLabel={(id) =>
                        sourcesById.get(id)?.name || id
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
                            const source = sourcesById.get(id);
                            const name = source?.name || id;
                            const details = sourceDetails(source);
                            return (
                              <Tooltip
                                key={id}
                                open={highlightedSourceId === id}
                              >
                                <TooltipTrigger
                                  render={
                                    <ComboboxItem
                                      value={id}
                                      aria-label={
                                        details ? `${name} · ${details}` : name
                                      }
                                    />
                                  }
                                >
                                  <span className="flex min-w-0 flex-1 flex-col">
                                    <span
                                      data-slot="combobox-item-label"
                                      className="min-w-0 truncate"
                                    >
                                      {name}
                                    </span>
                                    {details && (
                                      <span className="truncate text-body-sm text-muted-foreground">
                                        {details}
                                      </span>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="flex-col items-start gap-1"
                                >
                                  <span className="block min-w-0 [overflow-wrap:anywhere]">
                                    {name}
                                  </span>
                                  {details && (
                                    <span className="block text-body-sm">
                                      {details}
                                    </span>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          }}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </TooltipProvider>
                )}
                {sources
                  .filter((source) =>
                    ["uploading", "deleting"].includes(source.status),
                  )
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
                          {source.status === "uploading"
                            ? "Upload incomplete"
                            : source.deletionError
                              ? "Delete failed"
                              : "Deletion incomplete"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSource(source.id)}
                        aria-label={
                          source.status === "uploading"
                            ? `Remove incomplete upload ${source.name}`
                            : undefined
                        }
                      >
                        {source.status === "uploading"
                          ? "Remove"
                          : "Retry delete"}
                      </Button>
                    </div>
                  ))}
              </section>
              <section
                aria-label="Generation options"
                className="flex min-w-0 flex-col gap-6 lg:border-l lg:pl-8"
              >
                <h2 className="text-title-lg">Cards</h2>
                <Collapsible open={typesOpen} onOpenChange={setTypesOpen}>
                  <CollapsibleTrigger className="w-full justify-between">
                    <span>Card types</span>
                    <span className="text-body-sm text-muted-foreground">
                      {types.length === supportedCardTypes.length
                        ? "All card types"
                        : `${types.length} selected`}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <fieldset className="flex flex-col gap-3 p-3">
                      <legend className="sr-only">Card types</legend>
                      <div className="grid gap-3">
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
                  </CollapsibleContent>
                </Collapsible>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="card-count">Number of cards</Label>
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
                    <ModelPicker
                      compact
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
                  <Button
                    type="submit"
                    variant="ghost"
                    disabled={!canSubmit || Boolean(busy) || modelBusy}
                  >
                    {busy && <Spinner />}
                    {busy || "Generate"}
                  </Button>
                </div>
              </section>
            </fieldset>
          </form>
        ) : null}
        <GenerationNotice>{error}</GenerationNotice>
        {(visibleJobs.length > 0 || historyView) && (
          <section className="flex flex-col gap-2 border-t pt-5">
            <h2 className="text-title-md">Recent generations</h2>
            <GenerationNotice>{historyError}</GenerationNotice>
            {visibleJobs.length === 0 && (
              <p className="text-body-sm text-muted-foreground">
                {jobsLoaded ? "No generations yet" : "Loading…"}
              </p>
            )}
            {visibleJobs.map((item) => {
              const title =
                item.resultRecord?.rawSet?.title ||
                sourcesById.get(item.sourceId)?.name ||
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
                      <ButtonLink
                        variant="ghost"
                        size="sm"
                        to={`/sets/${item.resultRecord.slug}`}
                      >
                        Open set
                      </ButtonLink>
                    ) : item.id !== jobId ? (
                      <ButtonLink
                        variant="ghost"
                        size="sm"
                        to={`?${
                          historyView ? "view=generations&" : ""
                        }job=${encodeURIComponent(item.id)}`}
                        aria-label={`View details for ${title}`}
                      >
                        Details
                      </ButtonLink>
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
