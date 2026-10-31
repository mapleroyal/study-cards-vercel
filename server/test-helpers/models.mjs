import { createModelCatalog, DEFAULT_MODEL } from "../models.mjs";

// The relevant public OpenRouter fields, with a small contrasting model for tests.
export const modelFixtures = [
  {
    id: DEFAULT_MODEL,
    name: "Anthropic: Claude Haiku 5.5",
    context_length: 1000000,
    architecture: {
      input_modalities: ["text", "image", "file"],
      output_modalities: ["text"],
    },
    top_provider: { max_completion_tokens: 128000 },
    supported_parameters: [
      "response_format",
      "structured_outputs",
      "reasoning",
      "reasoning_effort",
      "max_tokens",
    ],
    reasoning: {
      mandatory: false,
      supported_efforts: ["max", "xhigh", "high", "medium", "low", "none"],
      default_effort: "medium",
    },
  },
  {
    id: "fixture/plain-text",
    name: "Fixture: Plain Text",
    context_length: 32000,
    architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    top_provider: { max_completion_tokens: 8000 },
    supported_parameters: [
      "response_format",
      "structured_outputs",
      "max_tokens",
    ],
  },
];
export function createTestModelCatalog() {
  return createModelCatalog({
    fetchImpl: async () => globalThis.Response.json({ data: modelFixtures }),
  });
}
