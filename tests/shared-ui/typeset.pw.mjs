import { expect, test } from "@playwright/test";

const styles = (locator) =>
  locator.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      font: style.fontFamily,
      size: parseFloat(style.fontSize),
      leading: parseFloat(style.lineHeight),
      color: style.color,
      margin: parseFloat(style.marginBlockStart),
      weight: style.fontWeight,
    };
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("typeset-reading")).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
});

test("content presets inherit the local fonts and appearance with distinct reading rhythms", async ({
  page,
}) => {
  const compact = page.viewportSize().width < 768 ? 1.125 : 1;
  const documentStyle = await styles(page.getByTestId("typeset-docs"));
  const chatStyle = await styles(page.getByTestId("typeset-chat"));
  const readingStyle = await styles(page.getByTestId("typeset-reading"));
  expect(documentStyle.size).toBeCloseTo(16 * compact);
  expect(chatStyle.size).toBeCloseTo(14 * compact);
  expect(readingStyle.size).toBeCloseTo(18 * compact);
  expect(documentStyle.leading / documentStyle.size).toBeCloseTo(1.75);
  expect(chatStyle.leading / chatStyle.size).toBeCloseTo(1.6);
  expect(readingStyle.leading / readingStyle.size).toBeCloseTo(1.85);
  const body = await styles(page.locator("body"));
  expect(documentStyle.font).toContain("Inter Variable");
  expect(documentStyle.color).toBe(body.color);
  expect((await styles(page.getByTestId("typeset-code"))).font).toContain(
    "Cascadia Code Variable",
  );
  const initialColor = documentStyle.color;
  await page.evaluate(() => document.documentElement.classList.toggle("dark"));
  const changed = await styles(page.getByTestId("typeset-docs"));
  expect(changed.color).not.toBe(initialColor);
  expect(changed.color).toBe((await styles(page.locator("body"))).color);
});

test("semantic text utilities and embedded UI retain control inside rendered content", async ({
  page,
}) => {
  const override = await styles(page.getByTestId("typeset-utility-override"));
  expect(override).toMatchObject({ size: 12, leading: 16, weight: "500" });
  const island = page.getByTestId("typeset-island");
  for (const paragraph of await island.locator("p").all()) {
    expect((await styles(paragraph)).margin).toBe(0);
  }
  const embeddedButton = await styles(
    page.getByTestId("typeset-embedded-button"),
  );
  expect(embeddedButton).toMatchObject({
    size: 14,
    leading: 20,
    weight: "500",
  });
});

test("streaming appends preserve earlier block positions and table row styles", async ({
  page,
}) => {
  const stable = page.getByTestId("typeset-docs").locator("[data-stable]");
  const snapshot = () =>
    stable.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        return {
          top: rect.top + globalThis.scrollY,
          height: rect.height,
          margin: style.marginBlockStart,
          border: style.borderBlockEndWidth,
          font: style.font,
        };
      }),
    );
  const before = await snapshot();
  await page
    .getByRole("button", { name: "Append content", exact: true })
    .click();
  await expect(page.getByTestId("typeset-appended")).toBeVisible();
  expect(await snapshot()).toEqual(before);
});

test("wide content scrolls inside its container without widening narrow layouts", async ({
  page,
}) => {
  for (const testId of ["typeset-code", "typeset-table-scroll"]) {
    const metrics = await page.getByTestId(testId).evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
      overflow: globalThis.getComputedStyle(element).overflowX,
      right: element.getBoundingClientRect().right,
      viewport: document.documentElement.clientWidth,
    }));
    expect(metrics.overflow).toBe("auto");
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewport);
    if (page.viewportSize().width < 768) {
      expect(metrics.scroll).toBeGreaterThan(metrics.client);
    }
  }
});
