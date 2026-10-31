import { start, getRun, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { generateStudySetWorkflow } from "../../workflows/generation.ts";

export async function startGenerationWorkflow(jobId) {
  return start(generateStudySetWorkflow, [jobId]);
}
export async function cancelGenerationWorkflow(runId) {
  try {
    await resumeHook(`generation-cancel:${runId}`, { canceled: true });
  } catch (error) {
    if (!HookNotFoundError.is(error)) {
      throw error;
    }
    // The job is already fenced in Postgres. A queued/pre-hook run cannot
    // start inference; old deployments also only support whole-run cancel.
    await getRun(runId).cancel();
  }
}
