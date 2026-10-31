import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  supportedCardTypes,
  validateGeneratedStudySet,
} from "../../shared/study-set-validation.js";
import {
  DEFAULT_GENERATION_MODEL,
  generateWithOpenRouter,
} from "./openrouter.mjs";

const terminal = new Set(["completed", "failed", "canceled"]);
const now = () => new Date().toISOString();
const problem = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const inputSchema = z
  .object({
    sourceId: z.string().uuid(),
    questionCount: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .default(25),
    cardTypes: z.array(z.enum(supportedCardTypes)).min(1),
    model: z.string().trim().min(1).optional(),
    category: z.string().trim().optional(),
    mutationId: z.string().uuid().optional(),
  })
  .strict();
export function publicJob(job) {
  if (!job) {
    return null;
  }
  const summary = { ...job };
  delete summary.generatedSet;
  delete summary.requestHash;
  return summary;
}

export function createGenerationService({
  store,
  sources,
  getApiKey,
  startWorkflow,
  cancelWorkflow = async () => {},
  fetchImpl = fetch,
  defaultModel = DEFAULT_GENERATION_MODEL,
}) {
  async function inspect(id) {
    const job = await store.getRecord("jobs", id);
    if (!job) {
      throw problem("Generation not found.", 404);
    }
    return job;
  }
  async function assertActive(id) {
    const job = await inspect(id);
    if (terminal.has(job.status)) {
      throw Object.assign(problem("Generation is no longer active.", 409), {
        code: "GENERATION_INACTIVE",
      });
    }
    await sources.inspect(job.sourceId);
    return job;
  }
  async function transition(id, status, fields = {}, expectedRunId) {
    return store.updateRecord("jobs", id, (job) => {
      if (
        !job ||
        terminal.has(job.status) ||
        (expectedRunId && job.runId && job.runId !== expectedRunId)
      ) {
        return undefined;
      }
      return { ...job, ...fields, status, updatedAt: now() };
    });
  }
  async function create(input) {
    const options = inputSchema.parse(input);
    if (options.model && options.model !== defaultModel) {
      throw problem("The model is configured by this deployment.");
    }
    options.model = defaultModel;
    options.cardTypes = [...new Set(options.cardTypes)];
    const { mutationId, ...settings } = options;
    const id = mutationId || randomUUID();
    const requestHash = createHash("sha256")
      .update(JSON.stringify(settings))
      .digest("hex");
    const source = await sources.inspect(settings.sourceId);
    if (source.status === "uploading") {
      throw problem("Wait for the document upload to finish.", 409);
    }
    if (!(await getApiKey())) {
      throw problem("Connect an OpenRouter key in Settings.", 409);
    }
    let job = await store.updateRecord("jobs", id, (current) => {
      if (current) {
        if (current.requestHash !== requestHash) {
          throw problem(
            "This generation request was already used with different settings.",
            409,
          );
        }
        return undefined;
      }
      return {
        id,
        ...settings,
        sourceName: source.name,
        requestHash,
        status: "queued",
        createdAt: now(),
        updatedAt: now(),
        error: null,
        resultRecord: null,
        usage: [],
        totalCost: 0,
      };
    });
    if (job.status === "queued" && !job.runId) {
      try {
        const run = await startWorkflow(id);
        job = await store.updateRecord("jobs", id, (current) =>
          current
            ? {
                ...current,
                runId:
                  current.runId || (typeof run === "string" ? run : run.runId),
                updatedAt: now(),
              }
            : undefined,
        );
        if (job?.status === "canceled" && job.runId) {
          await cancelWorkflow(job.runId).catch(() => undefined);
        }
      } catch (error) {
        const current = await inspect(id);
        if (current.runId) {
          return publicJob(current);
        }
        await fail(id, error);
        throw error;
      }
    }
    return publicJob(job);
  }
  async function cancel(id) {
    await inspect(id);
    const job = await store.updateRecord("jobs", id, (current) =>
      current && !terminal.has(current.status)
        ? {
            ...current,
            status: "canceled",
            completedAt: now(),
            updatedAt: now(),
          }
        : undefined,
    );
    if (job.status === "canceled" && job.runId) {
      await cancelWorkflow(job.runId).catch(() => undefined);
    }
    return publicJob(job);
  }
  async function fail(id, error, runId) {
    return publicJob(
      await transition(
        id,
        "failed",
        {
          error: error?.message || "Generation could not be completed.",
          completedAt: now(),
        },
        runId,
      ),
    );
  }
  async function runPrepareAndGenerate(id, runId) {
    const original = await inspect(id);
    if (terminal.has(original.status) || original.generatedSet) {
      return publicJob(original);
    }
    try {
      await assertActive(id);
      let claimed = false;
      const claimedJob = await store.updateRecord("jobs", id, (current) => {
        if (!current || current.status !== "queued") {
          return undefined;
        }
        claimed = true;
        return {
          ...current,
          status: "preparing",
          ...(runId ? { runId } : {}),
          updatedAt: now(),
        };
      });
      if (!claimed) {
        return publicJob(claimedJob);
      }
      const document = await sources.document(original.sourceId);
      await assertActive(id);
      const job = await transition(id, "generating");
      const generatedSet = await generateWithOpenRouter({
        document,
        job,
        apiKey: await getApiKey(),
        fetchImpl,
        assertActive: () => assertActive(id),
        onParsed: (annotations) =>
          sources.rememberParsed(job.sourceId, annotations),
        onUsage: (usage) =>
          store.updateRecord("jobs", id, (current) => {
            if (!current) {
              return undefined;
            }
            const duplicate =
              usage.generationId &&
              current.usage.some(
                (item) => item.generationId === usage.generationId,
              );
            return duplicate
              ? undefined
              : {
                  ...current,
                  usage: [...current.usage, usage],
                  totalCost: current.totalCost + usage.cost,
                  updatedAt: now(),
                };
          }),
      });
      await assertActive(id);
      return publicJob(await transition(id, "saving", { generatedSet }));
    } catch (error) {
      if (error.code !== "GENERATION_INACTIVE") {
        await fail(id, error, runId);
      }
      return publicJob(await inspect(id));
    }
  }
  async function runSave(id) {
    const job = await inspect(id);
    if (terminal.has(job.status)) {
      return publicJob(job);
    }
    if (!job.generatedSet) {
      throw problem("Generated cards are not ready to save.", 409);
    }
    await assertActive(id);
    const set = validateGeneratedStudySet(job.generatedSet, {
      cardCount: job.questionCount,
      allowedCardTypes: job.cardTypes,
    });
    await store.createStudySet(set, {
      mutationId: job.id,
      source: { id: job.sourceId, name: job.sourceName },
      generationJobId: id,
    });
    return publicJob(await inspect(id));
  }
  const router = Router();
  router.get("/jobs", async (_req, res) =>
    res.json({
      jobs: (await store.listRecords("jobs"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(publicJob),
    }),
  );
  router.post("/jobs", async (req, res) =>
    res.status(202).json({ job: await create(req.body) }),
  );
  router.get("/jobs/:id", async (req, res) =>
    res.json({ job: publicJob(await inspect(req.params.id)) }),
  );
  router.post("/jobs/:id/cancel", async (req, res) =>
    res.json({ job: await cancel(req.params.id) }),
  );
  return {
    router,
    create,
    cancel,
    fail,
    inspect,
    runPrepareAndGenerate,
    runSave,
  };
}
