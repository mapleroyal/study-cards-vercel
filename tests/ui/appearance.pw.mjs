import { test, expect } from "@playwright/test";
import { signInToPreview } from "./owner-session.mjs";

test.use({ serviceWorkers: "block" });

async function mockLibrary(page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session") {
      return route.continue();
    }
    const results = {
      "/api/capabilities": { server: true, agent: false, authenticated: true },
      "/api/library": { records: [], revision: 1 },
      "/api/progress": { interactionsBySet: {}, revision: 1 },
      "/api/favorites": { favorites: [], revision: 1 },
    };
    await route.fulfill({ json: results[path] || {} });
  });
}

test("anonymous login data loads while owner documents and APIs remain protected", async ({
  page,
}) => {
  await page.context().clearCookies();
  const documentResponse = await page.request.get("/login", {
    maxRedirects: 0,
  });
  expect(documentResponse.status()).toBe(200);
  const policy = documentResponse.headers()["content-security-policy"];
  expect(policy).toContain("script-src 'self' 'nonce-");
  expect(policy).not.toContain("'unsafe-eval'");
  for (const path of ["/login.data", "/login/_.data"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"]).not.toContain("text/html");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  for (const path of [
    "/",
    "/_.data",
    "/settings",
    "/settings.data",
    "/settings/_.data",
    "/login/settings.data",
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(302);
    expect(new URL(response.headers().location).pathname).toBe("/login");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  for (const path of [
    "/api/library",
    "/api/settings",
    "/api/sources",
    "/api/generation/jobs",
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(401);
  }
  await page.goto("/login");
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

// Hold the application modules while allowing the actual app bootstrap and CSS.
// This observes the prerendered document, before React/ThemeSync can repair it.
test("app paints dark before hydration and the appearance control persists explicit and system choices", async ({
  page,
}, testInfo) => {
  const system = testInfo.project.use.colorScheme;
  const initial = system === "light" ? "dark" : "system";
  await page.addInitScript(
    ({ initial: startupTheme }) => {
      if (!globalThis.localStorage.getItem("appearance-test-initialized")) {
        if (startupTheme === "dark") {
          globalThis.localStorage.setItem("lumina:theme", startupTheme);
        } else {
          globalThis.localStorage.removeItem("lumina:theme");
        }
        globalThis.localStorage.setItem("appearance-test-initialized", "true");
      }
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const sample = (element) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle =
          globalThis.getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };
      globalThis.__appearanceFrames = [];
      function capture() {
        if (
          document.body &&
          Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(
            (link) => link.sheet,
          )
        ) {
          globalThis.__appearanceFrames.push({
            html: sample(document.documentElement),
            body: sample(document.body),
          });
        }
        if (
          !globalThis.__stopAppearanceCapture &&
          globalThis.__appearanceFrames.length < 240
        ) {
          globalThis.requestAnimationFrame(capture);
        }
      }
      globalThis.requestAnimationFrame(capture);
    },
    { initial },
  );
  await signInToPreview(page);
  await mockLibrary(page);
  let release;
  const modules = new Promise((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route("**/assets/*.js", async (route) => {
    held += 1;
    await modules;
    await route.continue();
  });
  try {
    const response = await page.goto("/", { waitUntil: "commit" });
    const policy = response.headers()["content-security-policy"];
    const nonce = /script-src[^;]*\x27nonce-([^\x27]+)\x27/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    const inlineNonces = await page
      .locator("script:not([src])")
      .evaluateAll((scripts) =>
        scripts
          .filter((script) => script.textContent.trim())
          .map((script) => script.nonce),
      );
    expect(inlineNonces.length).toBeGreaterThan(0);
    expect(inlineNonces.every((value) => value === nonce)).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => globalThis.__appearanceFrames?.length ?? 0),
      )
      .toBeGreaterThan(1);
    expect(held).toBeGreaterThan(0);
    await expect(
      page.getByRole("progressbar", { name: "Loading", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Study sets", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#181818",
    );
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Study sets", exact: true }),
  ).toBeVisible();
  const frames = await page.evaluate(() => {
    globalThis.__stopAppearanceCapture = true;
    return globalThis.__appearanceFrames;
  });
  // WebKit's document.fonts.ready waits for the held module graph to finish.
  // Capture the screenshot after release; pre-hydration paint is already
  // sampled above while React cannot run, and every sampled frame is checked.
  await page.screenshot({
    path: testInfo.outputPath("hydrated-dark.png"),
    animations: "disabled",
  });
  for (const frame of frames) {
    for (const paint of [frame.html, frame.body]) {
      expect(paint[3]).toBe(255);
      expect(Math.max(...paint.slice(0, 3))).toBeLessThan(40);
    }
  }
  const openAppearance = async () => {
    await page
      .getByRole("button", { name: "Open study set menu", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Study sets", exact: true }),
    ).toBeVisible();
  };
  await openAppearance();
  await expect(
    page.getByRole("radio", {
      name: initial === "dark" ? "Dark" : "System",
      exact: true,
    }),
  ).toBeChecked();
  for (const [label, dark] of [
    ["Light", false],
    ["Dark", true],
    ["System", system === "dark"],
  ]) {
    await page.getByRole("radio", { name: label, exact: true }).check();
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((element) => element.classList.contains("dark")),
      )
      .toBe(dark);
    await expect
      .poll(() =>
        page.evaluate(() => globalThis.localStorage.getItem("lumina:theme")),
      )
      .toBe(label.toLowerCase());
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Study sets", exact: true }),
    ).toBeVisible();
    await openAppearance();
    await expect(
      page.getByRole("radio", { name: label, exact: true }),
    ).toBeChecked();
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((element) => element.classList.contains("dark")),
      )
      .toBe(dark);
  }
  await page.emulateMedia({
    colorScheme: system === "dark" ? "light" : "dark",
  });
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) => element.classList.contains("dark")),
    )
    .toBe(system !== "dark");
  await expect(
    page.getByRole("radio", { name: "System", exact: true }),
  ).toBeChecked();
});
