import { start, getRun } from "workflow/api";
import { generateStudySetWorkflow } from "../../workflows/generation.ts";

export async function startGenerationWorkflow(jobId) {
  return start(generateStudySetWorkflow, [jobId]);
}
export async function cancelGenerationWorkflow(runId) {
  await getRun(runId).cancel();
}
