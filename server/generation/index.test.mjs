import express from "express";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGenerationService } from "./index.mjs";
import { createSourceService } from "../sources.mjs";
import { createTestStore } from "../test-helpers/store.mjs";
import { createTestBlob } from "../test-helpers/blob.mjs";
import { createTestModelCatalog } from "../test-helpers/models.mjs";
import { DEFAULT_SELECTION } from "../models.mjs";

const stores = [];
const servers = [];
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
function response() {
  return globalThis.Response.json({
    id: "generation-one",
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(set) } },
    ],
    usage: { cost: 0.001, prompt_tokens: 100, completion_tokens: 50 },
  });
}
async function setup(overrides = {}) {
  const store = createTestStore();
  stores.push(store);
  const sources = createSourceService({ store, blob: createTestBlob() });
  const source = await sources.addText({
    text: "Ailerons control roll.",
    name: "Aircraft",
  });
  const startWorkflow = vi.fn(async (id) => ({ runId: `run-${id}` }));
  const cancelWorkflow = vi.fn(async () => {});
  const fetchImpl = vi.fn(async () => response());
  const generation = createGenerationService({
    store,
    sources,
    getApiKey: async () => "test-only",
    startWorkflow,
    cancelWorkflow,
    fetchImpl,
    models: createTestModelCatalog(),
    getSelection: async () => DEFAULT_SELECTION,
    ...overrides,
  });
  return {
    store,
    sources,
    source,
    generation,
    startWorkflow,
    cancelWorkflow,
    fetchImpl,
    input: {
      sourceId: source.id,
      questionCount: 1,
      cardTypes: ["short_answer"],
      mutationId: randomUUID(),
    },
  };
}
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
  await Promise.all(stores.splice(0).map((store) => store.close()));
});
async function requestJobs(generation) {
  const app = express();
  app.use(express.json());
  app.use(generation.router);
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  return async (path = "/jobs", body) => {
    const httpResponse = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    expect(httpResponse.ok).toBe(true);
    return httpResponse.json();
  };
}

describe("durable generation jobs", () => {
  it("snapshots the remembered model and effort so later setting changes cannot alter queued generation", async () => {
    let selection = { ...DEFAULT_SELECTION };
    const { generation, input, fetchImpl } = await setup({
      getSelection: async () => selection,
    });
    const job = await generation.create(input);
    expect(job).toMatchObject({
      ...DEFAULT_SELECTION,
      modelSnapshot: { maxCompletionTokens: 128000, reasoning: true },
    });
    selection = { model: "fixture/plain-text", reasoningEffort: "" };
    await generation.runPrepareAndGenerate(job.id);
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.model).toBe(DEFAULT_SELECTION.model);
    expect(payload.reasoning).toEqual({ effort: "xhigh", exclude: true });
    const next = await generation.create({
      ...input,
      mutationId: randomUUID(),
    });
    expect(next).toMatchObject({
      ...selection,
      modelSnapshot: { maxCompletionTokens: 8000, reasoning: false },
    });
  });

  it("rejects unavailable models and unsupported efforts before queueing or spending", async () => {
    const { generation, input, store, fetchImpl, startWorkflow } =
      await setup();
    for (const selection of [
      { model: "fixture/missing" },
      { model: "fixture/plain-text", reasoningEffort: "xhigh" },
      { model: DEFAULT_SELECTION.model, reasoningEffort: "none" },
    ]) {
      await expect(
        generation.create({ ...input, ...selection }),
      ).rejects.toMatchObject({ status: 422 });
    }
    expect(await store.listRecords("jobs")).toHaveLength(0);
    expect(startWorkflow).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns the original receipt after catalog failure, changed defaults or disconnected credentials", async () => {
    const models = createTestModelCatalog();
    const getSelection = vi.fn(async () => DEFAULT_SELECTION);
    const getApiKey = vi.fn(async () => "fixture-only");
    const { generation, input, startWorkflow } = await setup({
      models,
      getSelection,
      getApiKey,
    });
    const first = await generation.create(input);
    vi.spyOn(models, "resolve").mockRejectedValue(
      new Error("Catalog unavailable"),
    );
    getSelection.mockResolvedValue({
      model: "fixture/plain-text",
      reasoningEffort: "",
    });
    getApiKey.mockResolvedValue(null);
    expect(await generation.create(input)).toEqual(first);
    expect(models.resolve).not.toHaveBeenCalled();
    expect(getSelection).toHaveBeenCalledTimes(1);
    expect(getApiKey).toHaveBeenCalledTimes(1);
    expect(startWorkflow).toHaveBeenCalledTimes(1);
    await expect(
      generation.create({ ...input, model: "fixture/plain-text" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("deduplicates retried requests and rejects conflicting reuse without imposing a 100-card cap", async () => {
    const { generation, store, input, startWorkflow } = await setup();
    const first = await generation.create({ ...input, questionCount: 101 });
    expect(first.questionCount).toBe(101);
    expect(await generation.create({ ...input, questionCount: 101 })).toEqual(
      first,
    );
    expect(startWorkflow).toHaveBeenCalledTimes(1);
    expect(await store.listRecords("jobs")).toHaveLength(1);
    await expect(
      generation.create({ ...input, questionCount: 2 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("persists generation, usage and exactly one saved set through repeated save delivery", async () => {
    const { generation, store, input, fetchImpl } = await setup();
    const job = await generation.create(input);
    const pending = await generation.runPrepareAndGenerate(job.id);
    expect(pending.status).toBe("saving");
    expect(pending).not.toHaveProperty("generatedSet");
    expect(pending.totalCost).toBe(0.001);
    const completed = await generation.runSave(job.id);
    expect(completed.status).toBe("completed");
    expect(completed.resultRecord.rawSet).toEqual(set);
    expect(await generation.runSave(job.id)).toEqual(completed);
    expect(await store.listStudySets()).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("prevents a response arriving after cancellation from saving cards and retains its usage", async () => {
    let resolveResponse;
    let entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const fetchImpl = vi.fn(() => {
      entered();
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    });
    const { generation, store, input, cancelWorkflow } = await setup({
      fetchImpl,
    });
    const job = await generation.create(input);
    const running = generation.runPrepareAndGenerate(job.id);
    await started;
    await generation.cancel(job.id);
    resolveResponse(response());
    expect((await running).status).toBe("canceled");
    const final = await generation.runSave(job.id);
    expect(final.status).toBe("canceled");
    expect(final.totalCost).toBe(0.001);
    expect(await store.listStudySets()).toHaveLength(0);
    expect(cancelWorkflow).toHaveBeenCalledWith(job.runId);
  });

  it("closes a live provider connection on cancellation and retains its unknown accounting ID", async () => {
    let disconnected;
    const closed = new Promise((resolve) => {
      disconnected = resolve;
    });
    const provider = express();
    provider.post("/", (_req, res) => {
      res.set({
        "Content-Type": "text/event-stream",
        "X-Generation-Id": "generation-pending",
      });
      res.flushHeaders();
      res.write(": OPENROUTER PROCESSING\n\n");
      res.on("close", disconnected);
    });
    const server = provider.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise((resolve) => server.once("listening", resolve));
    const controller = new globalThis.AbortController();
    const fetchImpl = vi.fn((_url, options) =>
      fetch(`http://127.0.0.1:${server.address().port}/`, options),
    );
    const { generation, input, store } = await setup({
      fetchImpl,
      cancelWorkflow: async () => controller.abort(),
    });
    const job = await generation.create(input);
    const running = generation.runPrepareAndGenerate(
      job.id,
      job.runId,
      controller.signal,
    );
    await vi.waitFor(async () =>
      expect((await generation.inspect(job.id)).usage[0]?.generationId).toBe(
        "generation-pending",
      ),
    );
    await generation.cancel(job.id);
    expect((await running).status).toBe("canceled");
    await closed;
    const canceled = await generation.inspect(job.id);
    expect(canceled.usage).toEqual([
      expect.objectContaining({
        generationId: "generation-pending",
        cost: null,
        usageComplete: false,
      }),
    ]);
    expect(canceled.totalCost).toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(await store.listStudySets()).toHaveLength(0);
  });

  it("replaces pending stream accounting with one final usage receipt", async () => {
    const chunks = [
      {
        id: "generation-streamed",
        provider: "Fixture",
        choices: [
          {
            index: 0,
            delta: { content: JSON.stringify(set) },
            finish_reason: "stop",
          },
        ],
      },
      {
        id: "generation-streamed",
        provider: "Fixture",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: {
          cost: 0.003,
          prompt_tokens: 123,
          completion_tokens: 45,
          completion_tokens_details: { reasoning_tokens: 20 },
        },
      },
    ];
    const fetchImpl = vi.fn(
      async () =>
        new globalThis.Response(
          `${chunks
            .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
            .join("")}data: [DONE]\n\n`,
          {
            headers: {
              "Content-Type": "text/event-stream",
              "X-Generation-Id": "generation-streamed",
            },
          },
        ),
    );
    const { generation, input } = await setup({ fetchImpl });
    const job = await generation.create(input);
    const saved = await generation.runPrepareAndGenerate(job.id);
    expect(saved.status).toBe("saving");
    expect(saved.usage).toEqual([
      expect.objectContaining({
        generationId: "generation-streamed",
        cost: 0.003,
        inputTokens: 123,
        outputTokens: 45,
        reasoningTokens: 20,
        provider: "Fixture",
        usageComplete: true,
      }),
    ]);
    expect(saved.totalCost).toBe(0.003);
  });

  it("keeps cost unknown when the provider connection fails before returning an ID", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("Connection closed");
    });
    const { generation, input } = await setup({ fetchImpl });
    const job = await generation.create(input);
    expect(job.totalCost).toBe(0);
    const failed = await generation.runPrepareAndGenerate(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.usage).toEqual([]);
    expect(failed.totalCost).toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("retains cancellation delivery errors for retry without reopening the save fence", async () => {
    const { generation, input, cancelWorkflow, store } = await setup();
    const job = await generation.create(input);
    cancelWorkflow.mockRejectedValueOnce(new Error("Queue unavailable"));
    const canceled = await generation.cancel(job.id);
    expect(canceled.status).toBe("canceled");
    expect(canceled.cancellationError).toMatch(/could not be confirmed/);
    expect((await generation.runSave(job.id)).status).toBe("canceled");
    const retried = await generation.cancel(job.id);
    expect(retried.status).toBe("canceled");
    expect(retried.cancellationError).toBeNull();
    expect(cancelWorkflow).toHaveBeenCalledTimes(2);
    expect(await store.listStudySets()).toHaveLength(0);
  });

  it("delivers cancellation after a concurrently starting workflow supplies its run ID", async () => {
    let started;
    let release;
    const entered = new Promise((resolve) => {
      started = resolve;
    });
    const startWorkflow = vi.fn(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const { generation, input, cancelWorkflow } = await setup({
      startWorkflow,
    });
    const creating = generation.create(input);
    await entered;
    const canceled = await generation.cancel(input.mutationId);
    expect(canceled.status).toBe("canceled");
    expect(cancelWorkflow).not.toHaveBeenCalled();
    release({ runId: "late-run" });
    expect((await creating).status).toBe("canceled");
    expect(cancelWorkflow).toHaveBeenCalledWith("late-run");
  });

  it("does not start inference when its durable cancellation signal already fired", async () => {
    const { generation, input, fetchImpl } = await setup();
    const job = await generation.create(input);
    await generation.cancel(job.id);
    const controller = new globalThis.AbortController();
    controller.abort();
    const result = await generation.runPrepareAndGenerate(
      job.id,
      job.runId,
      controller.signal,
    );
    expect(result.status).toBe("canceled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("cancels pending saves when their source is deleted", async () => {
    const { generation, sources, store, input, source } = await setup();
    const job = await generation.create(input);
    await generation.runPrepareAndGenerate(job.id);
    await sources.remove(source.id);
    expect((await generation.runSave(job.id)).status).toBe("canceled");
    expect(await store.listStudySets()).toHaveLength(0);
  });

  it("projects completed job links from current sets after rename, deletion and Undo without changing audit history", async () => {
    const { generation, input, store } = await setup();
    const job = await generation.create(input);
    await generation.runPrepareAndGenerate(job.id);
    const completed = await generation.runSave(job.id);
    const history = await store.getRecord("jobs", job.id);
    const request = await requestJobs(generation);
    const setId = completed.resultRecord.id;
    const renamed = (
      await store.updateStudySet(setId, {
        title: "Flight controls",
        category: "Aviation",
      })
    ).record;
    expect((await request()).jobs[0].resultRecord).toEqual(renamed);
    expect((await request(`/jobs/${job.id}`)).job.resultRecord).toEqual(
      renamed,
    );

    const deletion = await store.deleteStudySet(setId);
    expect((await request()).jobs[0]).toMatchObject({
      status: "completed",
      resultRecord: null,
    });
    expect((await request(`/jobs/${job.id}`)).job.resultRecord).toBeNull();
    expect((await request("/jobs", input)).job.resultRecord).toBeNull();
    expect(
      (await request(`/jobs/${job.id}/cancel`, {})).job.resultRecord,
    ).toBeNull();
    expect(await store.getRecord("jobs", job.id)).toEqual(history);

    await store.undoChange(deletion.mutationId);
    const restored = await store.getStudySet(setId);
    expect((await request()).jobs[0].resultRecord).toEqual(restored);
    expect((await request(`/jobs/${job.id}`)).job.resultRecord).toEqual(
      restored,
    );
    expect(restored.rawSet.title).toBe("Flight controls");
    expect(await store.getRecord("jobs", job.id)).toEqual(history);
  });

  it("does not revive a deleted generation link when another set reuses its slug or ID-shaped slug", async () => {
    const { generation, input, store } = await setup();
    const job = await generation.create(input);
    await generation.runPrepareAndGenerate(job.id);
    const completed = await generation.runSave(job.id);
    await store.deleteStudySet(completed.resultRecord.id);
    const replacement = await store.createStudySet(set, {
      slug: completed.resultRecord.slug,
    });
    expect(replacement.record.id).not.toBe(completed.resultRecord.id);
    await store.createStudySet(
      { ...set, title: "ID-shaped slug" },
      { slug: completed.resultRecord.id },
    );
    const request = await requestJobs(generation);
    expect((await request()).jobs[0].resultRecord).toBeNull();
    expect((await request(`/jobs/${job.id}`)).job.resultRecord).toBeNull();
  });

  it("allows only one simultaneous worker to make a paid request", async () => {
    let release;
    let entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const fetchImpl = vi.fn(() => {
      entered();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const { generation, input } = await setup({ fetchImpl });
    const [first, retry] = await Promise.all([
      generation.create(input),
      generation.create(input),
    ]);
    expect(first.id).toBe(retry.id);
    const running = generation.runPrepareAndGenerate(first.id, "active-run");
    await started;
    const duplicate = await generation.runPrepareAndGenerate(
      first.id,
      "duplicate-run",
    );
    expect(duplicate.status).toBe("generating");
    expect(duplicate.runId).toBe("active-run");
    expect(
      (
        await generation.fail(
          first.id,
          new Error("Duplicate run failed"),
          "duplicate-run",
        )
      ).status,
    ).toBe("generating");
    release(response());
    await running;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await generation.runSave(first.id)).status).toBe("completed");
  });

  it("fails before starting a workflow when no owner key is configured", async () => {
    const { generation, input, startWorkflow, store } = await setup({
      getApiKey: async () => null,
    });
    await expect(generation.create(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(startWorkflow).not.toHaveBeenCalled();
    expect(await store.listRecords("jobs")).toHaveLength(0);
  });
});
