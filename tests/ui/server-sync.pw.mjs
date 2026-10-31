import { test, expect } from "@playwright/test";
import { signInToPreview } from "./owner-session.mjs";
test.beforeEach(async ({ page }) => signInToPreview(page));

test.use({ serviceWorkers: "block" });

const record = {
  id: "set-1",
  slug: "biology",
  revision: 1,
  source: { type: "generated" },
  importedAt: "2026-10-03T00:00:00Z",
  updatedAt: "2026-10-03T00:00:00Z",
  rawSet: {
    title: "Biology",
    category: "Science",
    cards: [
      {
        id: 1,
        type: "true_false",
        question: "Cells divide.",
        answer: true,
        explanation: "Mitosis produces daughter cells.",
      },
    ],
  },
};

test("cached server cards and queued answers survive an API outage and reload", async ({
  page,
}) => {
  let offline = false;
  let unavailable = false;
  let progressRead = 0;
  let progress = {};
  let resetSnapshot;
  let resetMutationId;
  const receivedMutations = new Set();
  await page.route("**/api/**", async (route) => {
    if (unavailable) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server unavailable" }),
      });
    }
    if (offline) {
      return route.abort("internetdisconnected");
    }
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let result = {};
    if (path === "/api/capabilities") {
      result = { server: true, agent: true, pdfCleanup: true };
    } else if (path === "/api/library") {
      result = { records: [record], revision: 1 };
    } else if (path === "/api/favorites") {
      result = { favorites: [] };
    } else if (path === "/api/progress") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        receivedMutations.add(body.mutationId);
        progress[body.slug] ??= {};
        progress[body.slug][body.cardId] = body.patch;
      } else {
        progressRead++;
      }
      result = { interactionsBySet: progress };
    } else if (path === "/api/actions") {
      const body = request.postDataJSON();
      if (body.action === "progress.reset") {
        resetSnapshot = JSON.parse(JSON.stringify(progress));
        progress = {};
        resetMutationId = body.mutationId;
      } else if (body.action === "library.undo") {
        expect(body.args.mutationId).toBe(resetMutationId);
        progress = resetSnapshot;
      }
      result = { revision: 1, mutationId: body.mutationId };
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("/sets/biology");
  await expect(
    page.getByRole("heading", { name: "Biology", exact: true }),
  ).toBeVisible();
  await expect.poll(() => progressRead).toBeGreaterThan(0);
  offline = true;
  await page.getByRole("radio", { name: "True", exact: true }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "progress will sync" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Biology", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  expect(receivedMutations.size).toBe(0);
  offline = false;
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await expect.poll(() => progress.biology?.[1]?.selectedAnswer).toBe(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Offline" }),
  ).toHaveCount(0);
  expect(receivedMutations.size).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Open study set menu" }).click();
  const panel = page.getByRole("dialog", { name: "Study sets", exact: true });
  await panel.getByRole("button", { name: "Reset study set progress" }).click();
  await expect(
    panel.getByRole("button", { name: "Reset study set progress" }),
  ).toHaveCount(0);
  await expect(page.getByText("Reset this set?", { exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  expect(receivedMutations.size).toBe(1);
  unavailable = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Biology", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
});

test("server favorites survive returning home and an offline reload", async ({
  page,
}) => {
  let favorites = [{ type: "set", slug: record.slug }];
  const writes = [];
  let offline = false;
  await page.route("**/api/**", async (route) => {
    if (offline) {
      return route.abort("internetdisconnected");
    }
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let result = {};
    if (path === "/api/capabilities") {
      result = { server: true, agent: true, pdfCleanup: true };
    } else if (path === "/api/library") {
      result = { records: [record], revision: 1 };
    } else if (path === "/api/favorites") {
      if (request.method() === "PUT") {
        favorites = request.postDataJSON().favorites;
        writes.push(favorites);
      }
      result = { favorites };
    } else if (path === "/api/progress") {
      result = { interactionsBySet: {} };
    } else if (path === "/api/actions") {
      result = { revision: 1, mutationId: request.postDataJSON().mutationId };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("/sets/biology");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(window.localStorage.getItem("lumina:study-favorites")),
      ),
    )
    .toEqual([{ type: "set", slug: record.slug }]);
  await page
    .getByRole("link", { name: "Open start screen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Study sets", exact: true }),
  ).toBeVisible();
  // Wait for a subsequent sync, which must not echo the route hydration.
  const refreshed = page.waitForResponse((response) =>
    response.url().endsWith("/api/progress"),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await refreshed;
  await expect(
    page.getByRole("button", { name: "Unfavorite Biology", exact: true }),
  ).toBeVisible();
  expect(favorites).toEqual([{ type: "set", slug: record.slug }]);
  expect(writes).toEqual([]);
  offline = true;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfavorite Biology", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("a fresh server client recovers after capability discovery fails", async ({
  page,
}) => {
  let unavailable = true;
  let capabilitiesReads = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/capabilities") {
      capabilitiesReads++;
      if (unavailable) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Server unavailable" }),
        });
      }
    }
    const result =
      path === "/api/capabilities"
        ? { server: true, agent: true, pdfCleanup: true }
        : path === "/api/library"
          ? { records: [record], revision: 1 }
          : path === "/api/progress"
            ? { interactionsBySet: {}, revision: 1 }
            : path === "/api/favorites"
              ? { favorites: [], revision: 1 }
              : {
                  mutationId: route.request().postDataJSON()?.mutationId,
                  revision: 1,
                };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("/");
  await expect.poll(() => capabilitiesReads).toBe(1);
  // An unavailable capability endpoint must not switch this hosted app to local storage.
  await expect(
    page.getByRole("heading", { name: "Study sets", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Generate cards", exact: true }),
  ).toBeVisible();
  unavailable = false;
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await expect(
    page.getByRole("link", { name: "Generate cards", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Biology. Science", exact: true }),
  ).toBeVisible();
  expect(capabilitiesReads).toBe(2);
});

test("reader refreshes server edits and leaves a deleted set", async ({
  page,
}) => {
  let currentRecord = globalThis.structuredClone(record);
  let revision = 1;
  let progress = {};
  let progressReads = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let result = {};
    if (path === "/api/capabilities") {
      result = { server: true, agent: true };
    }
    if (path === "/api/library") {
      result = { records: currentRecord ? [currentRecord] : [], revision };
    }
    if (path === "/api/favorites") {
      result = { favorites: [], revision };
    }
    if (path === "/api/progress") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        expect(JSON.parse(body.cardVersion)).toEqual(
          currentRecord.rawSet.cards[0],
        );
        progress = { [body.slug]: { [body.cardId]: body.patch } };
      } else {
        progressReads++;
      }
      result = { interactionsBySet: progress, revision };
    }
    if (path === "/api/actions") {
      result = { mutationId: request.postDataJSON().mutationId, revision };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("/sets/biology");
  await expect(
    page.getByRole("heading", { name: "Cells divide.", exact: true }),
  ).toBeVisible();
  await expect.poll(() => progressReads).toBeGreaterThan(0);
  currentRecord = {
    ...currentRecord,
    revision: ++revision,
    rawSet: {
      ...currentRecord.rawSet,
      cards: [{ ...currentRecord.rawSet.cards[0], question: "Cells change." }],
    },
  };
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await expect(
    page.getByRole("heading", { name: "Cells change.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cells divide.", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "True", exact: true }).check();
  await expect.poll(() => progress.biology?.[1]?.selectedAnswer).toBe(true);
  currentRecord = null;
  progress = {};
  revision++;
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "Generate cards", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import set", exact: true }),
  ).toBeVisible();
});

test("two offline tabs keep the most recent text answer and drain it once", async ({
  page,
  context,
}) => {
  const textRecord = {
    ...record,
    rawSet: {
      ...record.rawSet,
      cards: [
        {
          id: 1,
          type: "short_answer",
          question: "What divides?",
          answer: "Cells",
          explanation: "Cells divide.",
        },
      ],
    },
  };
  let offline = false;
  let progress = {};
  let progressReads = 0;
  const writes = [];
  await context.route("**/api/**", async (route) => {
    if (offline) {
      return route.abort("internetdisconnected");
    }
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let result = {};
    if (path === "/api/capabilities") {
      result = { server: true, agent: true };
    }
    if (path === "/api/library") {
      result = { records: [textRecord], revision: 1 };
    }
    if (path === "/api/favorites") {
      result = { favorites: [], revision: 1 };
    }
    if (path === "/api/progress") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        writes.push(body);
        progress = { [body.slug]: { [body.cardId]: body.patch } };
      } else {
        progressReads++;
      }
      result = { interactionsBySet: progress, revision: 1 };
    }
    if (path === "/api/actions") {
      result = { mutationId: request.postDataJSON().mutationId, revision: 1 };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  const readQueuedAnswer = (tab) =>
    tab.evaluate(async () => {
      const storage = await new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open("lumina-sync", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise((resolve, reject) => {
          const request = storage
            .transaction("outbox")
            .objectStore("outbox")
            .getAll();
          request.onsuccess = () =>
            resolve(request.result.at(-1)?.body.patch?.response);
          request.onerror = () => reject(request.error);
        });
      } finally {
        storage.close();
      }
    });
  await page.goto("/sets/biology");
  await expect(
    page.getByRole("textbox", { name: "What divides?", exact: true }),
  ).toBeVisible();
  await expect.poll(() => progressReads).toBeGreaterThan(0);
  const newer = await context.newPage();
  await newer.goto("/sets/biology");
  await expect(
    newer.getByRole("textbox", { name: "What divides?", exact: true }),
  ).toBeVisible();
  await expect.poll(() => progressReads).toBeGreaterThan(1);
  offline = true;
  await newer
    .getByRole("textbox", { name: "What divides?", exact: true })
    .fill("Earlier answer");
  await expect.poll(() => readQueuedAnswer(newer)).toBe("Earlier answer");
  await page
    .getByRole("textbox", { name: "What divides?", exact: true })
    .fill("Final answer");
  await expect.poll(() => readQueuedAnswer(page)).toBe("Final answer");
  // Reload before the typing debounce expires: the final draft is already durable.
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "What divides?", exact: true }),
  ).toHaveValue("Final answer");
  offline = false;
  await Promise.all(
    [page, newer].map((tab) =>
      tab.evaluate(() => window.dispatchEvent(new globalThis.Event("online"))),
    ),
  );
  await expect.poll(() => progress.biology?.[1]?.response).toBe("Final answer");
  await expect(
    page.getByRole("textbox", { name: "What divides?", exact: true }),
  ).toHaveValue("Final answer");
  await expect(
    newer.getByRole("textbox", { name: "What divides?", exact: true }),
  ).toHaveValue("Final answer");
  expect(writes.map((body) => body.patch.response)).toEqual(["Final answer"]);
  await newer.close();
});
