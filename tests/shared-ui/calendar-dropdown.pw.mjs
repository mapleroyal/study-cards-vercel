import { expect, test } from "@playwright/test";

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
  // Highlight can paint before the popup receives its initial keyboard focus.
  const selectedYear = list.getByRole("option", { name: "2026", exact: true });
  await expect(selectedYear).toHaveAttribute("data-highlighted", "");
  await expect(selectedYear).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    list.getByRole("option", { name: "2024", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
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
  await page.setViewportSize({ width: 390, height: 480 });
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
  const arrowSize = metrics.gutter;
  const trackHeight = metrics.height - arrowSize * 2;
  const thumbHeight = Math.max(
    24,
    (trackHeight * metrics.height) / metrics.scrollHeight,
  );
  const x = box.x + box.width - metrics.gutter / 2;
  await page.mouse.move(x, box.y + arrowSize + thumbHeight / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - arrowSize - thumbHeight / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before);
});
