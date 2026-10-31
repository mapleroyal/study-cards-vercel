import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it } from "vitest";
import { createSourceService } from "./sources.mjs";
import { createTestStore } from "./test-helpers/store.mjs";
import { createTestBlob } from "./test-helpers/blob.mjs";

const stores = [];
function setup(options = {}) {
  const store = createTestStore();
  stores.push(store);
  const blob = createTestBlob();
  return {
    store,
    blob,
    sources: createSourceService({ store, blob, ...options }),
  };
}
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});
const annotation = (content) => [
  {
    type: "file",
    file: { hash: "parsed-document-hash", name: "source.pdf", content },
  },
];

async function pdf(sources, blob) {
  const bytes = Buffer.from(
    "%PDF-1.7\nFull document bytes, never locally extracted.",
  );
  const source = await sources.beginUpload({
    name: "chapter.pdf",
    size: bytes.length,
  });
  await blob.put(source.pathname, bytes, { contentType: "application/pdf" });
  await sources.complete(source.id);
  return { source, bytes };
}

describe("private source documents", () => {
  it("preserves the exact pasted source and keeps private Blob URLs out of metadata", async () => {
    const { sources } = setup();
    const text = "  First paragraph.\n\nLast paragraph. αβ\n";
    const source = await sources.addText({ text, name: "Exact source" });
    expect(source).not.toHaveProperty("originalUrl");
    expect((await sources.document(source.id)).text).toBe(text);
    await expect(
      sources.beginUpload({ name: "unsupported.docx", size: 20 }),
    ).rejects.toMatchObject({ status: 415 });
  });

  it("verifies upload metadata against the server-owned pathname", async () => {
    const { sources, blob } = setup();
    const source = await sources.beginUpload({
      name: "../source.txt",
      size: 4,
    });
    expect(source.name).toBe("source.txt");
    await blob.put(source.pathname, "short", { contentType: "text/plain" });
    await expect(sources.complete(source.id)).rejects.toMatchObject({
      status: 422,
    });
    await expect(sources.document(source.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("sends the whole PDF unchanged and reuses only maintained-parser text annotations", async () => {
    const { sources, blob } = setup();
    const { source, bytes } = await pdf(sources, blob);
    const original = await sources.document(source.id);
    expect(original.fileData).toBe(
      `data:application/pdf;base64,${bytes.toString("base64")}`,
    );
    expect(original).not.toHaveProperty("text");
    await sources.rememberParsed(
      source.id,
      annotation([
        { type: "text", text: "First section." },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,ignored" },
        },
        { type: "text", text: "Last section." },
      ]),
    );
    const prepared = await sources.document(source.id);
    expect(prepared.text).toBe("First section.\n\nLast section.");
    expect(prepared.annotations[0].file.content).toHaveLength(2);
    expect(prepared).not.toHaveProperty("fileData");
  });

  it("fails clearly when the hosted parser finds no text", async () => {
    const { sources, blob } = setup();
    const { source } = await pdf(sources, blob);
    await expect(
      sources.rememberParsed(
        source.id,
        annotation([{ type: "image_url", image_url: { url: "image" } }]),
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect((await sources.inspect(source.id)).preparedUrl).toBeUndefined();
  });

  it("deletes late parser artifacts after their source was deleted", async () => {
    const { sources, blob, store } = setup();
    const { source } = await pdf(sources, blob);
    let release;
    let entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const put = blob.put;
    blob.put = async (...args) => {
      entered();
      await pending;
      return put(...args);
    };
    const caching = sources.rememberParsed(
      source.id,
      annotation([{ type: "text", text: "Parsed text." }]),
    );
    await started;
    await sources.remove(source.id);
    release();
    await caching;
    expect(await store.getRecord("sources", source.id)).toBeNull();
    expect(blob.entries.size).toBe(0);
  });

  it("restricts upload tokens and cleans up a late signed upload completion", async () => {
    let callbacks;
    const { sources, blob } = setup({
      handleUploadFn: async (options) => {
        callbacks = options;
        return {};
      },
    });
    const source = await sources.beginUpload({ name: "source.txt", size: 4 });
    await sources.upload({ body: { type: "blob.generate-client-token" } });
    const token = await callbacks.onBeforeGenerateToken(
      source.pathname,
      JSON.stringify({ sourceId: source.id }),
    );
    expect(token).toMatchObject({
      maximumSizeInBytes: 4,
      allowedContentTypes: ["text/plain"],
      allowOverwrite: false,
      addRandomSuffix: false,
    });
    await expect(
      callbacks.onBeforeGenerateToken(
        "other-path",
        JSON.stringify({ sourceId: source.id }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await sources.remove(source.id);
    const uploaded = await blob.put(source.pathname, "text", {
      contentType: "text/plain",
    });
    await callbacks.onUploadCompleted({
      tokenPayload: token.tokenPayload,
      blob: uploaded,
    });
    expect(blob.entries.size).toBe(0);
  });
  it("cleans up a parsed blob when the metadata transaction fails after its callback", async () => {
    const { sources, blob, store } = setup();
    const { source } = await pdf(sources, blob);
    store.updateRecord = async (_namespace, id, updater) => {
      updater(await store.getRecord("sources", id));
      throw new Error("Metadata commit failed");
    };
    await expect(
      sources.rememberParsed(
        source.id,
        annotation([{ type: "text", text: "Parsed material." }]),
      ),
    ).rejects.toThrow("Metadata commit failed");
    expect(blob.entries.size).toBe(1);
    expect((await sources.inspect(source.id)).preparedUrl).toBeUndefined();
  });

  it("keeps failed deletions visible and fenced until a delete retry succeeds", async () => {
    const { sources, blob } = setup();
    const source = await sources.addText({ text: "Some material." });
    const del = blob.del;
    blob.del = async () => {
      throw new Error("Temporary Blob outage");
    };
    await expect(sources.remove(source.id)).rejects.toMatchObject({
      status: 503,
    });
    expect(await sources.list()).toEqual([
      expect.objectContaining({
        id: source.id,
        status: "deleting",
        deletionError: expect.stringContaining("Retry"),
      }),
    ]);
    await expect(sources.document(source.id)).rejects.toMatchObject({
      status: 404,
    });
    blob.del = del;
    await sources.remove(source.id);
    expect(await sources.list()).toHaveLength(0);
    expect(blob.entries.size).toBe(0);
  });

  it("does not downgrade a parsed source when an older upload callback finishes late", async () => {
    const { sources, blob } = setup();
    const bytes = Buffer.from("%PDF-1.7\nSynthetic text PDF");
    const source = await sources.beginUpload({
      name: "chapter.pdf",
      size: bytes.length,
    });
    await blob.put(source.pathname, bytes, { contentType: "application/pdf" });
    const head = blob.head;
    let release;
    let entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    blob.head = async (...args) => {
      entered();
      await pending;
      return head(...args);
    };
    const lateCompletion = sources.complete(source.id);
    await started;
    blob.head = head;
    await sources.complete(source.id);
    await sources.rememberParsed(
      source.id,
      annotation([{ type: "text", text: "Parsed material." }]),
    );
    release();
    expect((await lateCompletion).status).toBe("ready");
    expect((await sources.inspect(source.id)).status).toBe("ready");
  });
});
