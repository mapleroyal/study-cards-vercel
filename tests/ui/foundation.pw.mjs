import { expect, test } from "@playwright/test";

// Focused behavior probes adapted from the shared React template gallery.
// The gallery uses the application stylesheet and wrappers, never copied controls.
test.use({ baseURL: "http://127.0.0.1:4181" });

const slot = (page, name) => page.locator(`[data-slot="${name}"]`);
const css = (locator, property, pseudo = null) =>
  locator.evaluate(
    (element, [name, part]) => globalThis.getComputedStyle(element, part)[name],
    [property, pseudo],
  );

async function attach(locator, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await locator.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ page }) => {
  const interResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/inter-latin-wght-normal.woff2"),
  );
  await page.goto("/");
  await expect(page.getByTestId("native-scroll")).toBeAttached();
  expect((await interResponse).status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).toHaveCSS("font-family", /Inter Variable/);
  expect(
    await page.evaluate(async () =>
      (await document.fonts.load('400 16px "Inter Variable"', "Study")).map(
        (font) => font.status,
      ),
    ),
  ).toContain("loaded");
});

test("intentional circles stay round while app surfaces retain their corner treatment", async ({
  page,
}, testInfo) => {
  const supported = await page.evaluate(() =>
    globalThis.CSS.supports("corner-shape", "superellipse(1.5)"),
  );
  for (const name of [
    "status-light",
    "level-indicator",
    "circle-with-pseudo",
  ]) {
    const circle = page.getByTestId(name);
    const box = await circle.boundingBox();
    expect(box.width).toBe(box.height);
    expect(
      parseFloat(await css(circle, "borderTopLeftRadius")),
    ).toBeGreaterThanOrEqual(box.width / 2);
    if (supported) {
      expect(await css(circle, "cornerShape")).toMatch(
        /^(round|superellipse\(1\))$/,
      );
    }
  }
  const pill = page.getByTestId("pill");
  const pillBox = await pill.boundingBox();
  expect(pillBox.width).toBeGreaterThan(pillBox.height);
  expect(
    parseFloat(await css(pill, "borderTopLeftRadius")),
  ).toBeGreaterThanOrEqual(pillBox.height / 2);
  if (supported) {
    expect(await css(pill, "cornerShape")).toMatch(
      /^(round|superellipse\(1\))$/,
    );
    expect(
      await css(
        page.getByTestId("circle-with-pseudo"),
        "cornerShape",
        "::before",
      ),
    ).toMatch(/^(round|superellipse\(1\))$/);
    expect(await css(page.getByTestId("app-surface"), "cornerShape")).toBe(
      "superellipse(1.5)",
    );
  }
  await attach(
    page.getByTestId("shape-examples"),
    testInfo,
    "intentional-circles",
  );
});

test("native overflow has unpainted rails, no arrows and a draggable thumb", async ({
  page,
}, testInfo) => {
  const area = page.getByTestId("native-scroll");
  await area.scrollIntoViewIfNeeded();
  for (const pseudo of [
    "::-webkit-scrollbar",
    "::-webkit-scrollbar-track",
    "::-webkit-scrollbar-track-piece",
    "::-webkit-scrollbar-corner",
    "::-webkit-scrollbar-button",
  ]) {
    expect(await css(area, "backgroundColor", pseudo)).toBe("rgba(0, 0, 0, 0)");
  }
  expect(
    await css(area, "backgroundColor", "::-webkit-scrollbar-thumb"),
  ).not.toBe("rgba(0, 0, 0, 0)");
  const metrics = await area.evaluate((element) => ({
    vertical: element.offsetWidth - element.clientWidth,
    horizontal: element.offsetHeight - element.clientHeight,
  }));
  expect(metrics.vertical).toBe(14);
  expect(metrics.horizontal).toBe(14);
  const box = await area.boundingBox();
  const x = box.x + box.width - 7;
  const y = box.y + box.height - 7;
  const top = () => area.evaluate((element) => element.scrollTop);
  const left = () => area.evaluate((element) => element.scrollLeft);
  // Chromium exposes the scrollbar part, but not its directional pseudo-classes.
  expect(await css(area, "display", "::-webkit-scrollbar-button")).toBe("none");
  expect(await css(area, "backgroundImage", "::-webkit-scrollbar-button")).toBe(
    "none",
  );
  await page.mouse.move(box.x + 24, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 24, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(left).toBeGreaterThan(100);
  // Drag the native thumb from the start to the end of its usable track.
  await page.mouse.move(x, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - 35, { steps: 8 });
  await page.mouse.up();
  await expect.poll(top).toBeGreaterThan(100);
  await area.evaluate((element) => element.scrollTo(0, 0));
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.wheel(0, 100);
  await expect.poll(top).toBeGreaterThan(0);
  await attach(area, testInfo, "native-scrollbar");
});

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

test("the isolated gallery uses app fonts and theme without errors or horizontal overflow", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Shared foundation verification",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
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
  const native = page.getByRole("combobox", {
    name: "Native reference",
    exact: true,
  });
  await native.selectOption("plain");
  await expect(native).toHaveValue("plain");
  expect(errors).toEqual([]);
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
  await expect(
    slot(page, "select-content").getByRole("option", {
      name: "Markdown",
      exact: true,
    }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(
    slot(page, "select-content").getByRole("option", {
      name: "Markdown",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    slot(page, "select-content").getByRole("option", {
      name: "Plain text",
      exact: true,
    }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(
    slot(page, "select-content").getByRole("option", {
      name: "Plain text",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
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

test("calendar month and year dropdowns use shared Select padding and navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const calendar = page.locator('[data-slot="calendar"]');
  const month = calendar.getByRole("combobox", { name: "Choose the Month" });
  const year = calendar.getByRole("combobox", { name: "Choose the Year" });
  await expect(calendar.locator("select")).toHaveCount(0);
  await expect(month).toContainText("Sep");
  await expect(year).toContainText("2026");

  await month.click();
  const list = page.locator(
    '[data-slot="select-content"][data-open] [data-slot="select-list"]',
  );
  const option = list.getByRole("option", { name: "Jul", exact: true });
  await expect(option).toBeVisible();
  expect(
    await list.evaluate((element) =>
      parseFloat(globalThis.getComputedStyle(element).paddingLeft),
    ),
  ).toBe(6);
  expect(
    await option.evaluate((element) => ({
      horizontal: parseFloat(globalThis.getComputedStyle(element).paddingLeft),
      vertical: parseFloat(globalThis.getComputedStyle(element).paddingTop),
    })),
  ).toEqual({ horizontal: 12, vertical: 8 });
  const imagePath = testInfo.outputPath("calendar-month-options.png");
  await page.locator('[data-slot="select-content"]').screenshot({
    path: imagePath,
    animations: "disabled",
  });
  await testInfo.attach("Calendar month options", {
    path: imagePath,
    contentType: "image/png",
  });
  await option.click();
  await expect(month).toContainText("Jul");
  await expect(calendar.getByRole("grid")).toHaveAttribute(
    "aria-label",
    "July 2026",
  );
  await expect(month).toBeFocused();

  await year.focus();
  await year.press("ArrowDown");
  // Wait for the popup's initial selection before sending navigation keys.
  await expect(
    list.getByRole("option", { name: "2026", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(
    list.getByRole("option", { name: "2026", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    list.getByRole("option", { name: "2024", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(
    list.getByRole("option", { name: "2024", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(year).toContainText("2024");
  await expect(calendar.getByRole("grid")).toHaveAttribute(
    "aria-label",
    "July 2024",
  );
  await expect(year).toBeFocused();

  await month.click();
  await expect(
    list.getByRole("option", { name: "Jan", exact: true }),
  ).toBeDisabled();
  await expect(
    list.getByRole("option", { name: "Feb", exact: true }),
  ).toBeDisabled();
  await expect(
    list.getByRole("option", { name: "Mar", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(month).toBeFocused();
  await expect(list).toBeHidden();
});

test("long select lists expose the shared transparent scrollbar and draggable thumb", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Many documents", exact: true })
    .click();
  const list = page.locator(
    '[data-slot="select-content"][data-open] [data-slot="select-list"]',
  );
  await expect(list).toBeVisible();
  const metrics = await list.evaluate((element) => {
    const track = globalThis.getComputedStyle(
      element,
      "::-webkit-scrollbar-track",
    );
    const thumb = globalThis.getComputedStyle(
      element,
      "::-webkit-scrollbar-thumb",
    );
    return {
      gutter: element.offsetWidth - element.clientWidth,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      trackBackground: track.backgroundColor,
      thumbBackground: thumb.backgroundColor,
      scrollbarWidth: globalThis.getComputedStyle(element).scrollbarWidth,
    };
  });
  expect(metrics.gutter).toBe(14);
  expect(metrics.scrollbarWidth).not.toBe("none");
  expect(metrics.trackBackground).toBe("rgba(0, 0, 0, 0)");
  expect(metrics.thumbBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
  const before = await list.evaluate((element) => element.scrollTop);
  const box = await list.boundingBox();
  const trackHeight = metrics.height;
  const thumbHeight = Math.max(
    24,
    (trackHeight * metrics.height) / metrics.scrollHeight,
  );
  const x = box.x + box.width - metrics.gutter / 2;
  await page.mouse.move(x, box.y + thumbHeight / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - thumbHeight / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before);
});

for (const orientation of ["vertical", "horizontal"]) {
  test(`${orientation} scrollbar keeps its rail invisible and has no arrows and supports thumb dragging, keyboard and wheels`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const area = page.getByTestId(`scroll-area-${orientation}`);
    const viewport = area.locator('[data-slot="scroll-area-viewport"]');
    const bar = area.locator(
      `[data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`,
    );
    const thumb = bar.locator('[data-slot="scroll-area-thumb"]');
    const position = () =>
      viewport.evaluate(
        (element, axis) =>
          element[axis === "vertical" ? "scrollTop" : "scrollLeft"],
        orientation,
      );
    const reset = async () => {
      await viewport.evaluate((element) => element.scrollTo(0, 0));
      await expect.poll(position).toBe(0);
    };

    await area.scrollIntoViewIfNeeded();
    await expect(thumb).toBeVisible();
    await expect(
      bar.locator("button, [data-slot=scroll-area-arrow]"),
    ).toHaveCount(0);
    await bar.hover();
    expect(
      await bar.evaluate((element) => {
        const style = globalThis.getComputedStyle(element);
        return {
          background: style.backgroundColor,
          border: style.borderTopWidth,
          shadow: style.boxShadow,
        };
      }),
    ).toEqual({
      background: "rgba(0, 0, 0, 0)",
      border: "0px",
      shadow: "none",
    });
    expect(
      await thumb.evaluate(
        (element) => globalThis.getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)");

    // The focusable native viewport retains keyboard scrolling without extra controls.
    await viewport.focus();
    // Native WebKit scrolling starts between keydown and keyup; a zero-duration
    // synthetic key press can finish before its first animation frame.
    await viewport.press(
      orientation === "vertical" ? "ArrowDown" : "ArrowRight",
      { delay: 80 },
    );
    await expect.poll(position).toBeGreaterThan(0);
    await page.waitForTimeout(150);
    await reset();
    const thumbBox = await thumb.boundingBox();
    const trackBox = await bar.boundingBox();
    const start = {
      x: thumbBox.x + thumbBox.width / 2,
      y: thumbBox.y + thumbBox.height / 2,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // Drag beyond the end of the thumb's travel to verify capture and clamping.
    await page.mouse.move(
      orientation === "horizontal" ? trackBox.x + trackBox.width : start.x,
      orientation === "vertical" ? trackBox.y + trackBox.height : start.y,
      { steps: 8 },
    );
    await page.mouse.up();
    const maximum = await viewport.evaluate(
      (element, axis) =>
        axis === "vertical"
          ? element.scrollHeight - element.clientHeight
          : element.scrollWidth - element.clientWidth,
      orientation,
    );
    await expect.poll(position).toBeGreaterThanOrEqual(maximum - 1);

    await reset();
    await viewport.hover();
    await page.mouse.wheel(
      orientation === "horizontal" ? 100 : 0,
      orientation === "vertical" ? 100 : 0,
    );
    await expect.poll(position).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    const imagePath = testInfo.outputPath(`scroll-area-${orientation}.png`);
    await area.screenshot({ path: imagePath, animations: "disabled" });
    await testInfo.attach(`${orientation} scrollbar`, {
      path: imagePath,
      contentType: "image/png",
    });
  });
}
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
  await slot(page, "select-content")
    .getByRole("option", { name: "Markdown", exact: true })
    .click();
  await expect(format).toContainText("Markdown");
  await expect(dialog).toBeVisible();
  await expect(format).toBeFocused();
  await format.press("ArrowDown");
  await expect(
    slot(page, "select-content").getByRole("option", {
      name: "Markdown",
      exact: true,
    }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(
    page.getByRole("option", { name: "Markdown", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("option", { name: "Plain text", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[data-slot="select-content"]:visible'),
  ).toHaveCount(0);
  await expect(format).toContainText("Plain text");
  await expect(format).toBeFocused();
  const folder = dialog.getByRole("combobox", {
    name: "Document folder",
    exact: true,
  });
  await folder.fill("Fin");
  await folder.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Finance", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await folder.press("Enter");
  await expect(folder).toHaveValue("Finance");
  await expect(folder).toBeFocused();
  await expect(slot(page, "combobox-content")).toBeHidden();
  await folder.fill("Work");
  await page.getByRole("option", { name: "Work", exact: true }).click();
  await expect(folder).toHaveValue("Work");
  const date = dialog.getByRole("button", {
    name: "Choose document date",
    exact: true,
  });
  await date.click();
  await expectWithinViewport(slot(page, "popover-content"));
  const calendar = slot(page, "popover-content").locator(
    '[data-slot="calendar"]',
  );
  await calendar.locator('button[data-day="6/20/2026"]').click();
  await expect(
    dialog.locator('output[aria-label="Selected document date"]'),
  ).toHaveText("6/20/2026");
  const month = calendar.getByRole("combobox", { name: "Choose the Month" });
  await month.focus();
  await month.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Jun", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await expect(
    page.getByRole("option", { name: "Jun", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("option", { name: "Jan", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  // The selected month renders before its old popup has finished closing.
  await expect(
    page.locator('[data-slot="select-content"]:visible'),
  ).toHaveCount(0);
  await expect(month).toBeFocused();
  await expect(calendar.getByRole("grid")).toHaveAttribute(
    "aria-label",
    "January 2026",
  );
  await month.click();
  await expect(
    page.locator('[data-slot="select-content"][data-open]'),
  ).toHaveCount(1);
  await expect(
    page.getByRole("option", { name: "Jan", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-slot="select-content"]:visible'),
  ).toHaveCount(0);
  await expect(month).toBeFocused();
  await expect(slot(page, "popover-content")).toHaveAttribute("data-open", "");
  await expect(dialog).toBeVisible();
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

test("horizontal and vertical tabs preserve layout, keyboard selection and active state", async ({
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
  await expect(
    page.getByText("Advanced settings", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("General settings", { exact: true }),
  ).toBeHidden();
  const preview = page.getByRole("tab", { name: "Preview tab", exact: true });
  const editor = page.getByRole("tab", { name: "Editor tab", exact: true });
  expect(await css(preview, "backgroundColor")).not.toBe(
    await css(editor, "backgroundColor"),
  );
});

for (const panel of ["sheet", "drawer"]) {
  test(`Base UI popover inside ${panel} accepts pointer and keyboard without dismissing its parent`, async ({
    page,
  }) => {
    const opener = page.getByRole("button", {
      name: `Open ${panel}`,
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: `${panel === "sheet" ? "Sheet" : "Drawer"} choices`,
      exact: true,
    });
    const trigger = dialog.getByRole("button", {
      name: `Confirm ${panel} choice`,
      exact: true,
    });
    await trigger.click();
    const popup = slot(page, "popover-content");
    await expectWithinViewport(popup);
    await popup
      .getByRole("textbox", { name: `${panel} note` })
      .fill("Reviewed");
    await popup
      .getByRole("button", { name: `Apply ${panel} choice`, exact: true })
      .click();
    await expect(popup).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator(`output[aria-label="${panel} result"]`),
    ).toHaveText("Applied");
    await expect(trigger).toBeFocused();
    await trigger.press("Space");
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
}

test("shared menu inside Base UI dialog remains interactive and returns focus", async ({
  page,
}) => {
  const opener = page.getByRole("button", {
    name: "Edit document",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog", {
    name: "Edit document",
    exact: true,
  });
  const trigger = dialog.getByRole("button", {
    name: "Draft actions",
    exact: true,
  });
  await trigger.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Rename draft", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.locator('output[aria-label="Draft action"]')).toHaveText(
    "Renamed",
  );
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole("menuitem", { name: "Archive draft", exact: true })
    .click();
  await expect(dialog.locator('output[aria-label="Draft action"]')).toHaveText(
    "Archived",
  );
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

for (const panel of ["sheet", "drawer"]) {
  test(`interrupted-generation alert inside ${panel} dismisses only itself and restores focus`, async ({
    page,
  }) => {
    const opener = page.getByRole("button", {
      name: `Open ${panel}`,
      exact: true,
    });
    await opener.click();
    const parent = page.getByRole("dialog", {
      name: `${panel === "sheet" ? "Sheet" : "Drawer"} choices`,
      exact: true,
    });
    const trigger = parent.getByRole("button", {
      name: "Review interrupted generation",
      exact: true,
    });
    await trigger.click();
    const alert = page.getByRole("alertdialog", {
      name: "Discard interrupted generation?",
      exact: true,
    });
    await expectWithinViewport(alert);
    await expect(
      alert.getByRole("button", { name: "Keep draft", exact: true }),
    ).toBeFocused();
    // Alert dialogs require an explicit choice: an outside press cannot dismiss one.
    await page.mouse.click(2, 2);
    await expect(alert).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(alert).toBeHidden();
    await expect(parent).toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(
      parent.locator(`output[aria-label="${panel} interrupted generation"]`),
    ).toHaveText("Draft retained");
    await trigger.press("Enter");
    await alert
      .getByRole("button", { name: "Keep draft", exact: true })
      .click();
    await expect(alert).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await alert
      .getByRole("button", { name: "Discard draft", exact: true })
      .click();
    await expect(alert).toBeHidden();
    await expect(parent).toBeVisible();
    await expect(
      parent.locator(`output[aria-label="${panel} interrupted generation"]`),
    ).toHaveText("Discarded");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(parent).toBeHidden();
    await expect(opener).toBeFocused();
  });
}

test("drawer handle supports a downward dismissal gesture and restores its trigger", async ({
  page,
}, testInfo) => {
  const opener = page.getByRole("button", { name: "Open drawer", exact: true });
  await opener.click();
  const drawer = page.getByRole("dialog", {
    name: "Drawer choices",
    exact: true,
  });
  await expectWithinViewport(drawer);
  const handle = slot(page, "drawer-swipe-handle");
  // Raw pointer coordinates need the same settled actionability check as clicks.
  // Being within the viewport alone does not mean the entrance slide has ended.
  await handle.click({ trial: true });
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const endY = Math.min(page.viewportSize().height - 2, startY + 300);
  if (testInfo.project.use.hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY }],
    });
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY + ((endY - startY) * step) / 8 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 8 });
    await page.mouse.up();
  }
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
});

test("passive tooltips stay out of pointer hit testing while explicit hoverable tooltips remain interactive", async ({
  page,
}, testInfo) => {
  const passive = page.getByRole("button", {
    name: "Passive tooltip",
    exact: true,
  });
  await passive.scrollIntoViewIfNeeded();
  await passive.hover();
  const content = slot(page, "tooltip-content").filter({
    hasText: "Plain tooltip content",
  });
  await expect(content).toBeVisible();
  const positioner = content.locator("..");
  expect(await css(positioner, "pointerEvents")).toBe("none");
  for (const target of [
    content,
    positioner.locator('[data-slot="tooltip-arrow"]'),
  ]) {
    expect(
      await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return Boolean(
          document
            .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.closest('[data-slot="tooltip-positioner"]'),
        );
      }),
    ).toBe(false);
  }
  await attach(content, testInfo, "passive-tooltip");
  await page.mouse.move(0, 0);
  await expect(content).toBeHidden();
  await passive.focus();
  await expect(content).toBeVisible();
  await page
    .getByRole("button", { name: "Hoverable tooltip", exact: true })
    .focus();
  await expect(content).toBeHidden();

  const interactive = page.getByRole("button", {
    name: "Tooltip action",
    exact: true,
  });
  await expect(interactive).toBeVisible();
  await interactive.hover();
  await expect(interactive).toBeVisible();
  await interactive.click();
  await expect(page.getByLabel("Tooltip actions", { exact: true })).toHaveText(
    "1",
  );
});
