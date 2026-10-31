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
  await matching.getByRole("radio", { name: "Match using menus" }).click();
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
  await matching.getByRole("radio", { name: "Match by dragging" }).click();
  await expect(matching.getByRole("combobox")).toHaveCount(0);
  await expect(
    matching
      .getByRole("group", { name: "Modernism", exact: true })
      .getByRole("button", { name: "Virginia Woolf" }),
  ).toBeVisible();
  await capture(page, testInfo, "matching-mode-drag");
  await matching.getByRole("radio", { name: "Match using menus" }).click();
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
    matching.getByRole("radio", { name: "Match using menus" }),
  ).toBeChecked();
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
  const shuffle = page.getByRole("button", {
    name: "Shuffle questions",
    exact: true,
  });
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");
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
  await expect(shuffle).toHaveAttribute("aria-pressed", "false");
  await expect(headings).toHaveText(originalOrder);
  await shuffle.click();
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");
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
  await panel.getByRole("button", { name: "Reset study set progress" }).click();
  await expect(
    page.getByText("Reset this set?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await panel.getByRole("button", { name: "Reset study set progress" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Reset study set progress" }),
  ).toHaveCount(0);
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
    .getByRole("button", { name: "Delete Study practice", exact: true })
    .click();
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
    page.getByRole("heading", { name: studySet.title, exact: true }),
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
