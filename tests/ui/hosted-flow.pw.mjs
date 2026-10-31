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
const defaultSelection = {
  model: "anthropic/claude-sonnet-5.5",
  reasoningEffort: "xhigh",
};
const modelCatalog = {
  defaultSelection,
  models: [
    {
      id: defaultSelection.model,
      name: "Anthropic: Claude Sonnet 5.5",
      variants: ["xhigh", "max", "high", "medium", "low"],
      defaultVariant: "xhigh",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      reasoning: true,
    },
    {
      id: "anthropic/claude-haiku-5.5",
      name: "Anthropic: Claude Haiku 5.5",
      variants: ["high", "medium", "low"],
      defaultVariant: "medium",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      reasoning: true,
    },
  ],
};
async function mockApp(page, extra, { openRouterConfigured = true } = {}) {
  let record = fixture();
  let previous;
  const actions = [];
  let settings = { openRouterConfigured, ...defaultSelection };
  const settingsUpdates = [];
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
      } else if (path === "/api/sources") {
        result = { sources: [] };
      } else if (path === "/api/generation/jobs") {
        result = { jobs: [] };
      } else if (path === "/api/models") {
        result = modelCatalog;
      } else if (path === "/api/settings") {
        if (request.method() === "PUT") {
          const selection = request.postDataJSON();
          settingsUpdates.push(selection);
          const { openRouterKey, ...preferences } = selection;
          settings = {
            ...settings,
            ...preferences,
            ...(Object.hasOwn(selection, "openRouterKey")
              ? { openRouterConfigured: Boolean(openRouterKey?.trim()) }
              : {}),
          };
        }
        result = settings;
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
  return {
    actions,
    record: () => record,
    settings: () => settings,
    settingsUpdates,
  };
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
  expect(payload).toMatchObject(defaultSelection);
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

test("rename, move and all seven editors save and export portable JSON", async ({
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
  const saved = globalThis.structuredClone(app.record().rawSet);
  const actionCount = app.actions.length;
  async function exportSavedSet() {
    await page
      .getByRole("button", { name: "Edit Cell study", exact: true })
      .click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Export", exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("study-cards-cell-study.json");
    const stream = await download.createReadStream();
    let content = "";
    for await (const chunk of stream) {
      content += chunk.toString();
    }
    expect(JSON.parse(content)).toEqual(saved);
    expect(app.actions).toHaveLength(actionCount);
  }
  await exportSavedSet();
  await page.goto("/");
  await exportSavedSet();
});

test("an empty library has two centered actions and generation asks quietly for a missing key", async ({
  page,
}, testInfo) => {
  let generationStarts = 0;
  let releaseRemoval;
  const removalGate = new Promise((resolve) => {
    releaseRemoval = resolve;
  });
  const app = await mockApp(
    page,
    async ({ path, request }) => {
      if (
        path === "/api/settings" &&
        request.method() === "PUT" &&
        request.postDataJSON().openRouterKey === ""
      ) {
        await removalGate;
      }
      if (path === "/api/library") {
        return { records: [], revision: 1 };
      }
      if (path === "/api/generation/jobs" && request.method() === "POST") {
        generationStarts++;
        return { job: { id: "unexpected", status: "failed" } };
      }
    },
    { openRouterConfigured: false },
  );
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", { name: "Generate cards", exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Import set", exact: true }),
  ).toBeVisible();
  await expect(main.locator("a, button")).toHaveCount(2);
  await expect(main.getByRole("heading")).toHaveCount(0);
  await expect(main.locator("p")).toHaveCount(0);
  await expect(
    main
      .getByRole("link", { name: "Generate cards", exact: true })
      .locator("svg"),
  ).toHaveCount(1);
  const mainBox = await main.boundingBox();
  const actionsBox = await main.locator("div").first().boundingBox();
  expect(
    Math.abs(
      actionsBox.y + actionsBox.height / 2 - (mainBox.y + mainBox.height / 2),
    ),
  ).toBeLessThan(3);
  await capture(page, testInfo, "empty-library");
  await main.getByRole("link", { name: "Generate cards", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "OpenRouter key",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Get a key", exact: true }),
  ).toHaveAttribute("href", "https://openrouter.ai/settings/keys");
  await capture(page, testInfo, "key-onboarding");
  await dialog
    .getByLabel("API key", { exact: true })
    .fill("  sk-or-v1-fixture-key  ");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(app.settingsUpdates).toEqual([
    { openRouterKey: "sk-or-v1-fixture-key" },
  ]);
  expect(app.settings()).toMatchObject({
    openRouterConfigured: true,
    ...defaultSelection,
  });
  expect(app.settings()).not.toHaveProperty("openRouterKey");
  await page.getByRole("radio", { name: "Paste text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Source text", exact: true })
    .fill("A short supplied section.");
  await expect(
    page.getByRole("button", { name: "Generate", exact: true }),
  ).toBeEnabled();
  expect(generationStarts).toBe(0);
  await page.reload();
  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Remove key", exact: true }).click();
  try {
    await expect(
      page.getByRole("button", { name: "Removing…", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("OpenRouter API key", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseRemoval();
  }
  await expect(
    page.getByRole("button", { name: "Remove key", exact: true }),
  ).toHaveCount(0);
  expect(app.settings()).toMatchObject({
    openRouterConfigured: false,
    ...defaultSelection,
  });
  expect(app.settingsUpdates).toEqual([
    { openRouterKey: "sk-or-v1-fixture-key" },
    { openRouterKey: "" },
  ]);
  await page.reload();
  await expect(page.getByPlaceholder("sk-or-…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove key", exact: true }),
  ).toHaveCount(0);
  const headerGenerate = page.getByRole("link", {
    name: "Generate cards",
    exact: true,
  });
  await expect(headerGenerate.locator("svg")).toHaveCount(1);
  await headerGenerate.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("API key", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Open study set menu", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Study sets", exact: true });
  const panelGenerate = panel.getByRole("link", {
    name: "Generate cards",
    exact: true,
  });
  await expect(panelGenerate.locator("svg")).toHaveCount(1);
  await panelGenerate.click();
  await expect(panel).toBeHidden();
  await expect(dialog).toBeVisible();
  expect(generationStarts).toBe(0);
});

test("model and reasoning preferences persist between Settings and Generate without a key", async ({
  page,
}, testInfo) => {
  const app = await mockApp(page, undefined, { openRouterConfigured: false });
  await page.goto("/settings");
  const model = page.getByLabel("Model", { exact: true });
  const effort = page.getByLabel("Reasoning effort", { exact: true });
  await expect(model).toContainText("Claude Sonnet 5.5");
  await expect(effort).toHaveText("xhigh");
  await model.click();
  await page.getByLabel("Search models", { exact: true }).fill("Haiku");
  await page
    .getByRole("option", { name: "Anthropic: Claude Haiku 5.5", exact: true })
    .click();
  await expect(model).toContainText("Claude Haiku 5.5");
  await expect(effort).toHaveText("medium");
  await effort.click();
  await page.getByRole("option", { name: "low", exact: true }).click();
  await expect(effort).toHaveText("low");
  await page.goto("/generate");
  const keyDialog = page.getByRole("dialog", {
    name: "OpenRouter key",
    exact: true,
  });
  await expect(keyDialog).toBeVisible();
  await keyDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(model).toContainText("Claude Haiku 5.5");
  await expect(effort).toHaveText("low");
  await model.click();
  await page.getByLabel("Search models", { exact: true }).fill("Sonnet");
  await page
    .getByRole("option", { name: "Anthropic: Claude Sonnet 5.5", exact: true })
    .click();
  await expect(effort).toHaveText("low");
  await effort.click();
  await page.getByRole("option", { name: "xhigh", exact: true }).click();
  await expect(effort).toHaveText("xhigh");
  await capture(page, testInfo, "generation-model");
  await page.reload();
  await expect(keyDialog).toBeVisible();
  await keyDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(model).toContainText("Claude Sonnet 5.5");
  await expect(effort).toHaveText("xhigh");
  expect(app.settings()).toMatchObject({
    openRouterConfigured: false,
    ...defaultSelection,
  });
  expect(app.settingsUpdates).toEqual([
    { model: "anthropic/claude-haiku-5.5", reasoningEffort: "medium" },
    { model: "anthropic/claude-haiku-5.5", reasoningEffort: "low" },
    { model: "anthropic/claude-sonnet-5.5", reasoningEffort: "low" },
    defaultSelection,
  ]);
  expect(
    app.settingsUpdates.every(
      (selection) => !Object.hasOwn(selection, "openRouterKey"),
    ),
  ).toBe(true);
});

test("global shuffle changes update another reader tab and clear per-set overrides", async ({
  page,
  context,
}) => {
  await mockApp(page);
  await page.goto("/sets/biology");
  const shuffle = page.getByRole("button", {
    name: "Shuffle questions",
    exact: true,
  });
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");
  const order = () =>
    page
      .getByRole("article")
      .evaluateAll((elements) =>
        elements.map((element) => Number(element.dataset.studyCardId)),
      );
  const savedOrder = await order();
  const sourceOrder = cards.map((card) => card.id);
  const settingsPage = await context.newPage();
  await mockApp(settingsPage);
  await settingsPage.goto("/settings");
  const globalShuffle = settingsPage.getByRole("switch", {
    name: "Shuffle cards",
    exact: true,
  });
  await expect(globalShuffle).toBeChecked();
  const anchorId = savedOrder.find(
    (id, index) =>
      [3, 4, 5].includes(id) && index > 0 && index < savedOrder.length - 1,
  );
  const anchor = page.locator(`[data-study-card-id="${anchorId}"]`);
  await anchor.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  const anchorTop = (await anchor.boundingBox()).y;
  await globalShuffle.uncheck();
  await expect(shuffle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(order).toEqual(sourceOrder);
  await expect
    .poll(async () => Math.abs((await anchor.boundingBox()).y - anchorTop))
    .toBeLessThan(4);
  await shuffle.click();
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(order).toEqual(savedOrder);
  await expect(globalShuffle).not.toBeChecked();
  await globalShuffle.check();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(globalThis.localStorage.getItem("lumina:study-reader"))
            .shuffleOverrides,
      ),
    )
    .toEqual({});
  await settingsPage.reload();
  await expect(globalShuffle).toBeChecked();
  await page.reload();
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(order).toEqual(savedOrder);
});

test("enabling global shuffle creates the first saved order in an open reader", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    if (!globalThis.localStorage.getItem("lumina:study-reader")) {
      globalThis.localStorage.setItem(
        "lumina:study-reader",
        JSON.stringify({ defaultShuffleEnabled: false }),
      );
    }
  });
  await mockApp(page);
  await page.goto("/sets/biology");
  const shuffle = page.getByRole("button", {
    name: "Shuffle questions",
    exact: true,
  });
  await expect(shuffle).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(globalThis.localStorage.getItem("lumina:study-reader"))
          .questionOrders?.biology,
    ),
  ).toBeUndefined();
  const settingsPage = await context.newPage();
  await mockApp(settingsPage);
  await settingsPage.goto("/settings");
  const globalShuffle = settingsPage.getByRole("switch", {
    name: "Shuffle cards",
    exact: true,
  });
  await expect(globalShuffle).not.toBeChecked();
  await globalShuffle.check();
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          globalThis.localStorage.getItem("lumina:study-reader"),
        ).questionOrders?.biology?.toSorted((a, b) => a - b),
      ),
    )
    .toEqual(cards.map((card) => card.id));
});

test("recent generations omit deleted sets while pending and failed jobs remain usable", async ({
  page,
}) => {
  const jobs = [
    {
      id: "deleted",
      status: "completed",
      sourceId: "deleted-source",
      resultRecord: null,
    },
    { id: "pending", status: "queued", sourceId: "pending-source" },
    {
      id: "failed",
      status: "failed",
      sourceId: "failed-source",
      error: "Temporary provider failure",
    },
  ];
  let deletedReads = 0;
  await mockApp(page, ({ path }) => {
    if (path === "/api/sources") {
      return {
        sources: [
          { id: "deleted-source", name: "Deleted set source", status: "ready" },
          { id: "pending-source", name: "Pending source", status: "ready" },
          { id: "failed-source", name: "Failed source", status: "ready" },
        ],
      };
    }
    if (path === "/api/generation/jobs") {
      return { jobs };
    }
    if (path.startsWith("/api/generation/jobs/")) {
      const job = jobs.find((item) => item.id === path.split("/").at(-1));
      if (job.id === "deleted") {
        deletedReads++;
      }
      return { job };
    }
  });
  await page.goto("/generate");
  const recent = page
    .getByRole("heading", { name: "Recent generations", exact: true })
    .locator("..");
  await expect(
    recent.getByText("Pending source", { exact: true }),
  ).toBeVisible();
  await expect(
    recent.getByText("Failed source", { exact: true }),
  ).toBeVisible();
  await expect(
    recent.getByText("Deleted set source", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open set", exact: true }),
  ).toHaveCount(0);
  await recent
    .getByRole("button", { name: "Generation failed", exact: true })
    .click();
  await expect(page).toHaveURL(/job=failed$/);
  await expect(page.getByRole("alert")).toHaveText(
    "Temporary provider failure",
  );
  await recent.getByRole("button", { name: "Queued", exact: true }).click();
  await expect(page).toHaveURL(/job=pending$/);
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await page.goto("/generate?job=deleted");
  await expect.poll(() => deletedReads).toBeGreaterThan(0);
  await expect(
    recent.getByText("Pending source", { exact: true }),
  ).toBeVisible();
  await expect(
    recent.getByText("Deleted set source", { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/generate(?:\?job=deleted)?$/);
  await expect(page.getByText("Set deleted", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New set", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open set", exact: true }),
  ).toHaveCount(0);
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
