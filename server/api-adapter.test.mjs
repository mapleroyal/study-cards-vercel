import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { H3 } from "h3";

const holder = vi.hoisted(() => ({ app: null }));
vi.mock("./app.mjs", () => ({ getApplication: async () => holder.app }));
import api from "./routes/api/[...path].ts";

beforeEach(() => {
  holder.app = express();
  holder.app.use(express.json());
});
const request = (path, init) =>
  new H3()
    .all("/**", api)
    .fetch(new globalThis.Request(`https://app.example${path}`, init));

describe("Vercel Fetch-to-Express API adapter", () => {
  it("serves the full API path without a native Node request context", async () => {
    holder.app.get("/api/health", (_req, res) => res.json({ healthy: true }));
    const response = await request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ healthy: true });
  });

  it("preserves JSON request bodies, auth headers and multiple session cookies", async () => {
    holder.app.post("/api/session", (req, res) => {
      expect(req.headers.origin).toBe("https://app.example");
      expect(req.headers.cookie).toBe("old-session=one");
      expect(req.body).toEqual({ password: "synthetic-test-password" });
      res.append("Set-Cookie", "session=one; HttpOnly; Secure; Path=/");
      res.append("Set-Cookie", "second=two; HttpOnly; Secure; Path=/");
      res.status(201).json({ authenticated: true });
    });
    const response = await request("/api/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example",
        cookie: "old-session=one",
      },
      body: JSON.stringify({ password: "synthetic-test-password" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ authenticated: true });
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it("preserves Express rejection and error responses", async () => {
    holder.app.get("/api/private", (_req, res) =>
      res.status(401).json({ error: "Sign in" }),
    );
    holder.app.get("/api/error", () => {
      throw new Error("Test failure");
    });
    holder.app.use((_error, _req, res, _next) =>
      res.status(503).json({ error: "Unavailable" }),
    );
    expect((await request("/api/private")).status).toBe(401);
    const failure = await request("/api/error");
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ error: "Unavailable" });
  });
});
