import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const executableScriptTypes = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "module",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
]);
const unsafeScriptSourceTokens = new Set([
  "*",
  "'unsafe-eval'",
  "'unsafe-hashes'",
  "blob:",
  "data:",
  "http:",
  "https:",
]);

function findTagEnd(html, startIndex) {
  let quote = null;

  for (let index = startIndex; index < html.length; index += 1) {
    const character = html[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === ">") {
      return index;
    }
  }

  return -1;
}

function parseAttributes(source) {
  const attributes = new Map();
  let index = 0;

  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }

    if (index >= source.length || source[index] === "/") {
      break;
    }

    const nameStart = index;

    while (index < source.length && !/[\s=/>]/.test(source[index])) {
      index += 1;
    }

    if (nameStart === index) {
      throw new Error("The generated HTML contains a malformed script tag.");
    }

    const name = source.slice(nameStart, index).toLowerCase();

    if (attributes.has(name)) {
      throw new Error(
        `The generated HTML contains a duplicate "${name}" script attribute.`,
      );
    }

    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }

    let value = "";

    if (source[index] === "=") {
      index += 1;

      while (/\s/.test(source[index] ?? "")) {
        index += 1;
      }

      const quote = source[index];

      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        const valueEnd = source.indexOf(quote, valueStart);

        if (valueEnd === -1) {
          throw new Error(
            "The generated HTML contains an unterminated script attribute.",
          );
        }

        value = source.slice(valueStart, valueEnd);
        index = valueEnd + 1;
      } else {
        const valueStart = index;

        while (index < source.length && !/[\s>]/.test(source[index])) {
          index += 1;
        }

        if (valueStart === index) {
          throw new Error(
            "The generated HTML contains an empty unquoted script attribute.",
          );
        }

        value = source.slice(valueStart, index);
      }
    }

    attributes.set(name, value);
  }

  return attributes;
}

function isExecutableScript(attributes) {
  if (attributes.has("src")) {
    return false;
  }

  if (!attributes.has("type")) {
    return true;
  }

  const type = attributes.get("type").trim().toLowerCase();

  if (!type) {
    return true;
  }

  return executableScriptTypes.has(type.split(";", 1)[0].trim());
}

export function getInlineExecutableScripts(html) {
  if (typeof html !== "string") {
    throw new TypeError("Generated HTML must be a string.");
  }

  const scripts = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const commentStart = lowerHtml.indexOf("<!--", cursor);
    const possibleScriptStart = lowerHtml.indexOf("<script", cursor);

    if (possibleScriptStart === -1) {
      if (commentStart !== -1) {
        const commentEnd = lowerHtml.indexOf("-->", commentStart + 4);

        if (commentEnd === -1) {
          throw new Error(
            "The generated HTML contains an unterminated comment.",
          );
        }
      }

      break;
    }

    if (commentStart !== -1 && commentStart < possibleScriptStart) {
      const commentEnd = lowerHtml.indexOf("-->", commentStart + 4);

      if (commentEnd === -1) {
        throw new Error("The generated HTML contains an unterminated comment.");
      }

      cursor = commentEnd + 3;
      continue;
    }

    const nameBoundary = lowerHtml[possibleScriptStart + "<script".length];

    if (nameBoundary && !/[\s/>]/.test(nameBoundary)) {
      cursor = possibleScriptStart + "<script".length;
      continue;
    }

    const tagEnd = findTagEnd(html, possibleScriptStart + "<script".length);

    if (tagEnd === -1) {
      throw new Error(
        "The generated HTML contains an unterminated script tag.",
      );
    }

    const closeStart = lowerHtml.indexOf("</script", tagEnd + 1);

    if (closeStart === -1) {
      throw new Error(
        "The generated HTML contains a script without a closing tag.",
      );
    }

    const closeEnd = findTagEnd(html, closeStart + "</script".length);

    if (closeEnd === -1) {
      throw new Error(
        "The generated HTML contains an unterminated script closing tag.",
      );
    }

    const attributes = parseAttributes(
      html.slice(possibleScriptStart + "<script".length, tagEnd),
    );
    const content = html.slice(tagEnd + 1, closeStart);

    if (isExecutableScript(attributes) && content.trim()) {
      scripts.push(content);
    }

    cursor = closeEnd + 1;
  }

  return scripts;
}

export function createScriptHashSource(script) {
  const digest = createHash("sha256").update(script, "utf8").digest("base64");

  return `'sha256-${digest}'`;
}

function patchCspValue(value, hashSources) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("The Vercel CSP header must be a non-empty string.");
  }

  const directives = value
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);
  const directiveNames = new Set();
  let scriptSourceIndex = -1;

  for (const [index, directive] of directives.entries()) {
    const [name] = directive.split(/\s+/, 1);
    const normalizedName = name.toLowerCase();

    if (directiveNames.has(normalizedName)) {
      throw new Error(
        `The Vercel CSP contains duplicate ${normalizedName} directives.`,
      );
    }

    directiveNames.add(normalizedName);

    if (normalizedName === "script-src") {
      scriptSourceIndex = index;
    }
  }

  if (scriptSourceIndex === -1) {
    throw new Error("The Vercel CSP is missing its script-src directive.");
  }

  if (directiveNames.has("script-src-elem")) {
    throw new Error(
      "The Vercel CSP has an unexpected script-src-elem override.",
    );
  }

  const scriptSources = directives[scriptSourceIndex].split(/\s+/).slice(1);
  const unsafeInlineCount = scriptSources.filter(
    (source) => source.toLowerCase() === "'unsafe-inline'",
  ).length;
  const preexistingDynamicSources = scriptSources.filter((source) =>
    /^'(?:nonce-|sha(?:256|384|512)-)/i.test(source),
  );
  const unsafeScriptSources = scriptSources.filter((source) =>
    unsafeScriptSourceTokens.has(source.toLowerCase()),
  );

  if (unsafeInlineCount !== 1) {
    throw new Error(
      "The Vercel CSP script-src must contain exactly one 'unsafe-inline' source before hardening.",
    );
  }

  if (preexistingDynamicSources.length > 0) {
    throw new Error(
      "The Vercel CSP contains an unexpected pre-existing nonce or hash source.",
    );
  }

  if (unsafeScriptSources.length > 0) {
    throw new Error(
      `The Vercel CSP contains unsafe script source(s): ${unsafeScriptSources.join(
        ", ",
      )}.`,
    );
  }

  const remainingSources = scriptSources.filter(
    (source) => source.toLowerCase() !== "'unsafe-inline'",
  );
  directives[scriptSourceIndex] = [
    "script-src",
    ...remainingSources,
    ...hashSources,
  ].join(" ");

  return `${directives.join("; ")}`;
}

function getCspHeaderEntries(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("The Vercel output config must be a JSON object.");
  }

  if (!Array.isArray(config.routes)) {
    throw new Error("The Vercel output config is missing its routes array.");
  }

  const entries = [];

  for (const route of config.routes) {
    if (!route?.headers || typeof route.headers !== "object") {
      continue;
    }

    for (const key of Object.keys(route.headers)) {
      if (key.toLowerCase() === "content-security-policy") {
        entries.push({ headers: route.headers, key });
      }
    }
  }

  if (entries.length === 0) {
    throw new Error(
      "The Vercel output config does not contain a Content-Security-Policy header.",
    );
  }

  return entries;
}

export function hardenVercelOutputCsp({ outputDirectory } = {}) {
  const resolvedOutputDirectory = path.resolve(
    outputDirectory ?? path.join(process.cwd(), ".vercel/output"),
  );
  const htmlPath = path.join(resolvedOutputDirectory, "static/index.html");
  const configPath = path.join(resolvedOutputDirectory, "config.json");

  let html;
  let configSource;

  try {
    html = readFileSync(htmlPath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read generated HTML at ${htmlPath}.`, {
      cause: error,
    });
  }

  try {
    configSource = readFileSync(configPath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read Vercel output config at ${configPath}.`, {
      cause: error,
    });
  }

  let config;

  try {
    config = JSON.parse(configSource);
  } catch (error) {
    throw new Error("The Vercel output config contains malformed JSON.", {
      cause: error,
    });
  }

  const scripts = getInlineExecutableScripts(html);

  if (scripts.length === 0) {
    throw new Error(
      "The generated HTML contains no non-empty inline executable scripts to hash.",
    );
  }

  const hashSources = [...new Set(scripts.map(createScriptHashSource))];
  const cspEntries = getCspHeaderEntries(config);

  for (const { headers, key } of cspEntries) {
    headers[key] = patchCspValue(headers[key], hashSources);
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return {
    configPath,
    hashSources,
    scriptCount: scripts.length,
  };
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) ===
    path.resolve(process.argv[1]);

if (isDirectInvocation) {
  try {
    const outputDirectory = process.argv[2];
    const result = hardenVercelOutputCsp({ outputDirectory });

    process.stdout.write(
      `Hardened ${result.configPath} with ${result.hashSources.length} CSP hash source(s) for ${result.scriptCount} inline script(s).\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Unable to harden the Vercel CSP: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
