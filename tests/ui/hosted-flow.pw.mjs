import { test, expect } from "@playwright/test";

import { signInToPreview, resetOwnerSession } from "./owner-session.mjs";
test.beforeEach(async ({ page }) => signInToPreview(page));

const cards = [
  {
    id: 1,
    type: "true_false",
    question: "Cells divide.",
    answer: true,
    explanation: "Mitosis divides cells.",
  },
  {
    id: 2,
    type: "multiple_choice",
    question: "Which stores DNA?",
    options: { A: "Nucleus", B: "Membrane" },
    answer: "A",
    explanation: "DNA is in the nucleus.",
  },
  {
    id: 3,
    type: "multiple_response",
    question: "Which are cell parts?",
    options: { A: "Nucleus", B: "Membrane", C: "Mountain" },
    answer: ["A", "B"],
    explanation: "Cells contain a nucleus and a membrane.",
  },
  {
    id: 4,
    type: "fill_in_the_blank",
    question: "The ___ contains DNA.",
    answer: ["nucleus"],
    explanation: "DNA is stored in the nucleus.",
  },
  {
    id: 5,
    type: "ordering",
    question: "Order the stages.",
    unordered_items: ["Divide", "Grow"],
    answer: ["Grow", "Divide"],
    explanation: "Growth precedes division.",
  },
  {
    id: 6,
    type: "matching",
    question: "Match cell parts.",
    prompts: ["Nucleus", "Membrane"],
    choices: ["Stores DNA", "Boundary"],
    answer: [
      { prompt: "Nucleus", choices: ["Stores DNA"] },
      { prompt: "Membrane", choices: ["Boundary"] },
    ],
    explanation: "These parts have distinct functions.",
  },
  {
    id: 7,
    type: "short_answer",
    question: "What is mitosis?",
    answer: "Cell division",
    explanation: "Mitosis produces daughter cells.",
  },
];
function fixture() {
  return {
    id: "set-1",
    slug: "biology",
    revision: 1,
    source: { type: "generated" },
    importedAt: "2026-10-31T00:00:00Z",
    updatedAt: "2026-10-31T00:00:00Z",
    rawSet: {
      title: "Biology",
      category: "Science",
      cards: globalThis.structuredClone(cards),
    },
  };
}
async function mockApp(page, extra) {
  let record = fixture();
  let previous;
  const actions = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/session") {
      return route.continue();
    }
    let result = await extra?.({ path, request, record });
    if (result === undefined) {
      if (path === "/api/capabilities") {
        result = {
          server: true,
          agent: false,
          pdfCleanup: true,
          authenticated: true,
        };
      } else if (path === "/api/auth/session") {
        result = { authenticated: true };
      } else if (path === "/api/library") {
        result = { records: [record], revision: record.revision };
      } else if (path === "/api/favorites") {
        result = { favorites: [] };
      } else if (path === "/api/progress") {
        result = { interactionsBySet: {} };
      } else if (path === "/api/settings") {
        result = {
          openRouterConfigured: true,
          model: "anthropic/claude-haiku-5.5",
        };
      } else if (path === "/api/actions") {
        const body = request.postDataJSON();
        actions.push(body);
        if (body.action === "study_set.update") {
          expect(body.expectedRevision).toBe(record.revision);
          previous = globalThis.structuredClone(record);
          const { upsertCards, removeCardIds, ...rest } = body.args.patch;
          record.rawSet = {
            ...record.rawSet,
            ...rest,
            cards: record.rawSet.cards
              .filter((card) => !removeCardIds?.includes(card.id))
              .map(
                (card) =>
                  upsertCards?.find((next) => next.id === card.id) || card,
              ),
          };
          record.revision++;
        } else if (body.action === "library.undo") {
          record = previous;
          record.revision++;
        }
        result = {
          mutationId: body.mutationId,
          record,
          revision: record.revision,
        };
      } else {
        result = {};
      }
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  return { actions, record: () => record };
}
async function capture(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

test("whole-source form survives reload of a generation job", async ({
  page,
}, testInfo) => {
  const sourceText =
    "Chapter excerpt\nNucleus stores DNA. Membrane forms the boundary.\nEnd of supplied section.";
  let sentText;
  let payload;
  let starts = 0;
  let complete = false;
  const source = { id: "source-1", name: "Pasted text", status: "ready" };
  const job = {
    id: "job-1",
    sourceId: source.id,
    status: "generating",
    questionCount: 3,
    cardTypes: ["short_answer"],
  };
  await mockApp(page, ({ path, request, record }) => {
    if (path === "/api/sources") {
      return { sources: [] };
    }
    if (path === "/api/sources/text") {
      sentText = request.postDataJSON().text;
      return { source };
    }
    if (path === "/api/generation/jobs") {
      if (request.method() === "POST") {
        payload = request.postDataJSON();
        starts++;
        return { job };
      }
      return { jobs: starts ? [job] : [] };
    }
    if (path === "/api/generation/jobs/job-1") {
      return {
        job: complete
          ? { ...job, status: "completed", resultRecord: record }
          : job,
      };
    }
  });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|violates.*script-src/i.test(message.text())
    ) {
      browserErrors.push(message.text());
    }
  });
  const documentResponse = await page.goto("/generate");
  const csp = documentResponse.headers()["content-security-policy"];
  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  await page.getByRole("radio", { name: "Paste text", exact: true }).click();
  await page.getByRole("textbox", { name: "Source text" }).fill(sourceText);
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.uncheck();
  }
  await page
    .getByRole("checkbox", { name: "Short Answer", exact: true })
    .check();
  await page.getByLabel("Cards", { exact: true }).fill("3");
  await capture(page, testInfo, "generation-form");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page).toHaveURL(/job=job-1/);
  expect(sentText).toBe(sourceText);
  expect(payload.cardTypes).toEqual(["short_answer"]);
  expect(payload.questionCount).toBe(3);
  expect(payload.mutationId).toBeTruthy();
  expect(payload).not.toHaveProperty("scope");
  await page.reload();
  await expect(
    page.getByText("Generating cards", { exact: true }).first(),
  ).toBeVisible();
  complete = true;
  await expect(page).toHaveURL(/sets\/biology/);
  expect(starts).toBe(1);
  expect(browserErrors).toEqual([]);
  const finalResponse = await page.reload();
  const finalCsp = finalResponse.headers()["content-security-policy"];
  const finalNonce = finalCsp?.match(/'nonce-([^']+)'/)?.[1];
  expect(finalNonce).toBeTruthy();
  const inlineNonces = await page
    .locator("script:not([src])")
    .evaluateAll((scripts) =>
      scripts
        .filter(
          (script) =>
            script.textContent.trim() &&
            !["application/json", "application/ld+json"].includes(script.type),
        )
        .map((script) => script.nonce),
    );
  expect(inlineNonces.length).toBeGreaterThan(0);
  expect(inlineNonces.every((value) => value === finalNonce)).toBe(true);
});

test("rename, move and all seven editors save through revisioned actions", async ({
  page,
}, testInfo) => {
  const app = await mockApp(page);
  await page.goto("/sets/biology");
  await page.getByRole("button", { name: "Edit Biology", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Cell study");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cell study", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Cell study", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .fill("Science/Cells");
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.locator("p").filter({ hasText: /^Science\s*\/\s*Cells$/ }),
  ).toBeVisible();
  for (const card of cards) {
    await page
      .getByRole("button", { name: `Edit card ${card.id}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit card", exact: true });
    await dialog
      .getByRole("textbox", { name: "Question", exact: true })
      .fill(`${card.question} Edited`);
    if (card.type === "matching") {
      await dialog
        .getByRole("textbox", { name: "Prompts 1", exact: true })
        .fill("Cell nucleus");
      await dialog
        .getByRole("textbox", { name: "Choices 2", exact: true })
        .fill("Outer boundary");
      await capture(page, testInfo, "matching-editor");
    }
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      app.record().rawSet.cards.find((item) => item.id === card.id).question,
    ).toBe(`${card.question} Edited`);
  }
  expect(app.record().slug).toBe("biology");
  const matching = app
    .record()
    .rawSet.cards.find((card) => card.type === "matching");
  expect(matching.answer).toEqual([
    { prompt: "Cell nucleus", choices: ["Stores DNA"] },
    { prompt: "Membrane", choices: ["Outer boundary"] },
  ]);
  await capture(page, testInfo, "edited-reader");
});

test("sign out clears private browser data and closes other signed-in tabs", async ({
  page,
  context,
}) => {
  await mockApp(page);
  await page.goto("/settings");
  await expect(page.getByPlaceholder("Key saved")).toBeVisible();
  const other = await context.newPage();
  await mockApp(other);
  await other.goto("/sets/biology");
  await expect(
    other.getByRole("heading", { name: "Biology", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    globalThis.localStorage.setItem(
      "lumina:private-draft",
      "private source text",
    );
    globalThis.sessionStorage.setItem("private-source", "private source text");
    const cache = await globalThis.caches.open("lumina-app-shell-test");
    await cache.put(
      "/private-fixture",
      new globalThis.Response("private source text"),
    );
    await new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open("lumina-private-source", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("source");
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(other).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() =>
      globalThis.localStorage.getItem("lumina:private-draft"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      globalThis.sessionStorage.getItem("private-source"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(async () =>
      (await globalThis.indexedDB.databases()).filter((database) =>
        database.name.startsWith("lumina"),
      ),
    ),
  ).toEqual([]);
  expect(await page.evaluate(async () => globalThis.caches.keys())).toEqual([]);
  resetOwnerSession();
});
