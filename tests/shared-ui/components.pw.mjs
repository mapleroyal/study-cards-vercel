import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const slot = (page, name) => page.locator(`[data-slot="${name}"]`);
const css = (locator, property) =>
  locator.evaluate(
    (element, name) => globalThis.getComputedStyle(element)[name],
    property,
  );

async function expectWithinViewport(locator) {
  // Positioners, sheets and toasts animate into place; observe settled geometry.
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const viewport = locator.page().viewportSize();
      return Boolean(
        box &&
        box.x >= -1 &&
        box.x + box.width <= viewport.width + 1 &&
        box.y >= -1 &&
        box.y + box.height <= viewport.height + 1,
      );
    })
    .toBe(true);
}

async function expectItemPadding(locator) {
  expect(parseFloat(await css(locator, "paddingLeft"))).toBeGreaterThanOrEqual(
    12,
  );
  expect(parseFloat(await css(locator, "paddingTop"))).toBeGreaterThanOrEqual(
    8,
  );
}

async function attachImage(page, testInfo, name, locator) {
  const imagePath = testInfo.outputPath(
    `${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.png`,
  );
  await (locator ?? page).screenshot({
    animations: "disabled",
    path: imagePath,
  });
  await testInfo.attach(name, { path: imagePath, contentType: "image/png" });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Component verification", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test("every checked-in wrapper renders with application CSS and no page errors", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Component verification", exact: true }),
  ).toBeVisible();
  const covered = await page
    .locator("[data-components]")
    .evaluateAll((elements) =>
      elements.flatMap((element) => element.dataset.components.split(" ")),
    );
  const wrappers = readdirSync(
    fileURLToPath(new URL("../../app/components/ui", import.meta.url)),
  )
    .filter((name) => name.endsWith(".jsx"))
    .map((name) => name.slice(0, -4));
  expect(wrappers.filter((name) => !covered.includes(name))).toEqual([]);
  expect(errors).toEqual([]);
  expect(await css(page.locator("body"), "fontFamily")).toContain(
    "Inter Variable",
  );
  expect(await css(page.locator("html"), "colorScheme")).toBe(
    testInfo.project.use.colorScheme,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const title of [
    "Form controls",
    "Selection",
    "Navigation and disclosure",
    "Data and layout",
    "Status and feedback",
  ]) {
    await attachImage(
      page,
      testInfo,
      title,
      page.getByRole("region", { name: title, exact: true }),
    );
  }
});

test("fields keep padding, usable sizes, focus rings and disabled states", async ({
  page,
}) => {
  const input = page.getByRole("textbox", {
    name: "Document name",
    exact: true,
  });
  const textarea = page.getByRole("textbox", { name: "Document description" });
  const native = page.getByLabel("Native format", { exact: true });
  const inputSurface = input.locator("..");
  const textareaSurface = textarea.locator("..");
  const nativeSurface = native.locator("..");
  const customSelect = page.getByRole("combobox", {
    name: "Document format",
    exact: true,
  });
  for (const surface of [
    inputSurface,
    textareaSurface,
    nativeSurface,
    customSelect,
  ]) {
    expect(
      parseFloat(await css(surface, "borderTopLeftRadius")),
    ).toBeGreaterThan(0);
    expect((await surface.boundingBox()).height).toBeGreaterThanOrEqual(36);
  }
  for (const surface of [inputSurface, textareaSurface]) {
    expect(
      parseFloat(await css(surface, "paddingLeft")),
    ).toBeGreaterThanOrEqual(12);
  }
  for (const control of [native, customSelect]) {
    expect(
      parseFloat(await css(control, "paddingLeft")),
    ).toBeGreaterThanOrEqual(12);
  }
  const radius = await css(inputSurface, "borderTopLeftRadius");
  expect(await css(nativeSurface, "borderTopLeftRadius")).toBe(radius);
  expect(await css(customSelect, "borderTopLeftRadius")).toBe(radius);
  expect(
    await css(slot(page, "input-group").first(), "borderTopLeftRadius"),
  ).toBe(radius);
  await input.focus();
  await input.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(input).toBeFocused();
  expect(await css(inputSurface, "boxShadow")).not.toBe("none");
  // Padding is part of the input's hit area even though only the native input
  // receives focus, labels, keyboard events and submitted values.
  await textarea.focus();
  await inputSurface.click({ position: { x: 5, y: 18 } });
  await expect(input).toBeFocused();
  await page.getByLabel("Document name", { exact: true }).fill("Release notes");
  await expect(input).toHaveValue("Release notes");
  await textareaSurface.click({ position: { x: 5, y: 5 } });
  await expect(textarea).toBeFocused();
  await textarea.fill("A complete description");
  await page
    .getByRole("button", { name: "Focus document name", exact: true })
    .click();
  await expect(input).toBeFocused();
  expect(
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.id = "native-field-contract";
      document.body.append(form);
      const fields = [
        document.querySelector("[name=documentName]"),
        document.querySelector("[name=description]"),
      ];
      fields.forEach((field) => field.setAttribute("form", form.id));
      const values = Object.fromEntries(new window.FormData(form));
      fields.forEach((field) => field.removeAttribute("form"));
      form.remove();
      return values;
    }),
  ).toEqual({
    documentName: "Release notes",
    description: "A complete description",
  });
  await expect(
    page.getByRole("button", { name: "Disabled button" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Disabled input" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Disabled native select")).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Disabled format" }),
  ).toBeDisabled();
  await native.selectOption("txt");
  await expect(native).toHaveValue("txt");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByLabel("Import file")
    .locator("..")
    .click({ position: { x: 5, y: 18 } });
  await (await chooser).setFiles([]);
  await page.getByRole("textbox", { name: "Verification code" }).fill("123456");
  await expect(slot(page, "input-otp-slot").first()).toHaveText("1");
  await expect(slot(page, "input-otp-slot").last()).toHaveText("6");
});

test("select popup padding is independent of optional groups and keyboard selection is highlighted", async ({
  page,
}, testInfo) => {
  const measurements = [];
  for (const name of ["Document format", "Grouped format"]) {
    const trigger = page.getByRole("combobox", { name, exact: true });
    await trigger.click();
    const popup = page.locator('[data-slot="select-content"][data-open]');
    await expect(popup).toBeVisible();
    const first = popup.getByRole("option", { name: "Markdown", exact: true });
    const inset = await first.evaluate(
      (element) =>
        element.getBoundingClientRect().x -
        element.closest('[data-slot="select-content"]').getBoundingClientRect()
          .x,
    );
    measurements.push(inset);
    // Measure both rects in the same animation frame, including real compiled CSS.
    // This specifically catches the original ungrouped select regression.
    expect(inset).toBeCloseTo(6, 0);
    await expectItemPadding(first);
    await expectWithinViewport(popup);
    expect((await popup.boundingBox()).width).toBeGreaterThan(
      (await trigger.boundingBox()).width,
    );
    expect(
      await popup.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("ArrowDown");
    const highlighted = popup.locator("[data-highlighted]").first();
    await expect(highlighted).toBeVisible();
    expect(await css(highlighted, "backgroundColor")).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await attachImage(page, testInfo, `${name} open`, popup);
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  expect(measurements[0]).toBeCloseTo(measurements[1], 0);
  const trigger = page.getByRole("combobox", {
    name: "Document format",
    exact: true,
  });
  await trigger.press("ArrowDown");
  await slot(page, "select-content")
    .getByRole("option", { name: "Plain text", exact: true })
    .click();
  await expect(trigger).toHaveText("Plain text");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole("option", { name: /^A very long document format/ })
    .click();
  const value = trigger.locator('[data-slot="select-value"]');
  expect(await css(value, "textOverflow")).toBe("ellipsis");
  expect(await css(value, "display")).toBe("block");
  expect(
    await value.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await trigger.scrollIntoViewIfNeeded();
  await expectWithinViewport(trigger);
  await attachImage(page, testInfo, "Long selected label", trigger);
});

test("combobox filters, highlights, selects and handles empty results", async ({
  page,
}, testInfo) => {
  const input = page.getByRole("combobox", { name: "Search format" });
  await input.fill("Plain");
  const option = page.getByRole("option", { name: "Plain text", exact: true });
  await expect(option).toBeVisible();
  await expectItemPadding(option);
  await input.press("ArrowDown");
  expect(await css(option, "backgroundColor")).not.toBe("rgba(0, 0, 0, 0)");
  await attachImage(
    page,
    testInfo,
    "Filtered combobox",
    slot(page, "combobox-content"),
  );
  await input.press("Enter");
  await expect(input).toHaveValue("Plain text");
  await expect(slot(page, "combobox-content")).toBeHidden();
  await input.fill("No such format");
  await expect(
    page.getByText("No matching formats.", { exact: true }),
  ).toBeVisible();
  await input.press("Escape");
  await expect(slot(page, "combobox-content")).toBeHidden();
  const tags = page.getByRole("combobox", { name: "Format tags" });
  await tags.fill("HTML");
  await page.getByRole("option", { name: "HTML", exact: true }).click();
  await expect(slot(page, "combobox-chip")).toHaveCount(2);
  await tags.press("Escape");
});

test("Menus retain padding, states and usable submenus", async ({
  page,
}, testInfo) => {
  const cases = [
    {
      trigger: "Document actions",
      content: "dropdown-menu-content",
      item: "Rename",
      submenu: "Export as",
      child: "HTML document",
    },
    {
      trigger: "File menu",
      content: "menubar-content",
      item: "New document",
      submenu: "Recent files",
      child: "Notes.md",
    },
    {
      content: "context-menu-content",
      item: "Copy path",
      submenu: "Open with",
      child: "Text editor",
    },
  ];
  for (const example of cases) {
    if (example.trigger) {
      await page
        .getByRole(example.trigger === "File menu" ? "menuitem" : "button", {
          name: example.trigger,
          exact: true,
        })
        .click();
    } else {
      await page
        .getByText("Right click for document actions", { exact: true })
        .click({ button: "right" });
    }
    const popup = slot(page, example.content);
    await expect(popup).toBeVisible();
    expect(
      parseFloat(
        await css(
          popup.locator(":scope > [data-slot=surface-viewport]"),
          "paddingLeft",
        ),
      ),
    ).toBeGreaterThanOrEqual(6);
    await expectItemPadding(
      page.getByRole("menuitem", { name: new RegExp(example.item) }),
    );
    await expectItemPadding(page.getByRole("menuitemcheckbox"));
    await expectItemPadding(page.getByRole("menuitemradio").first());
    await attachImage(page, testInfo, example.content, popup);
    await page
      .getByRole("menuitem", { name: example.submenu, exact: true })
      .hover();
    await expect(
      page.getByRole("menuitem", { name: example.child, exact: true }),
    ).toBeVisible();
    await expectWithinViewport(
      page.getByRole("menuitem", { name: example.child, exact: true }),
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  }
});

test("dialog, alert, sheet, drawer and command palette fit and return focus", async ({
  page,
}, testInfo) => {
  const examples = [
    {
      trigger: "Edit document",
      name: "Edit document",
      role: "dialog",
      close: "Save changes",
    },
    {
      trigger: "Delete draft",
      name: "Delete draft?",
      role: "alertdialog",
      close: "Cancel deletion",
    },
    {
      trigger: "Open inspector",
      name: "Inspector",
      role: "dialog",
      close: "Done",
    },
    {
      trigger: "Open drawer",
      name: "Recent documents",
      role: "dialog",
      close: "Close drawer",
    },
  ];
  for (const example of examples) {
    const trigger = page.getByRole("button", {
      name: example.trigger,
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole(example.role, {
      name: example.name,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expectWithinViewport(dialog);
    await attachImage(page, testInfo, example.name, dialog);
    await dialog
      .getByRole("button", { name: example.close, exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole("button", { name: "Open command palette" }).click();
  const dialog = page.getByRole("dialog", { name: "Command Palette" });
  await expect(dialog).toBeVisible();
  await expectWithinViewport(dialog);
  const search = dialog.getByPlaceholder("Search all commands");
  expect(parseFloat(await css(search, "paddingLeft"))).toBeGreaterThan(0);
  await search.fill("command 29");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await search.press("Escape");
  await expect(dialog).toBeHidden();
});

test("stateful controls update visually and scalar slider values render one thumb", async ({
  page,
}) => {
  const checkbox = page.getByRole("checkbox", {
    name: "Wrap lines",
    exact: true,
  });
  const checkboxSurface = checkbox.locator("[data-slot=checkbox-surface]");
  const uncheckedBackground = await css(checkboxSurface, "backgroundColor");
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  expect(await css(checkboxSurface, "backgroundColor")).not.toBe(
    uncheckedBackground,
  );
  const mixed = page.getByRole("checkbox", { name: "Mixed selection" });
  await expect(mixed).toHaveAttribute("aria-checked", "mixed");
  expect(
    await css(mixed.locator("[data-slot=checkbox-surface]"), "backgroundColor"),
  ).not.toBe(uncheckedBackground);
  const autosave = page.getByRole("switch", { name: "Autosave", exact: true });
  await autosave.focus();
  await autosave.press("Space");
  await expect(autosave).toBeChecked();
  await page.getByRole("radio", { name: "Edit mode", exact: true }).focus();
  await page.keyboard.press("ArrowRight", { delay: 50 });
  await expect(
    page.getByRole("radio", { name: "Read mode", exact: true }),
  ).toBeChecked();
  const zoom = page.getByRole("slider", { name: "Zoom", exact: true });
  await expect(zoom).toHaveCount(1);
  const thumb = zoom.locator("..");
  const restingRing = await css(thumb, "boxShadow");
  await zoom.focus();
  await expect.poll(() => css(thumb, "boxShadow")).not.toBe(restingRing);
  await zoom.press("ArrowRight");
  await expect(zoom).toHaveAttribute("aria-valuenow", "51");
  await expect(
    page.getByRole("slider", { name: "Default slider", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("slider", { name: "Selected range", exact: true }),
  ).toHaveCount(2);
  const progress = page.getByRole("progressbar", { name: "Import progress" });
  await expect(progress).toHaveAttribute("aria-valuemax", "200");
  const fraction = await progress
    .locator("[data-slot=progress-indicator]")
    .evaluate(
      (element) =>
        element.getBoundingClientRect().width /
        element.parentElement.getBoundingClientRect().width,
    );
  expect(fraction).toBeCloseTo(0.3, 2);
  const loading = page.getByRole("progressbar", { name: "Loading progress" });
  const ratio =
    (await loading.locator("[data-slot=progress-indicator]").boundingBox())
      .width / (await loading.boundingBox()).width;
  expect(ratio).toBeCloseTo(0.5, 1);
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bold", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(slot(page, "toggle-group")).toHaveAttribute(
    "data-orientation",
    "vertical",
  );
  expect(
    parseFloat(await css(slot(page, "toggle-group"), "gap")),
  ).toBeGreaterThan(0);
});

test("tabs, accordion, input addons and appearance controls retain keyboard behavior", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Editor tab", exact: true }).focus();
  await page.keyboard.press("ArrowRight", { delay: 50 });
  await expect(
    page.getByRole("tab", { name: "Preview tab", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("Preview your document", { exact: true }),
  ).toBeVisible();
  const verticalTab = page.getByRole("tab", { name: "General", exact: true });
  await expect(verticalTab.locator("..")).toHaveAttribute(
    "aria-orientation",
    "vertical",
  );
  await verticalTab.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("tab", { name: "Advanced", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    await css(
      page
        .getByRole("tab", { name: "Preview tab", exact: true })
        .locator("../.."),
      "flexDirection",
    ),
  ).toBe("column");
  expect(await css(verticalTab.locator(".."), "flexDirection")).toBe("column");
  await expect
    .poll(() =>
      page
        .getByRole("tab", { name: "Advanced", exact: true })
        .evaluate(
          (element) => globalThis.getComputedStyle(element, "::after").opacity,
        ),
    )
    .toBe("1");
  await page
    .getByRole("button", { name: "Document details", exact: true })
    .click();
  await expect(
    page.getByText("Created September 7, 2026.", { exact: true }),
  ).toBeVisible();
  const content = page.getByRole("region", {
    name: "Document details",
    exact: true,
  });
  await expect
    .poll(() =>
      content.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
    )
    .toBe(true);
  const message = page.getByRole("textbox", { name: "Message", exact: true });
  await slot(page, "input-group-addon")
    .filter({ has: page.getByText("Markdown", { exact: true }) })
    .click({ position: { x: 4, y: 4 } });
  await expect(message).toBeFocused();
  const expanded = page.getByTestId("appearance-expanded");
  await expect(expanded.locator("[data-appearance-layout]")).toHaveAttribute(
    "data-appearance-layout",
    "expanded",
  );
  await expanded.getByRole("radio", { name: "System", exact: true }).focus();
  await page.keyboard.press("ArrowRight", { delay: 50 });
  await expect(
    expanded.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeChecked();
  await expect(
    expanded.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeFocused();
  const compact = page.getByTestId("appearance-compact");
  await expect(compact.locator("[data-appearance-layout]")).toHaveAttribute(
    "data-appearance-layout",
    "compact",
  );
  await compact.getByRole("button", { name: "Appearance: Dark" }).click();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(
    compact.getByRole("button", { name: "Appearance: Light" }),
  ).toBeFocused();
  await expect(
    expanded.getByRole("radio", { name: "Light", exact: true }),
  ).toBeChecked();
});

test("supporting popups and notifications are styled and bounded", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "Document info", exact: true })
    .click();
  await expect(slot(page, "popover-content")).toBeVisible();
  await expectWithinViewport(slot(page, "popover-content"));
  expect(
    parseFloat(
      await css(
        slot(page, "popover-content").locator(
          ":scope > [data-slot=surface-viewport]",
        ),
        "paddingLeft",
      ),
    ),
  ).toBeGreaterThanOrEqual(16);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Author details" }).hover();
  await expect(slot(page, "hover-card-content")).toBeVisible();
  await expectWithinViewport(slot(page, "hover-card-content"));
  await page
    .getByRole("button", { name: "Preview shortcut", exact: true })
    .hover();
  await expect(slot(page, "tooltip-content")).toBeVisible();
  await expectWithinViewport(slot(page, "tooltip-content"));
  await page.getByRole("button", { name: "Show notification" }).click();
  const notification = slot(page, "toast");
  await expect(notification).toBeVisible();
  await expectWithinViewport(notification);
  await expect(notification.locator("[data-slot=toast-title]")).toHaveText(
    "Document saved",
  );
  await attachImage(page, testInfo, "Notification", notification);
  await expect(notification).toHaveCSS("position", "absolute");
  await notification.locator("[data-slot=toast-close]").click();
  await expect(notification).toBeHidden();
});

test("long select lists scroll independently and retain edge padding", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 480 });
  const trigger = page.getByRole("combobox", {
    name: "Many documents",
    exact: true,
  });
  await trigger.click();
  const popup = page.locator('[data-slot="select-content"][data-open]');
  const list = slot(page, "select-list");
  await expect(popup).toBeVisible();
  await expectWithinViewport(popup);
  expect(
    await list.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("option", { name: "Document 40", exact: true }),
  ).toBeInViewport();
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0,
  );
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveText("Document 40");
});

test("aspect ratio keeps its sizing when inline styles are supplied", async ({
  page,
}) => {
  const preview = page.locator('[data-slot="aspect-ratio"]');
  const box = await preview.boundingBox();
  expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  await expect(preview).toHaveCSS(
    "color",
    await css(page.locator("body"), "color"),
  );
});

test("calendar, carousel, resizable panes and sidebar render functional layout", async ({
  page,
}) => {
  const calendar = slot(page, "calendar");
  await calendar.getByRole("button", { name: /September 8th/ }).click();
  await expect(calendar.locator('[data-selected-single="true"]')).toHaveText(
    "8",
  );
  const carousel = slot(page, "carousel");
  await carousel.getByRole("button", { name: "Next slide" }).click();
  await expect(
    carousel.getByRole("button", { name: "Previous slide" }),
  ).toBeEnabled();
  const separator = slot(page, "resizable-handle");
  await separator.focus();
  const before = await separator.getAttribute("aria-valuenow");
  await separator.press("ArrowRight");
  await expect(separator).not.toHaveAttribute("aria-valuenow", before);
  const sidebarButton = slot(page, "sidebar-menu-button").first();
  expect(
    parseFloat(await css(sidebarButton, "borderTopLeftRadius")),
  ).toBeGreaterThan(0);
  const chart = slot(page, "chart");
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.4);
  await expect(chart.locator(".recharts-tooltip-wrapper")).toBeVisible();
  await expect(
    chart.locator(".recharts-tooltip-wrapper span").filter({ hasText: /^0$/ }),
  ).toBeVisible();
});

test("dialog nested select, combobox and calendar retain pointer and keyboard access", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "Edit document", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Edit document",
    exact: true,
  });
  const format = dialog.getByRole("combobox", {
    name: "Document format",
    exact: true,
  });
  await format.click();
  await expectWithinViewport(slot(page, "select-content"));
  await page.getByRole("option", { name: "Markdown", exact: true }).click();
  await expect(format).toContainText("Markdown");
  await expect(dialog).toBeVisible();
  const folder = dialog.getByRole("combobox", {
    name: "Document folder",
    exact: true,
  });
  await folder.fill("Fin");
  await page.getByRole("option", { name: "Finance", exact: true }).click();
  await expect(folder).toHaveValue("Finance");
  const date = dialog.getByRole("button", {
    name: "Choose document date",
    exact: true,
  });
  await date.click();
  await expectWithinViewport(slot(page, "popover-content"));
  await slot(page, "calendar").locator('button[data-day="6/20/2026"]').click();
  await attachImage(
    page,
    testInfo,
    "Calendar inside dialog",
    slot(page, "popover-content"),
  );
  await page.keyboard.press("Escape");
  await expect(slot(page, "popover-content")).toBeHidden();
  await expect(date).toBeFocused();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Edit document", exact: true }),
  ).toBeFocused();
});

test("tooltips can explicitly opt into hoverable popup content", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Hoverable hint",
    exact: true,
  });
  const popup = slot(page, "tooltip-content");
  await trigger.hover();
  await expect(popup).toBeVisible();
  await popup.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  // Move into the popup without Locator.hover's scroll-into-view step: scrolling
  // an anchored tooltip moves its trigger away from the pointer and dismisses it.
  const box = await popup.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 4,
  });
  await expect(popup).toBeVisible();
  await expect
    .poll(() => popup.evaluate((element) => element.matches(":hover")))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
});

test("reduced motion preserves popup interaction without animated travel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const trigger = page.getByRole("button", {
    name: "Edit document",
    exact: true,
  });
  await trigger.click();
  const popup = slot(page, "dialog-content");
  await expect(popup).toBeVisible();
  for (const surface of [popup, slot(page, "dialog-overlay")]) {
    const timing = await surface.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return [style.animationDuration, style.transitionDuration].flatMap(
        (value) => value.split(",").map(Number.parseFloat),
      );
    });
    expect(Math.max(...timing)).toBeLessThanOrEqual(0.001);
  }
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("combobox labels fit with symmetric padding and selected indicator space", async ({
  page,
}, testInfo) => {
  const input = page.getByRole("combobox", {
    name: "Long format",
    exact: true,
  });
  await input.click();
  const popup = slot(page, "combobox-content");
  const selected = popup.getByRole("option", {
    name: "Selected format with a long descriptive name",
    exact: true,
  });
  const unselected = popup.getByRole("option", {
    name: "Unselected format with a long descriptive name",
    exact: true,
  });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(unselected).toHaveAttribute("aria-selected", "false");
  expect(await css(unselected, "paddingLeft")).toBe("12px");
  expect(await css(unselected, "paddingRight")).toBe("12px");
  expect(await css(selected, "paddingLeft")).toBe("12px");
  expect(await css(selected, "paddingRight")).toBe("32px");
  for (const item of [selected, unselected]) {
    const label = item.locator('[data-slot="combobox-item-label"]');
    await expect(label).toHaveCSS("text-overflow", "ellipsis");
    expect(
      await label.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await item.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await label.evaluate((element) => {
        const row = element.parentElement;
        return (
          element.getBoundingClientRect().right <=
          row.getBoundingClientRect().right -
            parseFloat(globalThis.getComputedStyle(row).paddingRight) +
            1
        );
      }),
    ).toBe(true);
  }
  const custom = popup.getByRole("option", {
    name: "Custom format",
    exact: false,
  });
  await expect(
    custom.locator(':scope > [data-testid="custom-format-label"]'),
  ).toHaveText("Custom format");
  await expect(custom.locator('[data-slot="combobox-item-label"]')).toHaveCount(
    0,
  );
  await expectWithinViewport(popup);
  await attachImage(
    page,
    testInfo,
    "Combobox label and indicator spacing",
    popup,
  );
  await unselected.click();
  await expect(input).toHaveValue(
    "Unselected format with a long descriptive name",
  );
  await input.click();
  await expect(unselected).toHaveAttribute("aria-selected", "true");
  expect(await css(unselected, "paddingRight")).toBe("32px");
  expect(await css(selected, "paddingRight")).toBe("12px");
});

test("default tooltip bodies and arrows never intercept directional pointer travel", async ({
  page,
}, testInfo) => {
  for (const side of ["top", "bottom", "left", "right"]) {
    const trigger = page.getByRole("button", {
      name: `Pointer ${side}`,
      exact: true,
    });
    await trigger.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await trigger.hover();
    const popup = slot(page, "tooltip-content");
    const positioner = slot(page, "tooltip-positioner");
    const arrow = slot(page, "tooltip-arrow");
    await expect(popup).toBeVisible();
    await popup.evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
    await expect(popup).toHaveAttribute("data-side", side);
    const boxes = [await arrow.boundingBox(), await popup.boundingBox()];
    for (const box of boxes) {
      expect(box).not.toBeNull();
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      expect(
        await positioner.evaluate(
          (element, target) =>
            element.contains(document.elementFromPoint(target.x, target.y)),
          point,
        ),
      ).toBe(false);
    }
    if (side === "top") {
      await attachImage(page, testInfo, "Nonintercepting tooltip", popup);
    }
    for (const box of boxes) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 4,
      });
    }
    await expect(popup).toBeHidden();
  }
});

test("default tooltips retain keyboard focus and Escape dismissal", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Preview shortcut",
    exact: true,
  });
  // Establish keyboard modality without relying on macOS's button Tab setting.
  await page.keyboard.press("Tab");
  await trigger.focus();
  await expect(trigger).toBeFocused();
  const popup = slot(page, "tooltip-content").filter({ hasText: "Preview" });
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("pagination preserves link semantics and native keyboard navigation", async ({
  page,
}) => {
  const pagination = page.getByRole("navigation", { name: "pagination" });
  await expect(pagination.getByRole("link")).toHaveCount(3);
  await expect(pagination.getByRole("button")).toHaveCount(0);
  await expect(
    pagination.getByRole("link", { name: "1", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const next = pagination.getByRole("link", { name: "Go to next page" });
  await expect(next).toHaveAttribute("href", "#next");
  await next.focus();
  await next.press("Space");
  expect(new URL(page.url()).hash).toBe("");
  await next.press("Enter");
  await expect(page).toHaveURL(/#next$/);
});
