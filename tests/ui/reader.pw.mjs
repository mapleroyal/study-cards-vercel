import { test, expect } from "@playwright/test";
import { signInToPreview } from "./owner-session.mjs";
test.beforeEach(async ({ page }) => signInToPreview(page));

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.startsWith("question shuffle")) {
    await page.addInitScript(() => {
      if (!globalThis.localStorage.getItem("lumina:study-reader")) {
        globalThis.localStorage.setItem(
          "lumina:study-reader",
          JSON.stringify({ defaultShuffleEnabled: false }),
        );
      }
    });
  }
  await page.route("**/api/capabilities", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ server: false, agent: false, pdfCleanup: false }),
    }),
  );
});
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";

const source = JSON.parse(
  readFileSync(
    new URL(
      "../../app/content/study-packs/public/general-knowledge.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const studySet = {
  ...source,
  title: "Study practice",
  category: "Design review",
  cards: source.cards.slice(0, 7),
};

async function importStudySet(page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "practice.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(studySet)),
    });
  await expect(
    page.getByRole("heading", { name: studySet.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(7);
}

async function openNativeContextMenu(page, trigger) {
  // Chromium on macOS does not map Shift+F10 to a native contextmenu event.
  // Keep the native input path there; menu choices and dismissal still use keys.
  await trigger.focus();
  if (process.platform === "darwin") {
    await trigger.click({ button: "right" });
  } else {
    await page.keyboard.press("Shift+F10");
  }
}

async function capture(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
}

test("all seven prompt types preserve answers, keyboard order and menu matching", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await importStudySet(page);
  const cards = page.getByRole("article");
  const trueFalse = cards.nth(0);
  await trueFalse.getByRole("radio", { name: "True", exact: true }).check();
  await trueFalse.getByRole("button", { name: "Show answer" }).click();
  await expect(trueFalse.getByText(source.cards[0].explanation)).toBeVisible();
  await expect(
    trueFalse.getByRole("button", { name: "Hide answer" }),
  ).toHaveAttribute("aria-expanded", "true");
  await capture(page, testInfo, "reader");

  const choice = cards.nth(1).getByRole("radio", { name: /Treaty of Paris/ });
  await choice.check();
  await expect(choice).toBeChecked();
  const multi = cards.nth(2);
  await multi.getByRole("checkbox", { name: /Argon/ }).check();
  await multi.getByRole("checkbox", { name: /Helium/ }).check();
  await expect(multi.getByRole("checkbox", { name: /Argon/ })).toBeChecked();
  await expect(multi.getByRole("checkbox", { name: /Helium/ })).toBeChecked();
  await cards.nth(3).getByRole("textbox").fill("acceleration");
  await cards
    .nth(6)
    .getByRole("textbox")
    .fill("Everyone is subject to the law.");

  const order = cards.nth(4).getByRole("list");
  const before = await order.getByRole("button").allTextContents();
  const first = order.getByRole("button").first();
  await first.scrollIntoViewIfNeeded();
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  // Wait for the sensor collision update before dropping the item.
  await expect(cards.nth(4).getByRole("status")).toContainText(
    `droppable area ${before[1].trim().replace(/^2\s*/, "")}`,
  );
  await page.keyboard.press("Space");
  await expect(order.getByRole("button").nth(1)).toContainText(
    before[0].trim().replace(/^1\s*/, ""),
  );
  const after = await order.getByRole("button").allTextContents();
  expect(after).not.toEqual(before);

  const matching = cards.nth(5);
  await expect(matching.getByRole("combobox")).toHaveCount(0);
  await expect(
    matching.getByRole("group", { name: "Unassigned choices bank" }),
  ).toBeVisible();
  await matching.getByRole("button", { name: "Match using menus" }).click();
  await expect(
    matching.getByRole("group", { name: "Unassigned choices bank" }),
  ).toHaveCount(0);
  const match = matching.getByRole("combobox", {
    name: "Match Virginia Woolf",
  });
  await match.click();
  await expect(
    page.getByRole("option", { name: "Modernism", exact: true }),
  ).toBeVisible();
  await capture(page, testInfo, "matching-menu");
  await page.getByRole("option", { name: "Modernism", exact: true }).click();
  await expect(match).toHaveText("Modernism");
  await expect(match).toBeFocused();
  await capture(page, testInfo, "matching-mode-menus");
  await matching.getByRole("button", { name: "Match by dragging" }).click();
  await expect(matching.getByRole("combobox")).toHaveCount(0);
  await expect(
    matching
      .getByRole("group", { name: "Modernism", exact: true })
      .getByRole("button", { name: "Virginia Woolf" }),
  ).toBeVisible();
  await capture(page, testInfo, "matching-mode-drag");
  await matching.getByRole("button", { name: "Match using menus" }).click();
  await expect(match).toHaveText("Modernism");

  await page.reload();
  await expect(
    cards.nth(0).getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  await expect(
    cards.nth(0).getByText(source.cards[0].explanation),
  ).toBeVisible();
  await expect(
    cards.nth(1).getByRole("radio", { name: /Treaty of Paris/ }),
  ).toBeChecked();
  await expect(
    cards.nth(2).getByRole("checkbox", { name: /Argon/ }),
  ).toBeChecked();
  await expect(cards.nth(3).getByRole("textbox")).toHaveValue("acceleration");
  await expect(cards.nth(6).getByRole("textbox")).toHaveValue(
    "Everyone is subject to the law.",
  );
  expect(await order.getByRole("button").allTextContents()).toEqual(after);
  await expect(
    matching.getByRole("button", { name: "Match using menus" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    matching.getByRole("group", { name: "Unassigned choices bank" }),
  ).toHaveCount(0);
  await expect(match).toHaveText("Modernism");
  await page
    .getByText("You've reached the end of this set.")
    .scrollIntoViewIfNeeded();
  await capture(page, testInfo, "handwritten-end-cap");
  expect(errors).toEqual([]);
});

test("question shuffle is on by default and toggles saved order without losing answers", async ({
  page,
}, testInfo) => {
  await importStudySet(page);
  const cards = page.getByRole("article");
  const headings = cards.getByRole("heading", { level: 2 });
  const originalOrder = studySet.cards.map((card) => card.question);
  const shuffledOrder = await headings.allTextContents();
  const shuffle = page.getByRole("switch", {
    name: "Shuffle questions",
    exact: true,
  });
  await expect(shuffle).toBeChecked();
  expect([...shuffledOrder].sort()).toEqual([...originalOrder].sort());
  const answeredCard = page.getByRole("article", {
    name: source.cards[0].question,
    exact: true,
  });
  await answeredCard.getByRole("radio", { name: "True", exact: true }).check();
  await answeredCard.getByRole("button", { name: "Show answer" }).click();
  await page.reload();
  await expect(headings).toHaveText(shuffledOrder);
  await expect(
    answeredCard.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
  await shuffle.click();
  await expect(shuffle).not.toBeChecked();
  await expect(headings).toHaveText(originalOrder);
  await shuffle.click();
  await expect(shuffle).toBeChecked();
  await expect(headings).toHaveText(shuffledOrder);
  await expect(
    answeredCard.getByRole("button", { name: "Hide answer" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, testInfo, "shuffled-reader");
  await page.reload();
  await expect(headings).toHaveText(shuffledOrder);
  await expect(
    answeredCard.getByRole("radio", { name: "True", exact: true }),
  ).toBeChecked();
});

test("set browser, theme preference, reset and deletion remain usable", async ({
  page,
}, testInfo) => {
  await importStudySet(page);
  await page
    .getByRole("article")
    .first()
    .getByRole("radio", { name: "True", exact: true })
    .check();
  const menuButton = page.getByRole("button", { name: "Open study set menu" });
  await menuButton.click();
  const panel = page.getByRole("dialog", { name: "Study sets", exact: true });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Import set", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Import set", exact: true }).focus();
  await capture(page, testInfo, "set-browser");
  await panel.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await panel.getByRole("radio", { name: "Light", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await panel
    .getByRole("button", { name: "Options for Study practice", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Reset progress", exact: true })
    .click();
  await expect(
    page.getByText("Reset this set?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await panel
    .getByRole("button", { name: "Options for Study practice", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Reset progress", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await panel
    .getByRole("button", { name: "Options for Study practice", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Reset progress", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(menuButton).toBeFocused();
  await expect(
    page
      .getByRole("article")
      .first()
      .getByRole("radio", { name: "True", exact: true }),
  ).not.toBeChecked();
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await menuButton.click();
  await panel
    .getByRole("button", { name: "Options for Study practice", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Delete set", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Import set", exact: true }),
  ).toBeVisible();
  await capture(page, testInfo, "empty");
});

test("favorites and long study titles fit a constrained viewport", async ({
  page,
}, testInfo) => {
  await importStudySet(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "Open study set menu" }).click();
  const panel = page.getByRole("dialog", { name: "Study sets", exact: true });
  const leaf = panel.getByRole("button", {
    name: "Study practice. Design review",
    exact: true,
  });
  await openNativeContextMenu(page, leaf);
  await page
    .getByRole("menuitem", { name: "Favorite study set", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Unfavorite Study practice", exact: true })
    .click();
  await expect(
    page.getByText("Unfavorite this study set?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    panel.getByRole("button", {
      name: "Unfavorite Study practice",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Study sets", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open study set menu" }).click();
  await panel
    .getByRole("button", { name: "Unfavorite Study practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Unfavorite", exact: true }).click();
  await page.keyboard.press("Escape");

  const longSet = {
    ...studySet,
    title:
      "A long study title with enough detail to wrap comfortably on a small screen",
    category: "Course / Module / Lesson",
  };
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "long-title.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(longSet)),
    });
  await expect(
    page.getByRole("heading", { name: longSet.title, exact: true }),
  ).toBeVisible();
  await capture(page, testInfo, "constrained-reader");
});

test("keyboard favorite actions and nested dismissal keep the study browser open", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await importStudySet(page);
  const menuButton = page.getByRole("button", { name: "Open study set menu" });
  await menuButton.click();
  const panel = page.getByRole("dialog", { name: "Study sets", exact: true });
  const leaf = panel.getByRole("button", {
    name: "Study practice. Design review",
    exact: true,
  });
  const contextMenu = page.getByRole("menu");
  const favoriteMarker = panel.getByRole("button", {
    name: "Unfavorite Study practice",
    exact: true,
  });
  const confirmation = page.getByRole("dialog", {
    name: "Unfavorite this study set?",
    exact: true,
  });

  async function openContextMenu() {
    await openNativeContextMenu(page, leaf);
    await expect(contextMenu).toBeVisible();
    await expect
      .poll(() =>
        contextMenu.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      )
      .toBe(true);
  }

  async function expectFocusWithinPanel() {
    await expect(panel).toBeVisible();
    await expect
      .poll(() =>
        panel.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
  }

  await openContextMenu();
  await page.keyboard.press("Escape");
  await expect(contextMenu).toBeHidden();
  await expect(leaf).toBeFocused();
  await expectFocusWithinPanel();

  await openContextMenu();
  await page
    .getByRole("menuitem", { name: "Favorite study set", exact: true })
    .press("Enter");
  await expect(contextMenu).toBeHidden();
  await expect(favoriteMarker).toBeVisible();
  await expectFocusWithinPanel();

  await openContextMenu();
  await page
    .getByRole("menuitem", { name: "Unfavorite study set", exact: true })
    .press("Enter");
  await expect(contextMenu).toBeHidden();
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(favoriteMarker).toBeVisible();
  await expectFocusWithinPanel();

  await openContextMenu();
  await page
    .getByRole("menuitem", { name: "Unfavorite study set", exact: true })
    .press("Enter");
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Unfavorite", exact: true })
    .press("Enter");
  await expect(confirmation).toBeHidden();
  await expect(favoriteMarker).toHaveCount(0);
  await expectFocusWithinPanel();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(menuButton).toBeFocused();
  expect(errors).toEqual([]);
});

test("long text answers remain complete after saving and reloading", async ({
  page,
}) => {
  await importStudySet(page);
  const answer = page
    .locator(`[data-study-card-id="${studySet.cards[6].id}"]`)
    .getByRole("textbox");
  const text = "Extended reasoning for the answer.\n".repeat(400);
  expect(await answer.getAttribute("maxlength")).toBeNull();
  await answer.fill(text);
  await expect(answer).toHaveValue(text);
  await page.reload();
  await expect(answer).toHaveValue(text);
});

function reviewRecord() {
  return {
    id: "reader-review-set",
    slug: "ordering-practice",
    revision: 1,
    source: { type: "generated" },
    importedAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    rawSet: {
      title: "Ordering practice",
      category: "Reader checks",
      cards: [
        {
          id: 1,
          type: "ordering",
          question: "Order the stages.",
          answer: ["First", "Second", "Third"],
          unordered_items: ["Third", "First", "Second"],
          explanation: "The stages proceed from first to third.",
        },
      ],
    },
  };
}

async function mockReviewLibrary(page, state) {
  const patches = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/session") {
      return route.continue();
    }
    if (path === "/api/library" && state.unavailable) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Library unavailable" }),
      });
    }
    let result = {};
    if (path === "/api/capabilities") {
      result = { server: true, agent: false, authenticated: true };
    }
    if (path === "/api/library") {
      result = {
        records: state.records,
        revision: state.records[0]?.revision || 0,
      };
    }
    if (path === "/api/favorites") {
      result = { favorites: [] };
    }
    if (path === "/api/progress") {
      result = { interactionsBySet: {} };
    }
    if (path === "/api/actions") {
      const body = request.postDataJSON();
      if (body.action === "study_set.update") {
        const record = state.records.find((item) => item.id === body.args.id);
        expect(body.expectedRevision).toBe(record.revision);
        patches.push(globalThis.structuredClone(body.args.patch));
        for (const card of body.args.patch.upsertCards || []) {
          record.rawSet.cards = record.rawSet.cards.map((item) =>
            item.id === card.id ? card : item,
          );
        }
        record.revision++;
      }
      result = {
        mutationId: body.mutationId,
        record: state.records[0],
        revision: state.records[0]?.revision || 0,
      };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  return patches;
}

test("ordering edits preserve the starting permutation across text, correct-order, add and remove changes", async ({
  page,
}) => {
  const state = { records: [reviewRecord()], unavailable: false };
  const patches = await mockReviewLibrary(page, state);
  await page.goto("/sets/ordering-practice");
  const dialog = page.getByRole("dialog", { name: "Edit card", exact: true });
  const openEditor = () =>
    page.getByRole("button", { name: "Edit card 1", exact: true }).click();
  const save = async (count) => {
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(patches).toHaveLength(count);
  };
  await openEditor();
  await dialog
    .getByLabel("Correct order 1", { exact: true })
    .fill("First corrected");
  await save(1);
  expect(patches[0].upsertCards[0].unordered_items).toEqual([
    "Third",
    "First corrected",
    "Second",
  ]);

  await openEditor();
  await dialog
    .getByRole("button", { name: "Move item 1 down", exact: true })
    .click();
  await save(2);
  expect(patches[1].upsertCards[0].answer).toEqual([
    "Second",
    "First corrected",
    "Third",
  ]);
  expect(patches[1].upsertCards[0].unordered_items).toEqual([
    "Third",
    "First corrected",
    "Second",
  ]);

  await openEditor();
  await dialog
    .getByRole("group", { name: "Correct order", exact: true })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await dialog.getByLabel("Correct order 4", { exact: true }).fill("Fourth");
  await save(3);
  expect(patches[2].upsertCards[0].unordered_items).toEqual([
    "Fourth",
    "Third",
    "First corrected",
    "Second",
  ]);

  await openEditor();
  await dialog
    .getByRole("button", { name: "Remove correct order 1", exact: true })
    .click();
  await save(4);
  expect(patches[3].upsertCards[0].answer).toEqual([
    "First corrected",
    "Third",
    "Fourth",
  ]);
  expect(patches[3].upsertCards[0].unordered_items).toEqual([
    "Fourth",
    "Third",
    "First corrected",
  ]);
  await page.reload();
  await expect(
    page.getByRole("article").getByRole("list").getByRole("button"),
  ).toHaveText([/Fourth$/, /Third$/, /First corrected$/]);
  await openEditor();
  await expect(
    dialog.getByLabel("Correct order 1", { exact: true }),
  ).toHaveValue("First corrected");
  await expect(
    dialog.getByLabel("Correct order 2", { exact: true }),
  ).toHaveValue("Third");
  await expect(
    dialog.getByLabel("Correct order 3", { exact: true }),
  ).toHaveValue("Fourth");
});

test("unavailable readers retain the requested URL, retry, and use only a matching offline cache", async ({
  page,
}, testInfo) => {
  const state = { records: [reviewRecord()], unavailable: true };
  await mockReviewLibrary(page, state);
  await page.goto("/sets/ordering-practice");
  await expect(page.getByRole("alert")).toHaveText(
    "Study set could not be loaded.",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sets\/ordering-practice$/);
  await capture(page, testInfo, "reader-load-error");

  state.unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ordering practice", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sets\/ordering-practice$/);

  state.unavailable = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ordering practice", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.goto("/sets/uncached-study");
  await expect(page.getByRole("alert")).toHaveText(
    "Study set could not be loaded.",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sets\/uncached-study$/);
  state.unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Study set not found", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sets\/uncached-study$/);
});

test("unavailable readers recover from a refreshed library without replacing the requested set", async ({
  page,
}) => {
  const state = { records: [reviewRecord()], unavailable: true };
  await mockReviewLibrary(page, state);
  await page.goto("/sets/ordering-practice");
  await expect(page.getByRole("alert")).toHaveText(
    "Study set could not be loaded.",
  );
  state.unavailable = false;
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await expect(
    page.getByRole("heading", { name: "Ordering practice", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sets\/ordering-practice$/);
  state.unavailable = true;
  await page.goto("/sets/does-not-exist");
  await expect(page.getByRole("alert")).toHaveText(
    "Study set could not be loaded.",
  );
  state.unavailable = false;
  await page.evaluate(() =>
    window.dispatchEvent(new globalThis.Event("online")),
  );
  await expect(
    page.getByRole("heading", { name: "Study set not found", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sets\/does-not-exist$/);
  await page.goto("/sets/oops-something-went-wrong-example-study-set");
  await expect(
    page.getByRole("heading", { name: "Study set not found", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("library row padding and keyboard activation open sets while overflow actions stay separate", async ({
  page,
}, testInfo) => {
  await importStudySet(page);
  const libraryRow = () =>
    page
      .getByRole("region", { name: "Study library", exact: true })
      .getByRole("button", {
        name: "Study practice. Design review",
        exact: true,
      });
  for (const edge of ["top", "bottom"]) {
    await page.goto("/");
    const row = libraryRow();
    await expect(row).toBeVisible();
    if (edge === "top") {
      const importAction = page.getByRole("button", {
        name: "Import set",
        exact: true,
      });
      const generateAction = page.getByRole("link", {
        name: "Generate cards",
        exact: true,
      });
      await expect(generateAction.locator("svg.octicon-plus")).toHaveCount(1);
      const metrics = async (control) =>
        control.evaluate((element) => {
          const walker = document.createTreeWalker(
            element,
            globalThis.NodeFilter.SHOW_TEXT,
          );
          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent.trim()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              const text = range.getBoundingClientRect();
              return {
                height: element.getBoundingClientRect().height,
                textBottom: text.bottom,
              };
            }
          }
          throw new Error("Action label missing");
        });
      const [importMetrics, generateMetrics] = await Promise.all([
        metrics(importAction),
        metrics(generateAction),
      ]);
      expect(importMetrics.height).toBe(32);
      expect(generateMetrics.height).toBe(importMetrics.height);
      expect(
        Math.abs(generateMetrics.textBottom - importMetrics.textBottom),
      ).toBeLessThanOrEqual(1);
    }
    const surface = await row.locator("..").boundingBox();
    await page.mouse.click(
      surface.x + surface.width / 2,
      edge === "top" ? surface.y + 1 : surface.y + surface.height - 1,
    );
    await expect(
      page.getByRole("heading", { name: studySet.title, exact: true }),
    ).toBeVisible();
  }
  await page.goto("/");
  await libraryRow().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: studySet.title, exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  const options = page.getByRole("button", {
    name: "Options for Study practice",
    exact: true,
  });
  await expect(options).toBeVisible();
  const bounds = await options.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(36);
  expect(bounds.height).toBeGreaterThanOrEqual(36);
  await options.click();
  await expect(
    page.getByRole("menuitem", { name: "Delete set", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await capture(page, testInfo, "library-row-actions");
});

test("brand card layers remain opaque in the active appearance", async ({
  page,
}) => {
  await page.goto("/");
  const icon = page
    .getByRole("banner")
    .getByRole("img", { name: "Lumina", exact: true });
  await expect(icon).toBeVisible();
  const layers = await icon.locator("rect").evaluateAll((elements) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    return elements.map((element) => {
      const style = globalThis.getComputedStyle(element);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = style.fill;
      context.fillRect(0, 0, 1, 1);
      return {
        opacity: Number(style.opacity),
        fillOpacity: Number(style.fillOpacity),
        colorAlpha: context.getImageData(0, 0, 1, 1).data[3],
      };
    });
  });
  expect(layers).toEqual(
    Array(3).fill({ opacity: 1, fillOpacity: 1, colorAlpha: 255 }),
  );
});

test("library and chooser fuzzy search match titles and nested categories without changing the reader", async ({
  page,
}, testInfo) => {
  const first = reviewRecord();
  const second = {
    ...reviewRecord(),
    id: "reader-cell-set",
    slug: "cell-biology",
    rawSet: {
      ...reviewRecord().rawSet,
      title: "Cell biology",
      category: "Science / Biology",
    },
  };
  await mockReviewLibrary(page, {
    records: [first, second],
    unavailable: false,
  });
  await page.goto("/");
  const library = page.getByRole("region", {
    name: "Study library",
    exact: true,
  });
  const search = page.getByRole("searchbox", {
    name: "Search study sets",
    exact: true,
  });
  await search.fill("biology scince");
  await expect(
    library.getByRole("button", {
      name: "Cell biology. Science / Biology",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", {
      name: "Ordering practice. Reader checks",
      exact: true,
    }),
  ).toHaveCount(0);
  await search.fill("biology ordering");
  await expect(
    page.getByText("No matching sets", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await capture(page, testInfo, "library-search");
  await page
    .getByRole("button", { name: "Open study set menu", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Study sets", exact: true });
  await drawer
    .getByRole("searchbox", { name: "Search study sets", exact: true })
    .fill("cheks ordering");
  await expect(
    drawer.getByRole("button", {
      name: "Cell biology. Science / Biology",
      exact: true,
    }),
  ).toHaveCount(0);
  await drawer
    .getByRole("button", {
      name: "Ordering practice. Reader checks",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ordering practice", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
});

test("chooser drawers restore nested editor focus and keep Settings reachable", async ({
  page,
}, testInfo) => {
  await mockReviewLibrary(page, {
    records: [reviewRecord()],
    unavailable: false,
  });
  await page.goto("/sets/ordering-practice");
  const trigger = page.getByRole("button", {
    name: "Open study set menu",
    exact: true,
  });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Study sets", exact: true });
  await expect(drawer).toHaveAttribute("data-slot", "drawer-content");
  await expect(drawer).toHaveAttribute(
    "data-swipe-direction",
    page.viewportSize().width < 768 ? "down" : "right",
  );
  await expect(drawer.locator('[data-slot="drawer-swipe-handle"]')).toHaveCount(
    page.viewportSize().width < 768 ? 1 : 0,
  );
  await expect(
    drawer.getByRole("link", { name: "Settings", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("link", { name: "Chats", exact: true }),
  ).toHaveCount(0);
  const options = drawer.getByRole("button", {
    name: "Options for Ordering practice",
    exact: true,
  });
  await options.click();
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Move set", exact: true });
  const category = editor.getByRole("combobox", {
    name: "Category",
    exact: true,
  });
  await category.fill("cheks reader");
  await expect(
    page.getByRole("option", { name: "Reader checks", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(editor).toBeVisible();
  await expect(category).toBeFocused();
  // A closed Base Combobox consumes Escape to clear its selected value.
  await editor.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
  await expect(drawer).toBeVisible();
  await expect(options).toBeFocused();
  await capture(page, testInfo, "chooser-drawer-nested-focus");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("long card editing keeps Save visible while only the fields scroll", async ({
  page,
}, testInfo) => {
  const record = reviewRecord();
  record.rawSet.cards = [
    {
      id: 1,
      type: "multiple_choice",
      question: "Choose an answer",
      options: Object.fromEntries(
        Array.from({ length: 18 }, (_, index) => [
          String.fromCharCode(97 + index),
          `Answer ${index + 1}`,
        ]),
      ),
      answer: "a",
      explanation: "The first answer is correct.",
    },
  ];
  const patches = await mockReviewLibrary(page, {
    records: [record],
    unavailable: false,
  });
  await page.goto("/sets/ordering-practice");
  await page.getByRole("button", { name: "Edit card 1", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit card", exact: true });
  const save = dialog.getByRole("button", { name: "Save", exact: true });
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter(
          (animation) => animation.effect.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  const before = await save.boundingBox();
  expect(before.y + before.height).toBeLessThanOrEqual(
    page.viewportSize().height,
  );
  await dialog
    .getByRole("textbox", { name: "Explanation", exact: true })
    .fill("Updated explanation.");
  const after = await save.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  await capture(page, testInfo, "long-card-editor");
  await save.click();
  await expect(dialog).toBeHidden();
  expect(patches[0].upsertCards[0].explanation).toBe("Updated explanation.");
  expect(record.rawSet.cards[0].explanation).toBe("Updated explanation.");
});
