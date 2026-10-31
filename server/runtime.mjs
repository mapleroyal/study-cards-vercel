import { createStudyStore } from "./store/index.mjs";
import { createSourceService } from "./sources.mjs";
import { createGenerationService } from "./generation/index.mjs";
import {
  startGenerationWorkflow,
  cancelGenerationWorkflow,
} from "./generation/workflow-control.mjs";
import { sealSecret, unsealSecret } from "./auth.mjs";
import { createLoginLimiter } from "./login-rate-limit.mjs";

let runtimePromise;
export function getRuntime() {
  runtimePromise ??= createRuntime().catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}
async function createRuntime() {
  const store = createStudyStore({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await store.initialize();
    const loginLimiter = await createLoginLimiter(store.pool);
    const getApiKey = async () => {
      const settings = await store.getRecord("settings", "owner");
      return settings?.openRouterKey
        ? await unsealSecret(settings.openRouterKey)
        : process.env.OPENROUTER_API_KEY || null;
    };
    const model = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-5.5";
    const settings = {
      async read() {
        return { openRouterConfigured: Boolean(await getApiKey()), model };
      },
      async update(input) {
        if (input.model !== undefined && input.model !== model) {
          throw Object.assign(
            new Error("The model is configured by this deployment."),
            { status: 400 },
          );
        }
        if (input.openRouterKey !== undefined) {
          if (typeof input.openRouterKey !== "string") {
            throw Object.assign(new Error("Enter a valid OpenRouter key."), {
              status: 400,
            });
          }
          const key = input.openRouterKey.trim();
          if (key && !key.startsWith("sk-or-")) {
            throw Object.assign(new Error("Enter a valid OpenRouter key."), {
              status: 400,
            });
          }
          await store.putRecord("settings", "owner", {
            openRouterKey: key ? await sealSecret(key) : null,
          });
        }
        return settings.read();
      },
    };
    const sources = createSourceService({
      store,
      cancelRun: cancelGenerationWorkflow,
    });
    const generation = createGenerationService({
      store,
      sources,
      getApiKey,
      startWorkflow: startGenerationWorkflow,
      cancelWorkflow: cancelGenerationWorkflow,
      defaultModel: model,
    });
    return { store, sources, generation, settings, getApiKey, loginLimiter };
  } catch (error) {
    await store.close().catch(() => {});
    throw error;
  }
}
