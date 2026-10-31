import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  getInlineExecutableScripts,
  hardenVercelOutputCsp,
} from "./harden-vercel-csp.mjs";

const temporaryDirectories = [];
const baseCsp =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; object-src 'none'";

function createOutputFixture({ config, html }) {
  const fixtureDirectory = mkdtempSync(
    path.join(tmpdir(), "lumina-vercel-csp-"),
  );
  const outputDirectory = path.join(fixtureDirectory, ".vercel/output");

  temporaryDirectories.push(fixtureDirectory);
  mkdirSync(path.join(outputDirectory, "static"), { recursive: true });

  if (html !== undefined) {
    writeFileSync(path.join(outputDirectory, "static/index.html"), html);
  }

  if (config !== undefined) {
    writeFileSync(
      path.join(outputDirectory, "config.json"),
      typeof config === "string" ? config : JSON.stringify(config),
    );
  }

  return outputDirectory;
}

function createConfig(csp = baseCsp) {
  return {
    version: 3,
    routes: [
      {
        src: "/(.*)",
        headers: {
          "Content-Security-Policy": csp,
          "Cross-Origin-Opener-Policy": "same-origin",
        },
        continue: true,
      },
      { handle: "filesystem" },
    ],
    overrides: { "favicon.svg": { contentType: "image/svg+xml" } },
  };
}

function sha256Source(source) {
  return `'sha256-${createHash("sha256").update(source).digest("base64")}'`;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("getInlineExecutableScripts", () => {
  it("returns only non-empty inline JavaScript and module contents", () => {
    expect(
      getInlineExecutableScripts(`<!doctype html>
        <!-- <script>ignoredComment()</script> -->
        <script src="/assets/app.js">ignoredExternal()</script>
        <script type="application/json">{"ignored":true}</script>
        <script type="text/plain">ignoredData()</script>
        <script>   </script>
        <script data-entry>first()</script>
        <script TYPE='module'> second() </script>`),
    ).toEqual(["first()", " second() "]);
  });

  it("fails closed for malformed script markup", () => {
    expect(() =>
      getInlineExecutableScripts("<script type='module'>bootstrap()"),
    ).toThrow("without a closing tag");
    expect(() =>
      getInlineExecutableScripts('<script type="module>bootstrap()</script>'),
    ).toThrow("unterminated script tag");
  });
});

describe("hardenVercelOutputCsp", () => {
  it("replaces script unsafe-inline with exact hashes and preserves other config", () => {
    const firstScript = "window.__state = { ready: true };";
    const secondScript = "\nimport('/assets/app.js');\n";
    const config = createConfig();
    const outputDirectory = createOutputFixture({
      config,
      html: `<!doctype html><html><head>
        <script>${firstScript}</script>
        <script type="application/json">{"safe":"data"}</script>
        <script type="module">${secondScript}</script>
      </head></html>`,
    });

    const result = hardenVercelOutputCsp({ outputDirectory });
    const patchedConfig = JSON.parse(
      readFileSync(path.join(outputDirectory, "config.json"), "utf8"),
    );
    const patchedCsp =
      patchedConfig.routes[0].headers["Content-Security-Policy"];

    expect(result).toMatchObject({
      hashSources: [sha256Source(firstScript), sha256Source(secondScript)],
      scriptCount: 2,
    });
    expect(patchedCsp).toContain(
      `script-src 'self' 'wasm-unsafe-eval' ${sha256Source(firstScript)} ${sha256Source(secondScript)}`,
    );
    expect(patchedCsp).toContain("style-src 'self' 'unsafe-inline'");
    expect(patchedCsp).not.toMatch(/script-src\s[^;]*'unsafe-inline'/);
    expect(patchedConfig.routes[0].headers["Cross-Origin-Opener-Policy"]).toBe(
      "same-origin",
    );
    expect(patchedConfig.routes[1]).toEqual(config.routes[1]);
    expect(patchedConfig.overrides).toEqual(config.overrides);
  });

  it("deduplicates hashes for identical inline scripts", () => {
    const outputDirectory = createOutputFixture({
      config: createConfig(),
      html: "<script>bootstrap()</script><script>bootstrap()</script>",
    });

    const result = hardenVercelOutputCsp({ outputDirectory });

    expect(result.scriptCount).toBe(2);
    expect(result.hashSources).toEqual([sha256Source("bootstrap()")]);
  });

  it("fails closed when either build artifact is missing", () => {
    const withoutHtml = createOutputFixture({ config: createConfig() });
    const withoutConfig = createOutputFixture({
      html: "<script>bootstrap()</script>",
    });

    expect(() =>
      hardenVercelOutputCsp({ outputDirectory: withoutHtml }),
    ).toThrow("Unable to read generated HTML");
    expect(() =>
      hardenVercelOutputCsp({ outputDirectory: withoutConfig }),
    ).toThrow("Unable to read Vercel output config");
  });

  it("fails closed for malformed or structurally invalid config", () => {
    const malformedOutput = createOutputFixture({
      config: "{not json",
      html: "<script>bootstrap()</script>",
    });
    const invalidOutput = createOutputFixture({
      config: { version: 3 },
      html: "<script>bootstrap()</script>",
    });

    expect(() =>
      hardenVercelOutputCsp({ outputDirectory: malformedOutput }),
    ).toThrow("malformed JSON");
    expect(() =>
      hardenVercelOutputCsp({ outputDirectory: invalidOutput }),
    ).toThrow("missing its routes array");
  });

  it("fails closed when the CSP header or script directive is missing", () => {
    const noHeaderOutput = createOutputFixture({
      config: {
        version: 3,
        routes: [{ src: "/(.*)", headers: { "X-Test": "true" } }],
      },
      html: "<script>bootstrap()</script>",
    });
    const noScriptSourceOutput = createOutputFixture({
      config: createConfig("default-src 'self'; object-src 'none'"),
      html: "<script>bootstrap()</script>",
    });

    expect(() =>
      hardenVercelOutputCsp({ outputDirectory: noHeaderOutput }),
    ).toThrow("does not contain a Content-Security-Policy header");
    expect(() =>
      hardenVercelOutputCsp({ outputDirectory: noScriptSourceOutput }),
    ).toThrow("missing its script-src directive");
  });

  it("fails closed when no executable inline script exists", () => {
    const outputDirectory = createOutputFixture({
      config: createConfig(),
      html: '<script src="/app.js"></script><script type="application/json">{}</script>',
    });

    expect(() => hardenVercelOutputCsp({ outputDirectory })).toThrow(
      "no non-empty inline executable scripts",
    );
  });

  it.each([
    [
      "an already-hardened policy",
      "script-src 'self' 'sha256-existing'; object-src 'none'",
      "exactly one 'unsafe-inline'",
    ],
    [
      "a pre-existing nonce",
      "script-src 'self' 'unsafe-inline' 'nonce-static'; object-src 'none'",
      "pre-existing nonce or hash",
    ],
    [
      "an overriding script-src-elem directive",
      "script-src 'self' 'unsafe-inline'; script-src-elem 'self' 'unsafe-inline'",
      "script-src-elem override",
    ],
    [
      "an unsafe evaluation source",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none'",
      "unsafe script source(s)",
    ],
  ])("fails closed for %s", (_label, csp, expectedMessage) => {
    const outputDirectory = createOutputFixture({
      config: createConfig(csp),
      html: "<script>bootstrap()</script>",
    });

    expect(() => hardenVercelOutputCsp({ outputDirectory })).toThrow(
      expectedMessage,
    );
  });
});
