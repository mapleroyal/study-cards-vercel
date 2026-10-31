import { describe, expect, it, vi } from "vitest";
import {
  createModelCatalog,
  DEFAULT_SELECTION,
  resolveModelSelection,
  summarizeModel,
} from "./models.mjs";
import { modelFixtures } from "./test-helpers/models.mjs";

describe("OpenRouter model catalog", () => {
  it("uses advertised reasoning efforts and retains the exact requested Sonnet xhigh default", () => {
    const sonnet = summarizeModel(modelFixtures[0]);
    expect(sonnet).toMatchObject({
      id: DEFAULT_SELECTION.model,
      variants: ["max", "xhigh", "high", "medium", "low"],
      defaultVariant: "xhigh",
      reasoning: true,
      contextLength: 1000000,
      maxCompletionTokens: 128000,
    });
    expect(resolveModelSelection([sonnet], DEFAULT_SELECTION)).toMatchObject(
      DEFAULT_SELECTION,
    );
    expect(() =>
      resolveModelSelection([sonnet], {
        ...DEFAULT_SELECTION,
        reasoningEffort: "none",
      }),
    ).toThrow(/reasoning effort/);
    expect(() =>
      resolveModelSelection([sonnet], { model: "unavailable" }),
    ).toThrow(/unavailable/);
  });

  it("handles unrestricted, mandatory, absent and explicitly empty effort metadata without inventing unsupported options", () => {
    const base = modelFixtures[1];
    expect(summarizeModel(base)).toMatchObject({
      variants: [],
      defaultVariant: null,
      reasoning: false,
    });
    const unrestricted = summarizeModel({
      ...base,
      reasoning: {
        supported_efforts: null,
        mandatory: false,
        default_effort: "medium",
      },
    });
    expect(unrestricted.variants).toContain("none");
    expect(unrestricted.defaultVariant).toBe("medium");
    expect(
      summarizeModel({
        ...base,
        reasoning: { supported_efforts: null, mandatory: true },
      }).variants,
    ).not.toContain("none");
    expect(
      summarizeModel({ ...base, reasoning: { mandatory: true } }).variants,
    ).toEqual([]);
    expect(
      summarizeModel({
        ...base,
        reasoning: { supported_efforts: [], default_effort: "high" },
      }).defaultVariant,
    ).toBeNull();
    expect(
      resolveModelSelection([unrestricted], {
        model: base.id,
        reasoningEffort: "",
      }).reasoningEffort,
    ).toBe("");
  });

  it("filters incompatible or expired models, coalesces requests and refreshes after the cache expires", async () => {
    let currentTime = Date.parse("2026-10-31T12:00:00Z");
    const fetchImpl = vi.fn(async () =>
      globalThis.Response.json({
        data: [
          ...modelFixtures,
          { ...modelFixtures[0], id: "expired", expiration_date: "2026-10-30" },
          {
            ...modelFixtures[1],
            id: "no-schema",
            supported_parameters: ["response_format"],
          },
          {
            ...modelFixtures[1],
            id: "image-only",
            architecture: {
              input_modalities: ["image"],
              output_modalities: ["text"],
            },
          },
          {
            ...modelFixtures[1],
            id: "response-only",
            endpoints: ["/api/v1/responses"],
          },
        ],
      }),
    );
    const catalog = createModelCatalog({
      fetchImpl,
      now: () => currentTime,
      ttl: 1000,
    });
    const [first, simultaneous] = await Promise.all([
      catalog.list(),
      catalog.list(),
    ]);
    expect(first).toEqual(simultaneous);
    expect(first.models.map((model) => model.id)).toEqual(
      modelFixtures.map((model) => model.id),
    );
    expect(first.defaultSelection).toEqual(DEFAULT_SELECTION);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.headers).toBeUndefined();
    await catalog.list();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    currentTime += 1001;
    await catalog.list();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable catalog data without fabricating a fallback and permits a later retry", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(globalThis.Response.json({ data: modelFixtures }));
    const catalog = createModelCatalog({ fetchImpl });
    await expect(catalog.list()).rejects.toMatchObject({
      status: 503,
      message: "Models could not be loaded. Try again.",
    });
    expect((await catalog.list()).models).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
