import { z } from "zod";
import { sealSecret, unsealSecret } from "./auth.mjs";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  resolveModelSelection,
} from "./models.mjs";

const inputSchema = z
  .object({
    model: z.string().trim().min(1).optional(),
    reasoningEffort: z.string().trim().optional(),
    openRouterKey: z.string().optional(),
  })
  .strict();

export function createOwnerSettings({
  store,
  models,
  env = process.env,
  seal = sealSecret,
  unseal = unsealSecret,
}) {
  const defaultModel = env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const defaultEffort =
    env.OPENROUTER_REASONING_EFFORT ??
    (defaultModel === DEFAULT_MODEL ? DEFAULT_REASONING_EFFORT : "");
  function selectionFrom(record) {
    const model = record?.model || defaultModel;
    return {
      model,
      reasoningEffort:
        record?.reasoningEffort ??
        (model === defaultModel ? defaultEffort : ""),
    };
  }
  async function getSelection() {
    return selectionFrom(await store.getRecord("settings", "owner"));
  }
  const hasKeyPreference = (record) =>
    record !== null &&
    record !== undefined &&
    Object.hasOwn(record, "openRouterKey");
  async function getApiKey() {
    const record = await store.getRecord("settings", "owner");
    // Explicit removal stays disconnected even when a deployment fallback exists.
    if (hasKeyPreference(record)) {
      return record.openRouterKey ? unseal(record.openRouterKey) : null;
    }
    return env.OPENROUTER_API_KEY || null;
  }
  async function read() {
    const record = await store.getRecord("settings", "owner");
    return {
      ...selectionFrom(record),
      openRouterConfigured: Boolean(
        hasKeyPreference(record)
          ? record.openRouterKey
          : env.OPENROUTER_API_KEY,
      ),
    };
  }
  async function update(rawInput) {
    const input = inputSchema.parse(rawInput);
    const changesSelection =
      input.model !== undefined || input.reasoningEffort !== undefined;
    const catalog = changesSelection ? (await models.list()).models : null;
    let encryptedKey;
    if (input.openRouterKey !== undefined) {
      const key = input.openRouterKey.trim();
      if (key && !key.startsWith("sk-or-")) {
        throw Object.assign(new Error("Enter a valid OpenRouter key."), {
          status: 422,
        });
      }
      encryptedKey = key ? await seal(key) : null;
    }
    await store.updateRecord("settings", "owner", (record) => {
      const next = { ...record };
      if (changesSelection) {
        const current = selectionFrom(record);
        const model = input.model ?? current.model;
        const effort =
          input.reasoningEffort ??
          (model === current.model ? current.reasoningEffort : undefined);
        const selected = resolveModelSelection(catalog, {
          model,
          reasoningEffort: effort,
        });
        next.model = selected.model;
        next.reasoningEffort = selected.reasoningEffort;
      }
      if (input.openRouterKey !== undefined) {
        next.openRouterKey = encryptedKey;
      }
      return next;
    });
    return read();
  }
  return { read, update, getSelection, getApiKey };
}
