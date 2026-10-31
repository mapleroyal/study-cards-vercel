import { EventSourceParserStream } from "eventsource-parser/stream";

function mergeReasoning(details, updates) {
  for (const update of updates) {
    const index = update.index ?? details.length;
    const previous = details[index] || {};
    const next = { ...previous, ...update };
    for (const key of ["text", "data", "signature"]) {
      if (
        typeof previous[key] === "string" &&
        typeof update[key] === "string"
      ) {
        next[key] = previous[key] + update[key];
      }
    }
    details[index] = next;
  }
}

export async function readOpenRouterResponse(response, { onStart, signal }) {
  if (!response.headers?.get("content-type")?.includes("text/event-stream")) {
    return response.json();
  }
  if (!response.body) {
    throw new Error("OpenRouter returned an empty response stream.");
  }
  const choice = {
    index: 0,
    message: { role: "assistant", content: "" },
    finish_reason: null,
    native_finish_reason: null,
  };
  const result = {
    id: response.headers.get("x-generation-id") || null,
    choices: [choice],
  };
  const details = [];
  const annotations = new Map();
  let started = false;
  const reader = response.body
    .pipeThrough(new globalThis.TextDecoderStream())
    .pipeThrough(new EventSourceParserStream({ onError: "terminate" }))
    .getReader();
  const announce = async () => {
    if (result.id && !started) {
      await onStart({ id: result.id, provider: result.provider ?? null });
      started = true;
    }
  };
  try {
    await announce();
    while (true) {
      signal?.throwIfAborted();
      const { value: event, done } = await reader.read();
      if (done) {
        break;
      }
      if (event.data === "[DONE]") {
        break;
      }
      const chunk = JSON.parse(event.data);
      result.id ||= chunk.id;
      result.provider = chunk.provider ?? result.provider;
      await announce();
      if (chunk.usage) {
        result.usage = chunk.usage;
      }
      if (chunk.error) {
        result.error = chunk.error;
        break;
      }
      const part = chunk.choices?.find((item) => (item.index ?? 0) === 0);
      if (!part) {
        continue;
      }
      const delta = part.delta || {};
      if (typeof delta.content === "string") {
        choice.message.content += delta.content;
      } else if (Array.isArray(delta.content)) {
        choice.message.content += delta.content
          .filter((item) => item.type === "text")
          .map((item) => item.text || "")
          .join("");
      }
      if (typeof delta.refusal === "string") {
        choice.message.refusal = (choice.message.refusal || "") + delta.refusal;
      }
      if (delta.tool_calls?.length) {
        choice.message.tool_calls ||= [];
        choice.message.tool_calls.push(...delta.tool_calls);
      }
      if (delta.reasoning_details?.length) {
        mergeReasoning(details, delta.reasoning_details);
        choice.message.reasoning_details = details.filter(Boolean);
      }
      for (const annotation of delta.annotations || []) {
        const key =
          annotation.file?.hash ?? annotation.index ?? annotations.size;
        annotations.set(key, annotation);
      }
      if (annotations.size) {
        choice.message.annotations = [...annotations.values()];
      }
      choice.finish_reason = part.finish_reason ?? choice.finish_reason;
      choice.native_finish_reason =
        part.native_finish_reason ?? choice.native_finish_reason;
    }
    signal?.throwIfAborted();
    if (!choice.finish_reason && !result.error) {
      throw new Error(
        "The provider connection ended before generation finished.",
      );
    }
    return result;
  } finally {
    // Canceling the reader also disconnects an interrupted/error stream upstream.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
