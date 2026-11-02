import { useState } from "react";
import { getToolName, isToolUIPart } from "ai";
import { cn } from "@/lib/utils";
import { AiResponse } from "./response";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

const toolLabels = {
  "input-streaming": "Preparing",
  "input-available": "Running",
  "approval-requested": "Needs approval",
  "approval-responded": "Approval recorded",
  "output-available": "Completed",
  "output-error": "Failed",
  "output-denied": "Denied",
};

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function Payload({ title, value, error = false }) {
  if (value === undefined) {
    return null;
  }
  return (
    <CodeBlock size="sm" variant={error ? "destructive" : "default"}>
      <CodeBlockHeader>
        <CodeBlockTitle>{title}</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent wrap className="max-h-64">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </CodeBlockContent>
    </CodeBlock>
  );
}

/** A tool stays inert until the host explicitly handles an approval. */
export function AiTool({ part, onApproval }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const approval = part.state === "approval-requested";
  const failed = part.state === "output-error";
  const running = ["input-streaming", "input-available"].includes(part.state);
  const label = toolLabels[part.state] ?? part.state;
  async function answer(approved) {
    if (pending || !onApproval) {
      return;
    }
    setPending(true);
    setError("");
    try {
      await onApproval({ id: part.approval.id, approved });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not record approval.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine
            status={
              failed
                ? "error"
                : running
                  ? "running"
                  : approval
                    ? "pending"
                    : undefined
            }
          >
            <TraceTitle>{part.title ?? getToolName(part)}</TraceTitle>
            <TraceDescription>{label}</TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="space-y-3">
          <Payload title="Input" value={part.input} />
          <Payload title="Output" value={part.output} />
          <Payload title="Error" value={part.errorText} error />
        </TraceCollapsibleContent>
      </TraceCollapsible>
      {approval && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={`Approve ${getToolName(part)}`}
        >
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !onApproval}
            onClick={() => answer(false)}
          >
            Deny
          </Button>
          <Button
            size="sm"
            disabled={pending || !onApproval}
            onClick={() => answer(true)}
          >
            Approve
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      )}
    </Trace>
  );
}

export function AiReasoning({
  part,
  isStreaming = false,
  responseProps,
  responseComponent: Response = AiResponse,
}) {
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={isStreaming ? "running" : undefined}>
            <TraceTitle>{isStreaming ? "Reasoning…" : "Reasoning"}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Response {...responseProps} isStreaming={isStreaming}>
            {part.text}
          </Response>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

/** Render AI SDK UIMessage parts without flattening tools/sources into strings. */
export function AiMessage({
  message,
  isStreaming = false,
  onApproval,
  renderPart,
  responseProps,
  responseComponent: Response = AiResponse,
}) {
  const user = message.role === "user";
  return (
    <Message align={user ? "end" : "start"} data-ai-message={message.id}>
      <MessageContent className="gap-3">
        <MessageHeader
          className={cn(
            "text-label-sm text-muted-foreground",
            user && "justify-end",
          )}
        >
          {user ? "You" : "Assistant"}
        </MessageHeader>
        {message.parts.map((part, index) => {
          const key = `${message.id}-${part.toolCallId ?? part.sourceId ?? part.id ?? index}`;
          const custom = renderPart?.(part, message);
          if (custom !== undefined) {
            return <div key={key}>{custom}</div>;
          }
          if (part.type === "text") {
            return user ? (
              <Bubble key={key} variant="muted" align="end">
                <BubbleContent className="whitespace-pre-wrap">
                  {part.text}
                </BubbleContent>
              </Bubble>
            ) : (
              <Response
                key={key}
                {...responseProps}
                isStreaming={isStreaming && part.state !== "done"}
              >
                {part.text}
              </Response>
            );
          }
          if (part.type === "reasoning") {
            return (
              <AiReasoning
                key={key}
                part={part}
                isStreaming={isStreaming && part.state !== "done"}
                responseProps={responseProps}
                responseComponent={Response}
              />
            );
          }
          if (isToolUIPart(part)) {
            return <AiTool key={key} part={part} onApproval={onApproval} />;
          }
          if (part.type === "source-url") {
            const href = externalUrl(part.url);
            return (
              <Trace key={key}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <TraceLine>
                      <TraceTitle>{part.title ?? href}</TraceTitle>
                      <TraceDescription>Source</TraceDescription>
                    </TraceLine>
                  </a>
                ) : (
                  <TraceLine>
                    <TraceTitle>{part.title ?? "Source"}</TraceTitle>
                  </TraceLine>
                )}
              </Trace>
            );
          }
          if (part.type === "file" || part.type === "source-document") {
            // Rendering metadata never fetches an arbitrary model-supplied URL.
            // Applications can opt into their authorized download/preview flow.
            return (
              <Attachment
                key={key}
                size="sm"
                className={user ? "self-end" : undefined}
              >
                <AttachmentContent>
                  <AttachmentTitle>
                    {part.filename ?? part.title ?? "Attachment"}
                  </AttachmentTitle>
                  <AttachmentDescription>
                    {part.mediaType}
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            );
          }
          // step-start is structural. Custom/data parts belong to the host's
          // explicit renderPart mapping, never an implicit executable renderer.
          return null;
        })}
      </MessageContent>
    </Message>
  );
}

/** Constrain this component's height; the provider owns scrolling, not transport. */
export function AiConversation({
  messages,
  status = "ready",
  onApproval,
  renderPart,
  responseProps,
  responseComponent = AiResponse,
  className,
  emptyState = "Start a chat.",
  children,
  ...providerProps
}) {
  const visibleMessages = messages.filter(
    (message) => message.role !== "system",
  );
  const streaming = status === "submitted" || status === "streaming";
  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      {...providerProps}
    >
      <MessageScroller className={className}>
        <MessageScrollerViewport aria-label="Chat">
          <MessageScrollerContent className="px-1 py-4">
            {visibleMessages.length === 0 && (
              <MessageScrollerItem messageId="empty">
                <p className="text-body-md py-6 text-muted-foreground">
                  {emptyState}
                </p>
              </MessageScrollerItem>
            )}
            {visibleMessages.map((message, index) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.role === "user"}
              >
                <AiMessage
                  message={message}
                  isStreaming={
                    streaming && index === visibleMessages.length - 1
                  }
                  onApproval={onApproval}
                  renderPart={renderPart}
                  responseProps={responseProps}
                  responseComponent={responseComponent}
                />
              </MessageScrollerItem>
            ))}
            {status === "submitted" && (
              <MessageScrollerItem messageId="waiting">
                <p className="text-body-sm text-muted-foreground">
                  Waiting for response…
                </p>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
        {children}
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
