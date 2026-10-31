export function createStudySetExport(record) {
  const title = record.rawSet.title
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const stem = title || "export";
  return {
    filename: `study-cards-${stem}.json`,
    // Export the saved source order and answer keys, never reader/session state.
    content: `${JSON.stringify(record.rawSet, null, 2)}\n`,
  };
}

export function downloadStudySet(record) {
  const { filename, content } = createStudySetExport(record);
  const url = URL.createObjectURL(
    new globalThis.Blob([content], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Keep the object URL alive until the browser has started the download.
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
