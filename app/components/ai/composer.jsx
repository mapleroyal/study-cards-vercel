import { useId, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUp02Icon,
  Attachment01Icon,
  Cancel01Icon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";

/** onSubmit resolves when accepted; reject to preserve the draft and show an error. */
export function AiComposer({
  onSubmit,
  onStop,
  status = "ready",
  disabled = false,
  placeholder = "Message…",
  label = "Message",
  accept,
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024,
  className,
  children,
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const errorId = useId();
  const busy = status === "submitted" || status === "streaming";
  const locked = disabled || pending;
  const canSend =
    !locked && !busy && (text.trim().length > 0 || files.length > 0);

  function addFiles(event) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length + selected.length > maxFiles) {
      setError(`Choose up to ${maxFiles} files.`);
      return;
    }
    if (selected.some((file) => file.size > maxFileSize)) {
      setError(
        `Each file must be ${Math.round(maxFileSize / 1024 / 1024)} MB or smaller.`,
      );
      return;
    }
    setError("");
    setFiles((current) => [...current, ...selected]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSend || submitting.current) {
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      // The SDK accepts FileList. DataTransfer preserves actual File objects;
      // files never become object URLs that could outlive their attachments.
      const transfer = new globalThis.DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      await onSubmit({ text: text.trim(), files: transfer.files });
      setText("");
      setFiles([]);
      textareaRef.current?.focus();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not send the message.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className={cn("min-w-0", className)}
      aria-label="Message composer"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={addFiles}
        disabled={locked || busy}
        className="hidden"
        aria-label="Attach files"
      />
      <InputGroup>
        {files.length > 0 && (
          <InputGroupAddon align="block-start" className="flex-wrap">
            {files.map((file, index) => (
              <Attachment key={`${file.name}-${index}`} size="xs">
                <AttachmentContent>
                  <AttachmentTitle>{file.name}</AttachmentTitle>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remove ${file.name}`}
                    disabled={locked}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ))}
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // IME composition Enter confirms a character; it must never send.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.keyCode !== 229
            ) {
              event.preventDefault();
              if (canSend) {
                formRef.current?.requestSubmit();
              }
            }
          }}
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          disabled={locked}
          placeholder={placeholder}
          className="max-h-48 min-h-20 p-3"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            aria-label="Choose attachments"
            size="icon-sm"
            variant="ghost"
            disabled={locked || busy}
            onClick={() => inputRef.current?.click()}
          >
            <HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} />
          </InputGroupButton>
          {children}
          {busy && onStop ? (
            <InputGroupButton
              className="ml-auto"
              aria-label="Stop response"
              size="icon-sm"
              variant="default"
              onClick={onStop}
            >
              <HugeiconsIcon icon={StopIcon} strokeWidth={2} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              className="ml-auto"
              aria-label="Send message"
              size="icon-sm"
              variant="default"
              disabled={!canSend}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-body-sm mt-2 text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  );
}
