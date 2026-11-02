/**
 * Deterministic, network-free AI SDK ChatTransport for the gallery and prototypes.
 * It exercises the same useChat lifecycle as a real provider. It is not an LLM.
 */
export const demoResponse = `## A shared foundation

The response uses **Typeset** for reading rhythm and the app's own code block.

- Appearance follows light, dark, and system preferences.
- Streaming preserves earlier blocks.
- Controls retain the template's shapes and typography.

| Layer | Purpose |
| --- | --- |
| Base UI | Accessible interaction |
| Typeset | Reading rhythm |
| AI SDK | Transport and message state |

\`\`\`js
const appearance = "system";
console.log(appearance);
\`\`\`

A completed local response. No provider or network request was used.`;

export function createDemoTransport({
  response = demoResponse,
  delay = 25,
  fail = false,
} = {}) {
  let sequence = 0;
  const active = new Set();
  return {
    async sendMessages({ abortSignal }) {
      const id = `demo-${++sequence}`;
      const chunks = [
        { type: "start", messageId: id },
        { type: "start-step" },
        { type: "reasoning-start", id: `${id}-reasoning` },
        {
          type: "reasoning-delta",
          id: `${id}-reasoning`,
          delta: "This is a scripted demonstration of the streaming interface.",
        },
        { type: "reasoning-end", id: `${id}-reasoning` },
        {
          type: "tool-input-available",
          toolCallId: `${id}-tool`,
          toolName: "inspectTheme",
          input: { appearance: "system" },
        },
        {
          type: "tool-output-available",
          toolCallId: `${id}-tool`,
          output: { typography: "Typeset", primitives: "Base UI" },
        },
        { type: "text-start", id: `${id}-text` },
        ...(response.match(/.{1,18}|\n/g) ?? []).map((delta) => ({
          type: "text-delta",
          id: `${id}-text`,
          delta,
        })),
        { type: "text-end", id: `${id}-text` },
        {
          type: "source-url",
          sourceId: `${id}-source`,
          url: "https://ui.shadcn.com/docs/ai-elements",
          title: "shadcn AI Elements",
        },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ];
      if (fail) {
        chunks.splice(2, chunks.length, {
          type: "error",
          errorText: "Demo transport failure",
        });
      }
      let position = 0;
      let closed = false;
      let timer;
      let wake;
      let abort;
      function cleanup() {
        clearTimeout(timer);
        wake?.();
        abortSignal?.removeEventListener("abort", abort);
        active.delete(abort);
      }
      return new globalThis.ReadableStream({
        start(controller) {
          abort = () => {
            if (closed) {
              return;
            }
            closed = true;
            controller.error(
              new globalThis.DOMException("Response stopped", "AbortError"),
            );
            cleanup();
          };
          active.add(abort);
          abortSignal?.addEventListener("abort", abort, { once: true });
          if (abortSignal?.aborted) {
            abort();
          }
        },
        async pull(controller) {
          await new Promise((resolve) => {
            wake = resolve;
            timer = setTimeout(resolve, delay);
          });
          wake = undefined;
          if (closed) {
            return;
          }
          controller.enqueue(chunks[position++]);
          if (position === chunks.length) {
            closed = true;
            controller.close();
            cleanup();
          }
        },
        cancel() {
          closed = true;
          cleanup();
        },
      });
    },
    async reconnectToStream() {
      return null;
    },
    close() {
      [...active].forEach((abort) => abort());
    },
  };
}
