import { expect, it, vi } from "vitest";
import { generateWithOpenRouter } from "./openrouter.mjs";
import { readOpenRouterResponse } from "./openrouter-stream.mjs";

const document = { source: { name: "Notes" }, text: "Ailerons control roll." };
const job = {
  questionCount: 1,
  cardTypes: ["short_answer"],
  model: "fixture",
  reasoningEffort: "high",
  modelSnapshot: { maxCompletionTokens: 128000 },
};
const set = {
  title: "Aircraft",
  category: "Training",
  cards: [
    {
      id: 1,
      type: "short_answer",
      question: "What controls roll?",
      answer: "Ailerons",
      explanation: "Ailerons control roll.",
    },
  ],
};
const chunk = (delta, extras = {}) => ({
  id: "gen-stream",
  provider: "fixture",
  choices: [{ index: 0, delta, ...extras }],
});
function stream(events, { done = true, headers = {}, split = false } = {}) {
  const text = `: OPENROUTER PROCESSING\n\n${events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("")}${done ? "data: [DONE]\n\n" : ""}`;
  const bytes = new globalThis.TextEncoder().encode(text);
  return new globalThis.Response(
    new globalThis.ReadableStream({
      start(controller) {
        if (split) {
          for (let i = 0; i < bytes.length; i += 7) {
            controller.enqueue(bytes.slice(i, i + 7));
          }
        } else {
          controller.enqueue(bytes);
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream", ...headers } },
  );
}
const usage = {
  cost: 0.02,
  prompt_tokens: 20,
  completion_tokens: 50,
  completion_tokens_details: { reasoning_tokens: 10 },
};

it("assembles fragmented Unicode output, PDF annotations and the final accounting frame", async () => {
  const setWithUnicode = { ...set, title: "Aircraft αβ 🛩️" };
  const json = JSON.stringify(setWithUnicode);
  const annotation = {
    type: "file",
    file: {
      hash: "source-hash",
      content: [{ type: "text", text: document.text }],
    },
  };
  const events = [
    chunk({ annotations: [annotation] }),
    chunk({ content: json.slice(0, 31) }),
    chunk(
      { content: json.slice(31) },
      { finish_reason: "stop", native_finish_reason: "end_turn" },
    ),
    {
      ...chunk({}, { finish_reason: "stop", native_finish_reason: "end_turn" }),
      usage,
    },
  ];
  const onUsage = vi.fn();
  const onParsed = vi.fn();
  const fetchImpl = vi.fn().mockResolvedValue(
    stream(events, {
      split: true,
      headers: { "X-Generation-Id": "gen-stream" },
    }),
  );
  expect(
    await generateWithOpenRouter({
      document,
      job,
      apiKey: "fixture",
      fetchImpl,
      onUsage,
      onParsed,
    }),
  ).toEqual(setWithUnicode);
  expect(onUsage).toHaveBeenCalledTimes(2);
  expect(onUsage.mock.calls[0][0]).toMatchObject({
    generationId: "gen-stream",
    cost: null,
    usageComplete: false,
  });
  expect(onUsage.mock.calls[1][0]).toMatchObject({
    generationId: "gen-stream",
    cost: 0.02,
    outputTokens: 50,
    reasoningTokens: 10,
    visibleOutputTokens: 40,
    usageComplete: true,
  });
  expect(onParsed).toHaveBeenCalledWith([annotation]);
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 128000,
  });
});

it("accepts the standard empty-choices final usage frame", async () => {
  const result = await readOpenRouterResponse(
    stream([
      chunk({ content: JSON.stringify(set) }, { finish_reason: "stop" }),
      { id: "gen-stream", choices: [], usage },
    ]),
    { onStart: vi.fn() },
  );
  expect(result.usage).toEqual(usage);
  expect(result.choices[0].finish_reason).toBe("stop");
});

it("fails interrupted streams even when their partial output happens to be valid JSON", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(
      stream([chunk({ content: JSON.stringify(set) })], { done: false }),
    );
  const onUsage = vi.fn();
  await expect(
    generateWithOpenRouter({
      document,
      job,
      apiKey: "fixture",
      fetchImpl,
      onUsage,
    }),
  ).rejects.toThrow("connection ended before generation finished");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(onUsage).toHaveBeenCalledWith(
    expect.objectContaining({ generationId: "gen-stream", cost: null }),
  );
});

it("does not retry or save a response containing a midstream provider error", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    stream([
      chunk({ content: JSON.stringify(set) }),
      {
        ...chunk({}, { finish_reason: "error" }),
        error: { message: "Provider disconnected unexpectedly" },
      },
    ]),
  );
  await expect(
    generateWithOpenRouter({ document, job, apiKey: "fixture", fetchImpl }),
  ).rejects.toThrow("Provider disconnected unexpectedly");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it("does not retry malformed stream events", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    new globalThis.Response("data: {invalid}\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  await expect(
    generateWithOpenRouter({ document, job, apiKey: "fixture", fetchImpl }),
  ).rejects.toThrow("unreadable response");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it("preserves streamed reasoning signatures for the one schema-repair call", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      stream([
        chunk({
          reasoning_details: [
            {
              index: 0,
              type: "reasoning.encrypted",
              id: "reason-one",
              data: "first",
            },
          ],
        }),
        chunk(
          {
            reasoning_details: [{ index: 0, data: "-last" }],
            content: JSON.stringify({ ...set, cards: [] }),
          },
          { finish_reason: "stop" },
        ),
        { id: "gen-stream", choices: [], usage },
      ]),
    )
    .mockResolvedValueOnce(
      stream([
        {
          ...chunk({ content: JSON.stringify(set) }, { finish_reason: "stop" }),
          id: "gen-repair",
          usage,
        },
      ]),
    );
  expect(
    await generateWithOpenRouter({
      document,
      job,
      apiKey: "fixture",
      fetchImpl,
    }),
  ).toEqual(set);
  const payload = JSON.parse(fetchImpl.mock.calls[1][1].body);
  expect(payload.messages.at(-2).reasoning_details).toEqual([
    {
      index: 0,
      type: "reasoning.encrypted",
      id: "reason-one",
      data: "first-last",
    },
  ]);
});

it("does not treat DONE without a terminal choice as a complete response or start repair", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(stream([chunk({ content: JSON.stringify(set) })]));
  await expect(
    generateWithOpenRouter({ document, job, apiKey: "fixture", fetchImpl }),
  ).rejects.toThrow("connection ended before generation finished");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it.each(["error", "content_filter"])(
  "does not retry a provider %s stop as a schema problem",
  async (finishReason) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        stream([chunk({ content: "" }, { finish_reason: finishReason })]),
      );
    await expect(
      generateWithOpenRouter({ document, job, apiKey: "fixture", fetchImpl }),
    ).rejects.toThrow(/provider/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  },
);

it("does not retry a refusal as a schema problem", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(
      stream([
        chunk({ content: "", refusal: "Refused" }, { finish_reason: "stop" }),
      ]),
    );
  await expect(
    generateWithOpenRouter({ document, job, apiKey: "fixture", fetchImpl }),
  ).rejects.toThrow("provider declined");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
