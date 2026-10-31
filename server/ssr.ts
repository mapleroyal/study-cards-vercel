import { randomBytes } from "node:crypto";
import { createRequestHandler } from "react-router";
import { readSession } from "./auth.mjs";

const handler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    // React Router data requests for the login page must also work signed out.
    if (
      url.pathname !== "/login" &&
      url.pathname !== "/login.data" &&
      !(await readSession(request.headers.get("cookie")))
    ) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL("/login", url).href,
          "Cache-Control": "no-store",
        },
      });
    }
    const nonce = randomBytes(18).toString("base64");
    const headers = new Headers(request.headers);
    headers.set("x-lumina-nonce", nonce);
    // Nitro may supply a wrapped Request; cloning that object triggers native
    // Undici brand checks. Construct from its public fields instead.
    const forwarded = new Request(request.url, {
      method: request.method,
      headers,
      ...(!["GET", "HEAD"].includes(request.method)
        ? { body: request.body, duplex: "half" as const }
        : {}),
    });
    const rendered = await handler(forwarded);
    const response = new Response(rendered.body, rendered);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "same-origin");
    // Vite injects an inline development preamble and opens a HMR websocket.
    // Production uses a fresh document nonce, including React's streamed scripts.
    const scripts = import.meta.env.DEV
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : `'self' 'nonce-${nonce}'`;
    const connections = import.meta.env.DEV
      ? "'self' https://*.blob.vercel-storage.com https://vercel.com/api/blob/ ws: wss:"
      : "'self' https://*.blob.vercel-storage.com https://vercel.com/api/blob/";
    response.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; connect-src ${connections}; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
    );
    return response;
  },
};
