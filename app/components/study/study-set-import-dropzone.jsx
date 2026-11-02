import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilePlusIcon } from "@hugeicons/core-free-icons";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  getStudySetImportErrorMessage,
  isReplaceableStudySetConflict,
  useStudySetsStore,
} from "@/stores/use-study-sets-store";

function isJsonFile(file) {
  return (
    file?.type === "application/json" ||
    file?.name.toLowerCase().endsWith(".json")
  );
}

export function StudySetImportDropzone({
  variant = "empty",
  onImported,
  className,
}) {
  const inputRef = React.useRef(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [importing, setImporting] = React.useState(false);
  const [pendingReplacement, setPendingReplacement] = React.useState(null);
  const importStudySet = useStudySetsStore((state) => state.importStudySet);
  const compact = variant === "compact";

  function resetInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function importFile(file) {
    if (!file) {
      return;
    }

    setPendingReplacement(null);

    if (!isJsonFile(file)) {
      setError("Choose a .json study set file.");
      resetInput();
      return;
    }

    setImporting(true);
    setError(null);
    let parsedStudySet;

    try {
      parsedStudySet = JSON.parse(await file.text());
      const record = await importStudySet(parsedStudySet);

      onImported?.(record);
    } catch (importError) {
      if (parsedStudySet && isReplaceableStudySetConflict(importError)) {
        setPendingReplacement(parsedStudySet);
      }

      setError(getStudySetImportErrorMessage(importError));
    } finally {
      setImporting(false);
      resetInput();
    }
  }

  async function replacePendingStudySet() {
    if (!pendingReplacement) {
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const record = await importStudySet(pendingReplacement, {
        replaceExisting: true,
      });

      setPendingReplacement(null);
      onImported?.(record);
    } catch (importError) {
      setError(getStudySetImportErrorMessage(importError));
    } finally {
      setImporting(false);
    }
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);

    if (files.length > 1) {
      setPendingReplacement(null);
      setError("Import one JSON file at a time.");
      return;
    }

    importFile(files[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragActive(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/json,.json"
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => handleFiles(event.target.files)}
    />
  );

  if (compact) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {input}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
          className="w-full justify-center text-muted-foreground hover:text-foreground"
        >
          {importing ? (
            <Spinner aria-hidden="true" />
          ) : (
            <HugeiconsIcon icon={FilePlusIcon} strokeWidth={2} />
          )}
          {importing ? "Importing…" : "Import set"}
        </Button>
        {error ? (
          <div className="flex flex-col gap-2 px-1">
            <p role="alert" className="text-body-sm text-destructive">
              {error}
            </p>
            {pendingReplacement ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={importing}
                onClick={replacePendingStudySet}
              >
                Replace existing set
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Empty
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-busy={importing}
        className={cn(
          "min-h-[min(28rem,calc(100dvh-10rem))] border border-dashed border-border bg-muted/20 px-6 py-10 transition-colors",
          dragActive && "border-ring bg-accent",
          className,
        )}
      >
        {input}
        <EmptyHeader>
          <EmptyMedia className="mb-3">
            <HugeiconsIcon
              icon={FilePlusIcon}
              strokeWidth={2}
              className="size-9"
            />
          </EmptyMedia>
          <Button
            type="button"
            variant="ghost"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
          >
            {importing ? <Spinner aria-hidden="true" /> : null}
            {importing ? "Importing…" : "Add a study set"}
          </Button>
          <EmptyDescription className="text-body-sm">
            Drop a JSON study set.
          </EmptyDescription>
        </EmptyHeader>
        {error ? (
          <EmptyContent>
            <Alert variant="destructive" className="max-w-sm">
              <AlertDescription className="flex flex-col items-start gap-3">
                <span>{error}</span>
                {pendingReplacement ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={importing}
                    onClick={replacePendingStudySet}
                  >
                    Replace existing set
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          </EmptyContent>
        ) : null}
      </Empty>
    </>
  );
}
