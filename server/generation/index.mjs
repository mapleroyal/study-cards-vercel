import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  supportedCardTypes,
  validateGeneratedStudySet,
} from "../../shared/study-set-validation.js";
import { generateWithOpenRouter } from "./openrouter.mjs";

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
    reasoningEffort: z.string().trim().optional(),
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
  models,
  getSelection,
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
    options.cardTypes = [...new Set(options.cardTypes)];
    const { mutationId, ...settings } = options;
    const id = mutationId || randomUUID();
    const existing = mutationId ? await store.getRecord("jobs", id) : null;
    const hashSettings = (value) =>
      createHash("sha256")
        .update(
          JSON.stringify({
            sourceId: value.sourceId,
            questionCount: value.questionCount,
            cardTypes: value.cardTypes,
            model: value.model,
            reasoningEffort: value.reasoningEffort,
            category: value.category,
          }),
        )
        .digest("hex");
    let job;
    if (existing) {
      // A lost response must remain retryable after preferences, credentials or
      // the public catalog change. Compare against the original job's choices.
      settings.model ??= existing.model;
      settings.reasoningEffort ??=
        settings.model === existing.model
          ? existing.reasoningEffort
          : undefined;
      if (hashSettings(existing) !== hashSettings(settings)) {
        throw problem(
          "This generation request was already used with different settings.",
          409,
        );
      }
      job = existing;
    } else {
      const remembered = await getSelection();
      const requestedModel = settings.model ?? remembered.model;
      const selected = await models.resolve({
        model: requestedModel,
        reasoningEffort:
          settings.reasoningEffort ??
          (requestedModel === remembered.model
            ? remembered.reasoningEffort
            : undefined),
      });
      settings.model = selected.model;
      settings.reasoningEffort = selected.reasoningEffort;
      const requestHash = hashSettings(settings);
      const source = await sources.inspect(settings.sourceId);
      if (source.status === "uploading") {
        throw problem("Wait for the document upload to finish.", 409);
      }
      if (!(await getApiKey())) {
        throw problem("Connect an OpenRouter key in Settings.", 409);
      }
      job = await store.updateRecord("jobs", id, (current) => {
        if (current) {
          if (hashSettings(current) !== requestHash) {
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
          modelSnapshot: selected.modelSnapshot,
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
    }
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
        if (job?.status === "canceled") {
          job = await dispatchCancellation(job);
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
  async function dispatchCancellation(job) {
    if (!job.runId) {
      return job;
    }
    let cancellationError = null;
    try {
      await cancelWorkflow(job.runId);
    } catch {
      cancellationError =
        "Stopping the provider request could not be confirmed. Try canceling again.";
    }
    return store.updateRecord("jobs", job.id, (current) =>
      current?.status === "canceled" && current.runId === job.runId
        ? { ...current, cancellationError, updatedAt: now() }
        : undefined,
    );
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
    return publicJob(
      job.status === "canceled" ? await dispatchCancellation(job) : job,
    );
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
  async function runPrepareAndGenerate(id, runId, signal) {
    const original = await inspect(id);
    if (terminal.has(original.status) || original.generatedSet) {
      return publicJob(original);
    }
    try {
      signal?.throwIfAborted();
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
      const job = await transition(id, "generating", { totalCost: null });
      const generatedSet = await generateWithOpenRouter({
        document,
        job,
        apiKey: await getApiKey(),
        fetchImpl,
        signal,
        assertActive: async () => {
          signal?.throwIfAborted();
          return assertActive(id);
        },
        onParsed: (annotations) =>
          sources.rememberParsed(job.sourceId, annotations),
        onUsage: (usage) =>
          store.updateRecord("jobs", id, (current) => {
            if (!current) {
              return undefined;
            }
            const index = usage.generationId
              ? current.usage.findIndex(
                  (item) => item.generationId === usage.generationId,
                )
              : -1;
            const known = index < 0 ? {} : current.usage[index];
            const updated = { ...known, ...usage };
            // A first stream frame identifies the request before accounting is
            // available. Repeated/partial frames must not erase known usage.
            for (const [key, value] of Object.entries(known)) {
              if (
                (updated[key] === null || updated[key] === undefined) &&
                value !== null &&
                value !== undefined
              ) {
                updated[key] = value;
              }
            }
            if (known.usageComplete) {
              updated.usageComplete = true;
            }
            const usages = [...current.usage];
            if (index < 0) {
              usages.push(updated);
            } else {
              usages[index] = updated;
            }
            return {
              ...current,
              usage: usages,
              totalCost: usages.some((item) => !Number.isFinite(item.cost))
                ? null
                : usages.reduce((sum, item) => sum + item.cost, 0),
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
  // Job snapshots are audit history. Browser links and display names follow the
  // current canonical set, including deletion and Undo, without rewriting jobs.
  function clientJob(job, currentResult) {
    return {
      ...publicJob(job),
      resultRecord:
        currentResult?.id && currentResult.id === job.resultRecord?.id
          ? currentResult
          : null,
    };
  }
  async function readClientJob(job) {
    const currentResult = job.resultRecord?.id
      ? await store.getStudySet(job.resultRecord.id)
      : null;
    return clientJob(job, currentResult);
  }
  const router = Router();
  router.get("/jobs", async (_req, res) => {
    const [jobs, records] = await Promise.all([
      store.listRecords("jobs"),
      store.listStudySets(),
    ]);
    const recordsById = new Map(records.map((record) => [record.id, record]));
    res.json({
      jobs: jobs
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((job) => clientJob(job, recordsById.get(job.resultRecord?.id))),
    });
  });
  router.post("/jobs", async (req, res) =>
    res.status(202).json({ job: await readClientJob(await create(req.body)) }),
  );
  router.get("/jobs/:id", async (req, res) =>
    res.json({ job: await readClientJob(await inspect(req.params.id)) }),
  );
  router.post("/jobs/:id/cancel", async (req, res) =>
    res.json({ job: await readClientJob(await cancel(req.params.id)) }),
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
