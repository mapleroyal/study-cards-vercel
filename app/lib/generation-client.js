import { apiRequest } from "@/lib/runtime-client";

export async function uploadGenerationSource(file) {
  const { source } = await apiRequest("/api/sources/upload-intent", {
    method: "POST",
    body: { name: file.name, size: file.size },
  });
  const { upload } = await import("@vercel/blob/client");
  await upload(source.pathname, file, {
    access: "private",
    handleUploadUrl: "/api/sources/upload",
    clientPayload: JSON.stringify({ sourceId: source.id }),
    contentType: source.mime,
  });
  const result = await apiRequest(
    `/api/sources/${encodeURIComponent(source.id)}/complete`,
    { method: "POST", body: {} },
  );
  return result.source;
}
export const activeJobStatuses = new Set([
  "queued",
  "preparing",
  "generating",
  "saving",
]);
export const jobLabels = {
  queued: "Queued",
  preparing: "Preparing source",
  generating: "Generating cards",
  saving: "Saving set",
  completed: "Complete",
  failed: "Generation failed",
  canceled: "Canceled",
};
