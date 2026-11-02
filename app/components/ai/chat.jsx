import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  convertFileListToFileUIParts,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiComposer } from "./composer";
import { AiConversation } from "./conversation";

/**
 * AI SDK adapter. Transport is required: this template never invents a backend.
 * Create it once (module scope/useMemo), or remount AiChat with key={threadId}.
 */
export function AiChat({
  transport,
  id,
  initialMessages,
  chatOptions,
  className,
  renderPart,
  responseProps,
  responseComponent,
  composerProps,
  emptyState,
}) {
  if (!transport) {
    throw new Error("AiChat requires an AI SDK ChatTransport.");
  }
  const [submissionError, setSubmissionError] = useState("");
  const chat = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    ...chatOptions,
    id,
    transport,
    messages: initialMessages,
  });
  useEffect(
    () => () => {
      void chat.stop().catch(() => {});
    },
    [chat.stop],
  );
  const busy = chat.status === "submitted" || chat.status === "streaming";
  const error = submissionError || chat.error?.message;
  async function submit({ text, files }) {
    // Finish file preparation before the composer clears its draft.
    const fileParts = files.length
      ? await convertFileListToFileUIParts(files)
      : undefined;
    setSubmissionError("");
    chat.clearError();
    // sendMessage resolves at the END of the stream. Accept the draft now so
    // the user can type the next message while this response is streaming.
    void chat
      .sendMessage({ text, files: fileParts })
      .catch((cause) => setSubmissionError(cause.message));
  }
  function retry() {
    setSubmissionError("");
    chat.clearError();
    void chat.regenerate().catch((cause) => setSubmissionError(cause.message));
  }
  return (
    <div
      className={cn("flex h-[36rem] min-h-0 min-w-0 flex-col gap-3", className)}
      data-ai-chat=""
      data-status={chat.status}
    >
      <AiConversation
        className="min-h-0 flex-1"
        messages={chat.messages}
        status={chat.status}
        onApproval={chat.addToolApprovalResponse}
        renderPart={renderPart}
        responseProps={responseProps}
        responseComponent={responseComponent}
        emptyState={emptyState}
      />
      <div role="status" aria-live="polite" className="sr-only">
        {busy ? "Response in progress" : error ? "Response failed" : "Ready"}
      </div>
      {error && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-body-sm text-destructive">{error}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={retry}
            disabled={busy || chat.messages.length === 0}
          >
            Retry response
          </Button>
        </div>
      )}
      <AiComposer
        {...composerProps}
        status={chat.status}
        onSubmit={submit}
        onStop={() => {
          void chat.stop().catch((cause) => setSubmissionError(cause.message));
        }}
      />
    </div>
  );
}
