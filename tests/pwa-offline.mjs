import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL;
const password = process.env.PLAYWRIGHT_APP_PASSWORD;
assert.ok(
  origin && password,
  "Set PLAYWRIGHT_BASE_URL and PLAYWRIGHT_APP_PASSWORD for the preview deployment.",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const context = await browser.newContext({
  baseURL: origin,
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  colorScheme: "dark",
});
let record;
try {
  const login = await context.request.post("/api/session", {
    data: { password },
  });
  assert.ok(login.ok(), "Preview sign-in failed.");
  const created = await context.request.post("/api/actions", {
    data: {
      action: "study_set.create",
      mutationId: randomUUID(),
      args: {
        rawSet: {
          title: `Offline QA ${randomUUID().slice(0, 8)}`,
          category: "QA",
          cards: [
            {
              id: 1,
              type: "true_false",
              question: "A saved study set works offline.",
              answer: true,
              explanation:
                "Its cached source and study progress remain on this device.",
            },
          ],
        },
      },
    },
  });
  assert.ok(
    created.ok(),
    `Could not create disposable preview fixture (${created.status()}): ${(await created.json()).error}`,
  );
  ({ record } = await created.json());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/sets/${record.slug}`);
  await expect(
    page.getByRole("heading", { name: record.rawSet.title, exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
    }
    await document.fonts.ready;
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          async () =>
            Boolean(
              await globalThis.caches.match(globalThis.location.pathname),
            ) &&
            (
              await Promise.all(
                [
                  ...document.querySelectorAll(
                    'script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]',
                  ),
                ].map((element) =>
                  globalThis.caches.match(element.src || element.href),
                ),
              )
            ).every(Boolean),
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: record.rawSet.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "True", exact: true }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "progress will sync" }),
  ).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  const cachedPaths = await page.evaluate(async () =>
    (
      await Promise.all(
        (await globalThis.caches.keys()).map(async (name) =>
          (await (await globalThis.caches.open(name)).keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        ),
      )
    ).flat(),
  );
  assert.ok(
    cachedPaths.every((path) => !path.startsWith("/api/") && path !== "/login"),
    "API or login data entered the shell cache.",
  );
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const response = await context.request.get("/api/progress");
        return (await response.json()).interactionsBySet?.[record.slug]?.[1]
          ?.selectedAnswer;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS: authenticated preview shell, first-visit offline reload, durable queued answer, reconnect, and no API/login cache.\n",
  );
} finally {
  try {
    await context.setOffline(false);
    if (record) {
      const response = await context.request.get("/api/library");
      const current = (await response.json()).records?.find(
        (item) => item.id === record.id,
      );
      if (current) {
        const removed = await context.request.post("/api/actions", {
          data: {
            action: "study_set.delete",
            mutationId: randomUUID(),
            expectedRevision: current.revision,
            args: { id: record.id },
          },
        });
        assert.ok(removed.ok(), "Could not remove preview fixture.");
      }
    }
  } finally {
    await browser.close();
  }
}
