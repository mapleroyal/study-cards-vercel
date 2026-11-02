import { expect, test } from "@playwright/test";

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
