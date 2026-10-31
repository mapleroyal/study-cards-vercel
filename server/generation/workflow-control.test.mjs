import { beforeEach, expect, it, vi } from "vitest";
import { HookNotFoundError } from "workflow/errors";
import { cancelGenerationWorkflow } from "./workflow-control.mjs";

const api = vi.hoisted(() => ({
  start: vi.fn(),
  resumeHook: vi.fn(),
  cancel: vi.fn(),
  getRun: vi.fn(),
}));
vi.mock("workflow/api", () => api);
vi.mock("../../workflows/generation.ts", () => ({
  generateStudySetWorkflow: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  api.getRun.mockReturnValue({ cancel: api.cancel });
});

it("resumes the durable signal without prematurely canceling its running workflow", async () => {
  await cancelGenerationWorkflow("fixture-run");
  expect(api.resumeHook).toHaveBeenCalledWith("generation-cancel:fixture-run", {
    canceled: true,
  });
  expect(api.getRun).not.toHaveBeenCalled();
});

it("cancels a fenced queued or legacy run when no cooperative hook exists", async () => {
  api.resumeHook.mockRejectedValue(new HookNotFoundError("fixture-token"));
  await cancelGenerationWorkflow("fixture-run");
  expect(api.getRun).toHaveBeenCalledWith("fixture-run");
  expect(api.cancel).toHaveBeenCalledOnce();
});

it("reports ambiguous delivery failure instead of killing the workflow before it can deliver its signal", async () => {
  const error = new Error("Queue could not accept wake");
  api.resumeHook.mockRejectedValue(error);
  await expect(cancelGenerationWorkflow("fixture-run")).rejects.toBe(error);
  expect(api.cancel).not.toHaveBeenCalled();
});
