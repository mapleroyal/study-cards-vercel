import { Buffer } from "node:buffer";

export function createTestBlob() {
  const entries = new Map();
  const deleted = [];
  const urlFor = (pathname) => `https://private.example/${pathname}`;
  const keyFor = (value) => value.replace("https://private.example/", "");
  return {
    entries,
    deleted,
    async put(pathname, body, { contentType }) {
      const bytes = Buffer.from(body);
      const value = {
        pathname,
        url: urlFor(pathname),
        size: bytes.length,
        contentType,
        bytes,
      };
      entries.set(pathname, value);
      return value;
    },
    async head(pathname) {
      const entry = entries.get(keyFor(pathname));
      if (!entry) {
        throw new Error("Blob not found");
      }
      return entry;
    },
    async get(value) {
      const entry = entries.get(keyFor(value));
      return entry
        ? { statusCode: 200, stream: new globalThis.Response(entry.bytes).body }
        : null;
    },
    async del(value) {
      for (const item of [value].flat()) {
        deleted.push(item);
        entries.delete(keyFor(item));
      }
    },
  };
}
