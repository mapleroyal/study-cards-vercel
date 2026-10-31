import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGenerationService } from "./index.mjs";
import { createSourceService } from "../sources.mjs";
import { createTestStore } from "../test-helpers/store.mjs";
import { createTestBlob } from "../test-helpers/blob.mjs";

const stores = [];
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
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe("durable generation jobs", () => {
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

  it("cancels pending saves when their source is deleted", async () => {
    const { generation, sources, store, input, source } = await setup();
    const job = await generation.create(input);
    await generation.runPrepareAndGenerate(job.id);
    await sources.remove(source.id);
    expect((await generation.runSave(job.id)).status).toBe("canceled");
    expect(await store.listStudySets()).toHaveLength(0);
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
