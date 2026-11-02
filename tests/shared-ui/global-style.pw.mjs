import { expect, test } from "@playwright/test";

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
  await page.goto("/");
  await expect(page.getByTestId("native-scroll")).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
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
  if (supported) {
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
  await page.mouse.move(box.x + 20, box.y + 20);
  await attach(area, testInfo, "native-scrollbar");
});
