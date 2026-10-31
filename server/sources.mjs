import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import { get, put, head, del } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";

const types = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
};
const terminalJobs = new Set(["completed", "failed", "canceled"]);
const now = () => new Date().toISOString();
const problem = (message, status = 400) =>
  Object.assign(new Error(message), { status });

export function publicSource(source) {
  if (!source) {
    return null;
  }
  const summary = { ...source };
  delete summary.originalUrl;
  delete summary.preparedUrl;
  return summary;
}

export function createSourceService({
  store,
  blob = { get, put, head, del },
  handleUploadFn = handleUpload,
  cancelRun = async () => {},
}) {
  async function inspect(id) {
    const source = await store.getRecord("sources", id);
    if (!source || source.status === "deleting") {
      throw problem("Document not found.", 404);
    }
    return source;
  }
  async function beginUpload({ name, size }) {
    const fileName = path
      .basename(String(name || ""))
      .replace(/[\p{Cc}]/gu, "")
      .trim();
    const extension = path.extname(fileName).toLowerCase();
    const mime = types[extension];
    if (!mime) {
      throw problem("Choose a PDF, Markdown, or text document.", 415);
    }
    if (!Number.isSafeInteger(size) || size <= 0) {
      throw problem("The document is empty.");
    }
    const id = randomUUID();
    const source = {
      id,
      name: fileName,
      mime,
      size,
      pathname: `sources/${id}/original${extension}`,
      status: "uploading",
      createdAt: now(),
      updatedAt: now(),
    };
    await store.putRecord("sources", id, source);
    return publicSource(source);
  }
  async function complete(id) {
    const source = await inspect(id);
    if (source.status !== "uploading") {
      return publicSource(source);
    }
    // Read metadata from our own store path, never trust a client-supplied URL.
    const uploaded = await blob.head(source.pathname);
    if (
      uploaded.size !== source.size ||
      uploaded.contentType?.split(";")[0].trim() !== source.mime
    ) {
      throw problem(
        "The uploaded document does not match the selected file.",
        422,
      );
    }
    const next = await store.updateRecord("sources", id, (current) => {
      if (!current || current.status === "deleting") {
        throw problem("Document not found.", 404);
      }
      if (current.status !== "uploading") {
        return undefined;
      }
      return {
        ...current,
        originalUrl: uploaded.url,
        status: "uploaded",
        updatedAt: now(),
      };
    });
    return publicSource(next);
  }
  async function addText({ text, name = "Pasted text" }) {
    if (typeof text !== "string" || !text.trim()) {
      throw problem("Add some source text.");
    }
    const id = randomUUID();
    const pathname = `sources/${id}/original.txt`;
    const uploaded = await blob.put(pathname, text, {
      access: "private",
      contentType: "text/plain",
      addRandomSuffix: false,
    });
    const source = {
      id,
      name: String(name).trim() || "Pasted text",
      mime: "text/plain",
      size: Buffer.byteLength(text),
      pathname,
      originalUrl: uploaded.url,
      status: "ready",
      characters: text.length,
      createdAt: now(),
      updatedAt: now(),
    };
    try {
      await store.putRecord("sources", id, source);
    } catch (error) {
      await blob.del(uploaded.url);
      throw error;
    }
    return publicSource(source);
  }
  async function readBlob(url) {
    const result = await blob.get(url, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw problem("The source document is unavailable.", 404);
    }
    return Buffer.from(
      await new globalThis.Response(result.stream).arrayBuffer(),
    );
  }
  async function document(id) {
    const source = await inspect(id);
    if (source.status === "uploading") {
      throw problem("Wait for the document upload to finish.", 409);
    }
    if (source.preparedUrl) {
      const prepared = JSON.parse(
        (await readBlob(source.preparedUrl)).toString("utf8"),
      );
      await inspect(id);
      return { source: publicSource(source), ...prepared };
    }
    const bytes = await readBlob(source.originalUrl || source.pathname);
    await inspect(id);
    if (source.mime === "application/pdf") {
      if (!bytes.subarray(0, 1024).toString("latin1").includes("%PDF-")) {
        throw problem("The file is not a readable PDF.", 422);
      }
      return {
        source: publicSource(source),
        fileData: `data:application/pdf;base64,${bytes.toString("base64")}`,
      };
    }
    const text = bytes.toString("utf8");
    if (!text.trim()) {
      throw problem("No readable text was found in this document.", 422);
    }
    return { source: publicSource(source), text };
  }
  async function rememberParsed(id, annotations) {
    const files = (annotations || [])
      .filter(
        (item) => item?.type === "file" && typeof item.file?.hash === "string",
      )
      .map((item) => ({
        type: "file",
        file: {
          ...item.file,
          content: (item.file.content || []).filter(
            (part) => part.type === "text",
          ),
        },
      }));
    if (!files.length) {
      return;
    }
    const text = files
      .flatMap((item) => item.file.content.map((part) => part.text || ""))
      .join("\n\n");
    if (!text.trim()) {
      throw problem(
        "This PDF has no readable text. Supply a text-based PDF or paste the material.",
        422,
      );
    }
    const source = await inspect(id);
    if (source.preparedUrl) {
      return;
    }
    const uploaded = await blob.put(
      `sources/${id}/parsed-${randomUUID()}.json`,
      JSON.stringify({ text, annotations: files }),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      },
    );
    let retained = false;
    try {
      const committed = await store.updateRecord("sources", id, (current) => {
        if (!current || current.status === "deleting" || current.preparedUrl) {
          return undefined;
        }
        return {
          ...current,
          preparedUrl: uploaded.url,
          status: "ready",
          characters: text.length,
          updatedAt: now(),
        };
      });
      retained = committed?.preparedUrl === uploaded.url;
    } finally {
      if (!retained) {
        await blob.del(uploaded.url);
      }
    }
  }
  async function remove(id) {
    let source;
    await store.updateRecord("sources", id, (current) => {
      if (!current) {
        throw problem("Document not found.", 404);
      }
      source = current;
      return {
        ...current,
        status: "deleting",
        deletionError: null,
        updatedAt: now(),
      };
    });
    try {
      for (const job of await store.listRecords("jobs")) {
        if (job.sourceId !== id || terminalJobs.has(job.status)) {
          continue;
        }
        const canceled = await store.updateRecord("jobs", job.id, (current) =>
          current && !terminalJobs.has(current.status)
            ? {
                ...current,
                status: "canceled",
                updatedAt: now(),
                completedAt: now(),
              }
            : undefined,
        );
        if (canceled?.runId) {
          await cancelRun(canceled.runId).catch(() => undefined);
        }
      }
      await blob.del(
        [source.originalUrl || source.pathname, source.preparedUrl].filter(
          Boolean,
        ),
      );
      await store.deleteRecord("sources", id);
    } catch (error) {
      await store
        .updateRecord("sources", id, (current) =>
          current
            ? {
                ...current,
                status: "deleting",
                deletionError:
                  "Could not delete this document. Retry deletion.",
                updatedAt: now(),
              }
            : undefined,
        )
        .catch(() => undefined);
      throw problem(
        "Could not delete this document. Retry deletion.",
        error.status || 503,
      );
    }
    return { deleted: true, id };
  }
  async function upload(request) {
    return handleUploadFn({
      request,
      body: request.body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { sourceId } = JSON.parse(clientPayload || "{}");
        const source = await inspect(sourceId);
        if (source.status !== "uploading" || source.pathname !== pathname) {
          throw problem("Start a new document upload.", 409);
        }
        return {
          allowedContentTypes: [source.mime],
          maximumSizeInBytes: source.size,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ sourceId }),
        };
      },
      onUploadCompleted: async ({ tokenPayload, blob: uploaded }) => {
        const { sourceId } = JSON.parse(tokenPayload || "{}");
        const source = await store.getRecord("sources", sourceId);
        if (!source || source.status === "deleting") {
          await blob.del(uploaded.url);
          return;
        }
        await complete(sourceId);
      },
    });
  }
  async function list() {
    return (await store.listRecords("sources"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicSource);
  }
  const router = Router();
  router.get("/", async (_req, res) => res.json({ sources: await list() }));
  router.post("/upload-intent", async (req, res) =>
    res.status(201).json({ source: await beginUpload(req.body) }),
  );
  router.post("/upload", async (req, res) => res.json(await upload(req)));
  router.post("/text", async (req, res) =>
    res.status(201).json({ source: await addText(req.body) }),
  );
  router.post("/:id/complete", async (req, res) =>
    res.json({ source: await complete(req.params.id) }),
  );
  router.get("/:id", async (req, res) =>
    res.json({ source: publicSource(await inspect(req.params.id)) }),
  );
  router.delete("/:id", async (req, res) =>
    res.json(await remove(req.params.id)),
  );
  return {
    router,
    list,
    inspect,
    beginUpload,
    complete,
    addText,
    document,
    rememberParsed,
    remove,
    upload,
  };
}
