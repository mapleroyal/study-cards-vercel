import { describe, expect, it, vi } from "vitest";
import {
  buildGenerationPayload,
  generateWithOpenRouter,
  DEFAULT_GENERATION_MODEL,
} from "./openrouter.mjs";

const document = {
  source: { name: "Complete chapter" },
  text: "First paragraph.\n\nLast paragraph.",
};
const job = {
  questionCount: 1,
  cardTypes: ["short_answer"],
  model: DEFAULT_GENERATION_MODEL,
  reasoningEffort: "xhigh",
  modelSnapshot: { maxCompletionTokens: 128000, reasoning: true },
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
      explanation: "The source names ailerons as the roll controls.",
    },
  ],
};
const response = (content, extras = {}) =>
  globalThis.Response.json({
    id: globalThis.crypto.randomUUID(),
    choices: [
      {
        finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify(content) },
      },
    ],
    usage: { cost: 0.001, prompt_tokens: 100, completion_tokens: 50 },
    ...extras,
  });

describe("OpenRouter generation", () => {
  it("preserves complete text and uses exactly the requested model, schema and card types", () => {
    const text = "Full source αβ\n".repeat(50000);
    const payload = buildGenerationPayload({
      document: { ...document, text },
      job,
    });
    expect(payload.model).toBe(DEFAULT_GENERATION_MODEL);
    expect(payload.provider).toEqual({ require_parameters: true });
    expect(payload.reasoning).toEqual({ effort: "xhigh", exclude: true });
    expect(payload.max_tokens).toBe(128000);
    expect(payload.messages[1].content[1].text).toBe(
      `Complete source:\n\n${text}`,
    );
    expect(
      payload.response_format.json_schema.schema.properties.cards.items.anyOf,
    ).toHaveLength(1);
    expect(payload).not.toHaveProperty("plugins");
    expect(payload).not.toHaveProperty("tools");
    expect(payload).not.toHaveProperty("models");
  });

  it("uses the selected model's completion limit and omits reasoning for a non-reasoning model", () => {
    const plainJob = {
      ...job,
      model: "fixture/plain-text",
      reasoningEffort: "",
      modelSnapshot: { maxCompletionTokens: 8000, reasoning: false },
    };
    const payload = buildGenerationPayload({
      document,
      job: { ...plainJob, questionCount: 25 },
    });
    expect(payload.model).toBe("fixture/plain-text");
    expect(payload.max_tokens).toBe(8000);
    expect(payload).not.toHaveProperty("reasoning");
    const disabled = buildGenerationPayload({
      document,
      job: { ...job, reasoningEffort: "none" },
    });
    expect(disabled.reasoning).toEqual({ effort: "none", exclude: true });
    expect(disabled.max_tokens).toBe(128000);
  });

  it("does not impose a count-based cap or invent a missing provider limit", () => {
    for (const questionCount of [1, 25, 10000]) {
      const payload = buildGenerationPayload({
        document,
        job: { ...job, questionCount },
      });
      expect(payload.max_tokens).toBe(128000);
    }
    const unknownLimit = buildGenerationPayload({
      document,
      job: { ...job, modelSnapshot: { reasoning: true } },
    });
    expect(unknownLimit).not.toHaveProperty("max_tokens");
  });

  it("records hidden reasoning and identifies the request limit without blaming the model capacity", async () => {
    const onUsage = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(
      response(null, {
        provider: "Fixture provider",
        choices: [
          {
            finish_reason: "length",
            native_finish_reason: "max_tokens",
            message: { content: "" },
          },
        ],
        usage: {
          cost: 0.02,
          prompt_tokens: 44000,
          completion_tokens: 32768,
          completion_tokens_details: { reasoning_tokens: 32768 },
        },
      }),
    );
    await expect(
      generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl,
        onUsage,
      }),
    ).rejects.toThrow(
      "Generation stopped at an output limit after using 32,768 tokens for reasoning, before returning any cards. The request allowed up to 128,000 output tokens, including reasoning.",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        outputTokens: 32768,
        reasoningTokens: 32768,
        visibleOutputTokens: 0,
        requestedMaxOutputTokens: 128000,
        finishReason: "length",
        nativeFinishReason: "max_tokens",
        provider: "Fixture provider",
      }),
    );
  });

  it("keeps missing reasoning usage unknown instead of reporting zero reasoning", async () => {
    const onUsage = vi.fn();
    await generateWithOpenRouter({
      document,
      job,
      apiKey: "test-only",
      fetchImpl: vi.fn().mockResolvedValue(response(set)),
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        outputTokens: 50,
        reasoningTokens: null,
        visibleOutputTokens: null,
      }),
    );
  });

  it("pins raw PDFs to Cloudflare text parsing with no native or OCR fallback", () => {
    const fileData = "data:application/pdf;base64,whole-document";
    const payload = buildGenerationPayload({
      document: { source: document.source, fileData },
      job,
    });
    expect(payload.plugins).toEqual([
      { id: "file-parser", pdf: { engine: "cloudflare-ai" } },
    ]);
    expect(payload.messages[1].content[1].file.file_data).toBe(fileData);
  });

  it("allows one concrete schema repair retaining full source and accounts for both calls", async () => {
    const reasoningDetails = [
      {
        type: "reasoning.encrypted",
        data: "opaque-signature",
        id: "reasoning-one",
        format: "anthropic-claude-v1",
        index: 0,
      },
    ];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response(null, {
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({ ...set, cards: [] }),
                reasoning_details: reasoningDetails,
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response(set));
    const onUsage = vi.fn();
    expect(
      await generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl,
        onUsage,
      }),
    ).toEqual(set);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // The host/provider owns runtime limits; the app adds no shorter deadline.
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("signal");
    expect(fetchImpl.mock.calls[1][1]).not.toHaveProperty("signal");
    expect(onUsage).toHaveBeenCalledTimes(2);
    const repair = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(repair.messages[1].content[1].text).toBe(
      `Complete source:\n\n${document.text}`,
    );
    expect(repair.messages.at(-1).content).toMatch(
      /at least one card|exactly 1 card/i,
    );
    expect(repair.model).toBe(DEFAULT_GENERATION_MODEL);
    expect(repair.reasoning).toEqual({ effort: "xhigh", exclude: true });
    expect(repair.messages.at(-2).reasoning_details).toEqual(reasoningDetails);
  });

  it("does not retry provider failures or truncate and accept incomplete output", async () => {
    const rejected = vi
      .fn()
      .mockResolvedValue(
        globalThis.Response.json(
          { error: { message: "Model unavailable" } },
          { status: 400 },
        ),
      );
    await expect(
      generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl: rejected,
      }),
    ).rejects.toThrow("Model unavailable");
    expect(rejected).toHaveBeenCalledTimes(1);
    const truncated = vi.fn().mockResolvedValue(
      response(set, {
        choices: [
          {
            finish_reason: "length",
            message: { content: JSON.stringify(set) },
          },
        ],
      }),
    );
    await expect(
      generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl: truncated,
      }),
    ).rejects.toThrow(/output limit/);
    expect(truncated).toHaveBeenCalledTimes(1);
  });

  it.each(["headers", "body"])(
    "reports provider %s timeouts without calling them unreadable output",
    async (stage) => {
      const error = Object.assign(new TypeError("terminated"), {
        cause: {
          code:
            stage === "body"
              ? "UND_ERR_BODY_TIMEOUT"
              : "UND_ERR_HEADERS_TIMEOUT",
        },
      });
      const fetchImpl =
        stage === "body"
          ? vi.fn().mockResolvedValue({
              json: async () => {
                throw error;
              },
            })
          : vi.fn().mockRejectedValue(error);
      await expect(
        generateWithOpenRouter({
          document,
          job,
          apiKey: "test-only",
          fetchImpl,
        }),
      ).rejects.toMatchObject({
        status: 504,
        message: expect.stringContaining("provider connection timed out"),
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("reports malformed provider JSON separately from connection failures", async () => {
    await expect(
      generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl: vi.fn().mockResolvedValue(new globalThis.Response("{incomplete")),
      }),
    ).rejects.toThrow("OpenRouter returned an unreadable response.");
  });

  it("distinguishes the provider's context-window stop from an output-token limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response(null, {
        choices: [
          {
            finish_reason: "length",
            native_finish_reason: "model_context_window_exceeded",
            message: { content: "" },
          },
        ],
      }),
    );
    await expect(
      generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl,
      }),
    ).rejects.toThrow(
      "The complete source and response exceeded this model's context window.",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("records incurred usage even when parser annotation validation rejects the document", async () => {
    const onUsage = vi.fn();
    await expect(
      generateWithOpenRouter({
        document,
        job,
        apiKey: "test-only",
        fetchImpl: vi.fn().mockResolvedValue(response(set)),
        onUsage,
        onParsed: async () => {
          throw new Error("No readable text");
        },
      }),
    ).rejects.toThrow("No readable text");
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ cost: 0.001 }),
    );
  });
});
