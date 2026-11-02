import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto(
    testInfo.project.metadata.forceCornerFallback ? "/?corner-fallback=1" : "/",
  );
  if (testInfo.project.metadata.forceCornerFallback) {
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-corners-fallback",
      "",
    );
  }
  await page.evaluate(() => document.fonts.ready);
});

test("navigation menu supports keyboard entry, bounded content and Escape focus return", async ({
  page,
  browserName,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const trigger = page.getByRole("button", {
    name: "Browse documents",
    exact: true,
  });
  await trigger.focus();
  await trigger.press("ArrowDown");
  const popup = page.locator('[data-slot="navigation-menu-viewport"]');
  const first = popup.getByRole("link", {
    name: "Recent documents",
    exact: true,
  });
  const second = popup.getByRole("link", {
    name: "Pinned documents",
    exact: true,
  });
  await expect(first).toBeVisible();
  // Base opens with ArrowDown and retains the trigger; Tab enters its links.
  await expect(trigger).toBeFocused();
  await trigger.press("Tab");
  await expect(first).toBeFocused();
  // macOS WebKit uses Option-Tab to include ordinary links in keyboard navigation.
  await first.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(second).toBeFocused();
  await expect
    .poll(async () => {
      const box = await popup.boundingBox();
      const viewport = page.viewportSize();
      return (
        box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      );
    })
    .toBeTruthy();
  const surface = popup.locator(':scope > [data-slot="surface-viewport"]');
  await expect(surface).toBeVisible();
  expect(
    await surface.evaluate(
      (element) => globalThis.getComputedStyle(element).overflowX,
    ),
  ).toBe("hidden");
  await second.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("drawer handle dismisses by dragging while preserving modal focus return", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Open drawer",
    exact: true,
  });
  await trigger.click();
  const drawer = page.getByRole("dialog", {
    name: "Recent documents",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  const handle = drawer.locator('[data-slot="drawer-swipe-handle"]');
  await expect(handle).toBeVisible();
  // The available viewport excludes any native scrollbar gutter.
  const availableHeight = await page.evaluate(
    () => document.documentElement.clientHeight,
  );
  // Wait for entrance geometry to settle before starting the gesture.
  await expect
    .poll(async () => {
      const box = await drawer.boundingBox();
      return Math.round(box.y + box.height);
    })
    .toBe(availableHeight - 8);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, availableHeight - 1, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const explicit of [false, true]) {
  test(
    explicit
      ? "drawer handles support explicit opt-in in every direction"
      : "drawer handles are absent by stock default in every direction",
    async ({ page }, testInfo) => {
      for (const direction of ["down", "up", "left", "right"]) {
        const trigger = page.getByTestId(
          (explicit ? "drawer-explicit-" : "drawer-direction-") + direction,
        );
        await trigger.click();
        const drawer = page.getByRole("dialog", {
          name:
            direction +
            (explicit ? " drawer explicit handle" : " drawer orientation"),
          exact: true,
        });
        await expect(drawer).toBeVisible();
        const handle = drawer.locator('[data-slot="drawer-swipe-handle"]');
        if (explicit) {
          await expect(handle).toBeVisible();
          const mark = await handle.locator("span").boundingBox();
          const verticalSwipe = direction === "down" || direction === "up";
          expect(verticalSwipe ? mark.width : mark.height).toBe(100);
          expect(verticalSwipe ? mark.height : mark.width).toBe(6);
        } else {
          await expect(handle).toHaveCount(0);
          if (direction === "left" || direction === "right") {
            expect(
              await drawer.evaluate((element) => {
                const viewport = element.querySelector(
                  '[data-slot="surface-viewport"]',
                );
                return Math.abs(element.clientWidth - viewport.offsetWidth);
              }),
            ).toBeLessThanOrEqual(1);
          }
        }
        await drawer.screenshot({
          path: testInfo.outputPath(
            `drawer-${direction}${explicit ? "-explicit.png" : "-default.png"}`,
          ),
          animations: "disabled",
        });
        await drawer.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(trigger).toBeFocused();
      }
    },
  );
}
