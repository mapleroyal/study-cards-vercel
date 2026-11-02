import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  StopIcon,
} from "@primer/octicons-react";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { jobLabels } from "@/lib/generation-client";

export function GenerationNotice({ children }) {
  if (!children) {
    return null;
  }
  return (
    <Marker role="alert" className="items-start text-destructive">
      <MarkerIcon>
        <AlertIcon />
      </MarkerIcon>
      <MarkerContent>{children}</MarkerContent>
    </Marker>
  );
}

// The durable workflow exposes one current stage, not a fabricated tool transcript.
export function GenerationStatus({ job, error }) {
  const running = ["preparing", "generating", "saving"].includes(job?.status);
  const status =
    error || job?.status === "failed"
      ? "error"
      : running
        ? "running"
        : job?.status === "queued" || !job
          ? "pending"
          : "complete";
  const label =
    job?.status === "completed" && !job.resultRecord
      ? "Set deleted"
      : job
        ? jobLabels[job.status] || job.status
        : error
          ? "Could not load generation"
          : "Loading…";
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Trace>
        <TraceLine status={status} role="status" aria-live="polite">
          <TraceIcon>
            {running ? (
              <Spinner />
            ) : status === "error" ? (
              <AlertIcon />
            ) : status === "pending" ? (
              <ClockIcon />
            ) : job?.status === "canceled" ? (
              <StopIcon />
            ) : (
              <CheckIcon />
            )}
          </TraceIcon>
          <TraceTitle className="whitespace-normal">{label}</TraceTitle>
        </TraceLine>
      </Trace>
      <GenerationNotice>{error}</GenerationNotice>
      <GenerationNotice>
        {typeof job?.error === "string" ? job.error : job?.error?.message}
      </GenerationNotice>
      <GenerationNotice>{job?.cancellationError}</GenerationNotice>
    </div>
  );
}
