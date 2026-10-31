import { beforeEach, expect, it, vi } from "vitest";
import { generateStudySetWorkflow } from "../../workflows/generation.ts";

const hook = vi.hoisted(() => ({
  getConflict: vi.fn(async () => null),
  dispose: vi.fn(),
  then: vi.fn(() => new Promise(() => {})),
}));
const generation = vi.hoisted(() => ({
  runPrepareAndGenerate: vi.fn(),
  runSave: vi.fn(),
  fail: vi.fn(async (_id, error) => ({
    status: "failed",
    error: error.message,
  })),
}));
vi.mock("workflow", () => ({
  getWorkflowMetadata: () => ({ workflowRunId: "fixture-run" }),
  createHook: () => hook,
}));
vi.mock("../runtime.mjs", () => ({
  getRuntime: async () => ({ generation }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  hook.getConflict.mockResolvedValue(null);
  hook.then.mockImplementation(() => new Promise(() => {}));
});

it.each([
  Object.assign(new Error("Function terminated"), {
    code: "FUNCTION_INVOCATION_TIMEOUT",
  }),
  Object.assign(new Error("Platform request failed"), {
    cause: { code: "FUNCTION_INVOCATION_TIMEOUT" },
  }),
  new Error("FUNCTION_INVOCATION_TIMEOUT: Function timed out"),
])(
  "reports an explicit hosting timeout without claiming the model output limit was reached",
  async (error) => {
    generation.runPrepareAndGenerate.mockRejectedValueOnce(error);
    const result = await generateStudySetWorkflow("fixture-job");
    expect(result).toEqual({
      status: "failed",
      error:
        "Generation was stopped by the hosting provider's runtime limit before it finished.",
    });
    expect(generation.runPrepareAndGenerate).toHaveBeenCalledTimes(1);
    expect(generation.runSave).not.toHaveBeenCalled();
    expect(generation.fail).toHaveBeenCalledWith(
      "fixture-job",
      expect.any(Error),
      "fixture-run",
    );
  },
);

it("reports interrupted no-retry inference without inventing a timeout cause", async () => {
  generation.runPrepareAndGenerate.mockRejectedValueOnce(
    new Error('Step "generate" exceeded max retries (0 retries)'),
  );
  const result = await generateStudySetWorkflow("fixture-job");
  expect(result.error).toBe(
    "Generation was interrupted before it finished. It was not retried automatically.",
  );
  expect(result.error).not.toMatch(/time|token|model limit/);
  expect(generation.runPrepareAndGenerate).toHaveBeenCalledTimes(1);
});

it.each([
  'Step "save" exceeded max retries (3 retries)',
  "OpenRouter returned a provider error.",
  "The source was deleted.",
])("preserves other failure details: %s", async (message) => {
  generation.runPrepareAndGenerate.mockRejectedValueOnce(new Error(message));
  const result = await generateStudySetWorkflow("fixture-job");
  expect(result.error).toBe(message);
});

it("registers cancellation before starting inference and aborts the running step cooperatively", async () => {
  let register;
  hook.getConflict.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        register = resolve;
      }),
  );
  let resume;
  hook.then.mockImplementationOnce(
    (callback) =>
      new Promise((resolve) => {
        resume = () => resolve(callback());
      }),
  );
  let requestSignal;
  generation.runPrepareAndGenerate.mockImplementationOnce(
    (_jobId, _runId, signal) => {
      requestSignal = signal;
      return new Promise((resolve) =>
        signal.addEventListener(
          "abort",
          () => resolve({ status: "canceled" }),
          { once: true },
        ),
      );
    },
  );
  const running = generateStudySetWorkflow("fixture-job");
  expect(generation.runPrepareAndGenerate).not.toHaveBeenCalled();
  register(null);
  await vi.waitFor(() => expect(requestSignal).toBeDefined());
  expect(requestSignal.aborted).toBe(false);
  resume();
  expect(await running).toEqual({ status: "canceled" });
  expect(requestSignal.aborted).toBe(true);
  expect(generation.runSave).not.toHaveBeenCalled();
  expect(generation.fail).not.toHaveBeenCalled();
  expect(hook.dispose).toHaveBeenCalledOnce();
});

it("saves successful inference and disposes its cancellation hook", async () => {
  generation.runPrepareAndGenerate.mockResolvedValueOnce({ status: "saving" });
  generation.runSave.mockResolvedValueOnce({ status: "completed" });
  expect(await generateStudySetWorkflow("fixture-job")).toEqual({
    status: "completed",
  });
  expect(generation.runSave).toHaveBeenCalledWith("fixture-job");
  expect(hook.dispose).toHaveBeenCalledOnce();
});
