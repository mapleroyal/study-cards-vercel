import { getWorkflowMetadata } from "workflow";

async function generate(jobId: string, runId: string) {
  "use step";
  const { getRuntime } = await import("../server/runtime.mjs");
  const { generation } = await getRuntime();
  return generation.runPrepareAndGenerate(jobId, runId);
}
// Provider failures are surfaced to the user. Avoid repeating billable inference
// automatically when a step fails after the provider has accepted the request.
generate.maxRetries = 0;

async function save(jobId: string) {
  "use step";
  const { getRuntime } = await import("../server/runtime.mjs");
  const { generation } = await getRuntime();
  return generation.runSave(jobId);
}

async function fail(jobId: string, message: string, runId: string) {
  "use step";
  const { getRuntime } = await import("../server/runtime.mjs");
  const { generation } = await getRuntime();
  return generation.fail(jobId, new Error(message), runId);
}

export async function generateStudySetWorkflow(jobId: string) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  try {
    const job = await generate(jobId, workflowRunId);
    return job.status === "saving" ? await save(jobId) : job;
  } catch (error) {
    return await fail(
      jobId,
      error instanceof Error
        ? error.message
        : "Generation could not be completed.",
      workflowRunId,
    );
  }
}
