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
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ ...set, cards: [] }))
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
    expect(fetchImpl.mock.calls[0][1].signal).toBe(
      fetchImpl.mock.calls[1][1].signal,
    );
    expect(onUsage).toHaveBeenCalledTimes(2);
    const repair = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(repair.messages[1].content[1].text).toBe(
      `Complete source:\n\n${document.text}`,
    );
    expect(repair.messages.at(-1).content).toMatch(
      /at least one card|exactly 1 card/i,
    );
    expect(repair.model).toBe(DEFAULT_GENERATION_MODEL);
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
