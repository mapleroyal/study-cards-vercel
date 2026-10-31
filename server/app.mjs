import express from "express";
import { createLibraryRouter } from "./library.mjs";
import { getRuntime } from "./runtime.mjs";
import {
  readSession,
  verifyPassword,
  createSessionCookie,
  clearSessionCookie,
} from "./auth.mjs";

export function createApplication({ runtime = getRuntime } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    const origin = req.get("origin");
    const host = req.get("x-forwarded-host") || req.get("host");
    if (origin && origin !== `https://${host}` && origin !== `http://${host}`) {
      return res
        .status(403)
        .json({ error: "This request came from a different app origin." });
    }
    next();
  });
  // The hosting platform owns its request-body limit; do not impose a smaller one.
  app.use(express.json({ limit: Infinity }));
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, app: "lumina", edition: "vercel" }),
  );
  app.get("/api/capabilities", async (req, res) =>
    res.json({
      server: true,
      agent: false,
      pdfCleanup: false,
      storage: "server",
      authenticated: await readSession(req.get("cookie")),
    }),
  );
  app.post("/api/session", async (req, res) => {
    const { loginLimiter } = await runtime();
    try {
      await loginLimiter.consume(req.ip);
    } catch (error) {
      if (error instanceof Error) {
        throw Object.assign(new Error("Sign-in is temporarily unavailable."), {
          status: 503,
        });
      }
      res.setHeader(
        "Retry-After",
        String(Math.ceil(error.msBeforeNext / 1000)),
      );
      return res.status(429).json({ error: "Try again in a few minutes." });
    }
    if (!verifyPassword(req.body?.password)) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    await loginLimiter.delete(req.ip);
    res.setHeader("Set-Cookie", await createSessionCookie());
    return res.json({ ok: true });
  });
  app.delete("/api/session", (_req, res) => {
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.setHeader("Clear-Site-Data", '"cache", "storage"');
    res.json({ ok: true });
  });
  app.use(async (req, res, next) => {
    // Blob validates its signed completion callback. Token requests still require
    // the owner session below; callbacks cannot access any other app endpoint.
    if (
      req.path === "/api/sources/upload" &&
      req.method === "POST" &&
      req.body?.type === "blob.upload-completed"
    ) {
      return next();
    }
    if (!(await readSession(req.get("cookie")))) {
      return res.status(401).json({ error: "Sign in to continue." });
    }
    next();
  });
  let routerPromise;
  app.use(async (req, res, next) => {
    routerPromise ??= Promise.resolve(runtime())
      .then(({ store, sources, generation, settings, models }) => {
        const router = express.Router();
        router.get("/api/models", async (_request, response) =>
          response.json(await models.list()),
        );
        router.get("/api/settings", async (_request, response) =>
          response.json(await settings.read()),
        );
        router.put("/api/settings", async (request, response) =>
          response.json(await settings.update(request.body || {})),
        );
        router.use("/api", createLibraryRouter({ store }));
        router.use("/api/sources", sources.router);
        router.use("/api/generation", generation.router);
        return router;
      })
      .catch((error) => {
        routerPromise = undefined;
        throw error;
      });
    try {
      (await routerPromise)(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use((error, _req, res, _next) => {
    if (res.headersSent) {
      return;
    }
    const status =
      error.status ||
      (error.name === "ZodError" ? 422 : error.code === "CONFLICT" ? 409 : 500);
    if (status >= 500) {
      console.error("request_failed", {
        name: error.name,
        code: error.code,
      });
    }
    res.status(status).json({
      error:
        status >= 500
          ? "The request could not be completed. Please try again."
          : error.message,
      code: error.code,
    });
  });
  return app;
}
let application;
export function getApplication() {
  return (application ??= createApplication());
}
