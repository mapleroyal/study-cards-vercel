export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
export const DEFAULT_REASONING_EFFORT = "xhigh";
export const DEFAULT_SELECTION = {
  model: DEFAULT_MODEL,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
};
const efforts = ["max", "xhigh", "high", "medium", "low", "minimal", "none"];
const problem = (message, status = 422) =>
  Object.assign(new Error(message), { status });

export function summarizeModel(model) {
  const parameters = model.supported_parameters || [];
  if (
    typeof model.id !== "string" ||
    !model.architecture?.input_modalities?.includes("text") ||
    !model.architecture?.output_modalities?.includes("text") ||
    !parameters.includes("response_format") ||
    !parameters.includes("structured_outputs") ||
    (Array.isArray(model.endpoints) &&
      !model.endpoints.includes("/api/v1/chat/completions"))
  ) {
    return null;
  }
  const available = model.reasoning?.supported_efforts;
  const variants = (
    available === null ? efforts : Array.isArray(available) ? available : []
  ).filter(
    (effort) =>
      efforts.includes(effort) &&
      !(model.reasoning?.mandatory && effort === "none"),
  );
  const preferred =
    model.id === DEFAULT_MODEL
      ? DEFAULT_REASONING_EFFORT
      : model.reasoning?.default_effort;
  return {
    id: model.id,
    name: model.name || model.id,
    variants,
    defaultVariant: variants.includes(preferred) ? preferred : null,
    reasoning: Boolean(model.reasoning),
    contextLength:
      Number.isSafeInteger(model.context_length) && model.context_length > 0
        ? model.context_length
        : null,
    maxCompletionTokens:
      Number.isSafeInteger(model.top_provider?.max_completion_tokens) &&
      model.top_provider.max_completion_tokens > 0
        ? model.top_provider.max_completion_tokens
        : null,
  };
}

export function resolveModelSelection(models, { model, reasoningEffort }) {
  const selected = models.find((item) => item.id === model);
  if (!selected) {
    throw problem(
      "This model is unavailable for card generation. Choose another model.",
    );
  }
  const effort = reasoningEffort ?? selected.defaultVariant ?? "";
  if (effort && !selected.variants.includes(effort)) {
    throw problem(
      "This reasoning effort is unavailable for the selected model.",
    );
  }
  return {
    model: selected.id,
    reasoningEffort: effort,
    modelSnapshot: {
      name: selected.name,
      contextLength: selected.contextLength,
      maxCompletionTokens: selected.maxCompletionTokens,
      reasoning: selected.reasoning,
    },
  };
}

export function createModelCatalog({
  fetchImpl = fetch,
  now = Date.now,
  ttl = 10 * 60 * 1000,
} = {}) {
  let cached;
  let cachedAt = 0;
  let pending;
  async function list() {
    if (cached && now() - cachedAt < ttl) {
      return { models: cached, defaultSelection: DEFAULT_SELECTION };
    }
    pending ??= (async () => {
      const response = await fetchImpl("https://openrouter.ai/api/v1/models", {
        signal: globalThis.AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw problem("Models could not be loaded. Try again.", 503);
      }
      const result = await response.json();
      if (!Array.isArray(result.data)) {
        throw problem("Models could not be loaded. Try again.", 503);
      }
      const models = result.data
        .filter(
          (model) =>
            !model.expiration_date || Date.parse(model.expiration_date) > now(),
        )
        .map(summarizeModel)
        .filter(Boolean)
        .sort(
          (a, b) =>
            Number(b.id === DEFAULT_MODEL) - Number(a.id === DEFAULT_MODEL) ||
            a.name.localeCompare(b.name),
        );
      if (!models.length) {
        throw problem(
          "No models supporting structured cards are available.",
          503,
        );
      }
      cached = models;
      cachedAt = now();
      return models;
    })()
      .catch((error) => {
        if (error.status === 503) {
          throw error;
        }
        throw problem("Models could not be loaded. Try again.", 503);
      })
      .finally(() => {
        pending = undefined;
      });
    return { models: await pending, defaultSelection: DEFAULT_SELECTION };
  }
  async function resolve(selection) {
    return resolveModelSelection((await list()).models, selection);
  }
  return { list, resolve };
}
