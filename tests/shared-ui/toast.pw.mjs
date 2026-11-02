import { expect, test } from "@playwright/test";

test("notifications preserve shaped paint, bounded layout and an operable close control", async ({
  page,
}, testInfo) => {
  await page.goto(
    testInfo.project.metadata.forceCornerFallback ? "/?corner-fallback=1" : "/",
  );
  await page.getByRole("button", { name: "Show notification" }).click();
  const toast = page.locator('[data-slot="toast"]');
  const close = toast.locator('[data-slot="toast-close"]');
  await expect(toast).toBeVisible();
  await expect(toast.locator('[data-slot="toast-title"]')).toHaveText(
    "Document saved",
  );
  const isFallback =
    (await page.locator("html").getAttribute("data-app-corners-fallback")) !==
    null;
  if (isFallback) {
    await expect
      .poll(() => toast.getAttribute("data-hyperellipse-host"))
      .toContain("layer");
  } else {
    await expect(toast).toHaveCSS("corner-shape", "superellipse(1.5)");
  }
  await expect
    .poll(async () => {
      const box = await toast.boundingBox();
      return (
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= page.viewportSize().width &&
        box.y + box.height <= page.viewportSize().height
      );
    })
    .toBe(true);
  await close.hover();
  await expect(toast).toBeVisible();
  const image = testInfo.outputPath("toast-shape.png");
  await toast.screenshot({ path: image, animations: "disabled" });
  await testInfo.attach("Toast shape and close control", {
    path: image,
    contentType: "image/png",
  });
  await close.click();
  await expect(toast).toBeHidden();
});
