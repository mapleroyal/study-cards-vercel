import { beforeEach, describe, expect, it, vi } from "vitest";

const { request, upload } = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/runtime-client", () => ({ apiRequest: request }));
vi.mock("@vercel/blob/client", () => ({ upload }));
import { uploadGenerationSource } from "./generation-client";

const source = {
  id: "source-intent",
  name: "chapter.pdf",
  pathname: "sources/source-intent/original.pdf",
  mime: "application/pdf",
  status: "uploading",
};
const file = { name: "chapter.pdf", size: 123 };

beforeEach(() => {
  vi.resetAllMocks();
  request.mockResolvedValueOnce({ source });
});

describe("source upload recovery", () => {
  it("returns the completed source without deleting it", async () => {
    request.mockResolvedValueOnce({
      source: { ...source, status: "uploaded" },
    });
    await expect(uploadGenerationSource(file)).resolves.toMatchObject({
      status: "uploaded",
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith(
      source.pathname,
      file,
      expect.objectContaining({
        access: "private",
        clientPayload: JSON.stringify({ sourceId: source.id }),
      }),
    );
  });

  it("removes its intent when the Blob upload fails", async () => {
    const failure = new Error("Upload failed");
    upload.mockRejectedValueOnce(failure);
    request.mockResolvedValueOnce({ deleted: true });
    await expect(uploadGenerationSource(file)).rejects.toBe(failure);
    expect(request).toHaveBeenLastCalledWith("/api/sources/source-intent", {
      method: "DELETE",
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("removes an uploaded document when completion is uncertain", async () => {
    const failure = new Error("Connection lost");
    request
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ deleted: true });
    await expect(uploadGenerationSource(file)).rejects.toBe(failure);
    expect(request).toHaveBeenLastCalledWith("/api/sources/source-intent", {
      method: "DELETE",
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("retains the exact intent for visible recovery when deletion also fails", async () => {
    upload.mockRejectedValueOnce(new Error("Offline"));
    request.mockRejectedValueOnce(new Error("Still offline"));
    await expect(uploadGenerationSource(file)).rejects.toMatchObject({
      pendingSource: source,
      message: expect.stringContaining(
        "incomplete upload could not be removed",
      ),
    });
  });

  it("does not retain an already removed intent after a lost cleanup response", async () => {
    const failure = new Error("Upload failed");
    upload.mockRejectedValueOnce(failure);
    request.mockRejectedValueOnce(
      Object.assign(new Error("Not found"), { status: 404 }),
    );
    await expect(uploadGenerationSource(file)).rejects.toBe(failure);
  });
});
