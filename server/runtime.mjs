import { createStudyStore } from "./store/index.mjs";
import { createSourceService } from "./sources.mjs";
import { createGenerationService } from "./generation/index.mjs";
import {
  startGenerationWorkflow,
  cancelGenerationWorkflow,
} from "./generation/workflow-control.mjs";
import { createModelCatalog } from "./models.mjs";
import { createOwnerSettings } from "./settings.mjs";
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
    const models = createModelCatalog();
    const settings = createOwnerSettings({ store, models });
    const { getApiKey, getSelection } = settings;
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
      models,
      getSelection,
    });
    return {
      store,
      sources,
      generation,
      settings,
      models,
      getApiKey,
      loginLimiter,
    };
  } catch (error) {
    await store.close().catch(() => {});
    throw error;
  }
}
