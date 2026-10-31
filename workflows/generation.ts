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

function generationFailureMessage(error: unknown) {
  const failure = error as {
    message?: string;
    code?: string;
    errorCode?: string;
    cause?: { code?: string; errorCode?: string };
  } | null;
  const message =
    typeof failure?.message === "string"
      ? failure.message
      : "Generation could not be completed.";
  const codes = [
    failure?.code,
    failure?.errorCode,
    failure?.cause?.code,
    failure?.cause?.errorCode,
  ];
  if (
    codes.includes("FUNCTION_INVOCATION_TIMEOUT") ||
    /\bFUNCTION_INVOCATION_TIMEOUT\b/.test(message)
  ) {
    return "Generation was stopped by the hosting provider's runtime limit before it finished.";
  }
  if (/^Step ".+" exceeded max retries \(0 retries\)$/.test(message)) {
    // A killed invocation can also mean a process crash. Only an explicit
    // platform timeout above is sufficient to call this a time-limit failure.
    return "Generation was interrupted before it finished. It was not retried automatically.";
  }
  return message;
}

export async function generateStudySetWorkflow(jobId: string) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  try {
    const job = await generate(jobId, workflowRunId);
    return job.status === "saving" ? await save(jobId) : job;
  } catch (error) {
    return await fail(jobId, generationFailureMessage(error), workflowRunId);
  }
}
