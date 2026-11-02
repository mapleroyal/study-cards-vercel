import { expect, test } from "@playwright/test";

for (const name of [
  "native-scroll",
  "native-message-scroll",
  "native-code-scroll",
]) {
  test(`${name}: thumb-only keyboard, wheel and drag scrolling`, async ({
    page,
    browserName,
  }, testInfo) => {
    await page.goto("/");
    const viewport = page.getByTestId(name);
    await viewport.scrollIntoViewIfNeeded();
    const parts = await viewport.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      const bar = globalThis.getComputedStyle(element, "::-webkit-scrollbar");
      const track = globalThis.getComputedStyle(
        element,
        "::-webkit-scrollbar-track",
      );
      const arrow = globalThis.getComputedStyle(
        element,
        "::-webkit-scrollbar-button",
      );
      return {
        width: style.scrollbarWidth,
        color: style.scrollbarColor,
        bar: bar.width,
        track: track.backgroundColor,
        arrow: arrow.display,
        overflow:
          element.scrollHeight > element.clientHeight &&
          element.scrollWidth > element.clientWidth,
      };
    });
    // Either non-auto standard property disables all WebKit scrollbar parts,
    // even when getComputedStyle(pseudo) misleadingly reports our custom rules.
    expect(parts).toEqual({
      width: "auto",
      color: "auto",
      bar: "14px",
      track: "rgba(0, 0, 0, 0)",
      arrow: "none",
      overflow: true,
    });
    const position = () => viewport.evaluate((element) => element.scrollTop);
    const reset = async () => {
      await page.waitForTimeout(150);
      await viewport.evaluate((element) => element.scrollTo(0, 0));
      await expect.poll(position).toBe(0);
    };
    await viewport.evaluate((element) => (element.tabIndex = 0));
    await viewport.focus();
    await viewport.press("ArrowDown", { delay: 80 });
    await expect.poll(position).toBeGreaterThan(0);
    await reset();
    await viewport.hover();
    await page.mouse.wheel(0, 100);
    await expect.poll(position).toBeGreaterThan(0);
    await reset();
    // Thumb dragging is qualified in Chromium on macOS and Linux.
    // Keyboard/wheel behavior and scrollbar styling remain cross-browser.
    if (browserName === "chromium") {
      const geometry = await viewport.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          x: box.left + element.clientLeft + element.clientWidth + 7,
          y: box.top + element.clientTop,
          height: element.clientHeight,
          thumb: Math.max(
            24,
            (element.clientHeight * element.clientHeight) /
              element.scrollHeight,
          ),
        };
      });
      await page.mouse.move(geometry.x, geometry.y + geometry.thumb / 2);
      await page.mouse.down();
      await page.mouse.move(geometry.x, geometry.y + geometry.height - 15, {
        steps: 10,
      });
      await page.mouse.up();
      await expect.poll(position).toBeGreaterThan(100);
    }
    await reset();
    await viewport.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      animations: "disabled",
    });
  });
}

test("chat autoscroll hides only the thumb without enabling native tracks or arrows", async ({
  page,
}) => {
  await page.goto("/");
  const viewport = page.getByTestId("native-message-scroll");
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate((element) =>
    element.setAttribute("data-autoscrolling", ""),
  );
  const colors = () =>
    viewport.evaluate((element) => ({
      width: globalThis.getComputedStyle(element).scrollbarWidth,
      color: globalThis.getComputedStyle(element).scrollbarColor,
      thumb: globalThis.getComputedStyle(element, "::-webkit-scrollbar-thumb")
        .backgroundColor,
    }));
  await expect
    .poll(colors)
    .toEqual({ width: "auto", color: "auto", thumb: "rgba(0, 0, 0, 0)" });
  await viewport.hover();
  await expect
    .poll(colors)
    .toEqual({ width: "auto", color: "auto", thumb: "rgba(0, 0, 0, 0)" });
  await viewport.evaluate((element) =>
    element.removeAttribute("data-autoscrolling"),
  );
  await expect
    .poll(async () => (await colors()).thumb)
    .not.toBe("rgba(0, 0, 0, 0)");
});
