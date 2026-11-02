import { expect, test } from "@playwright/test";

async function pixels(page, image) {
  return page.evaluate(async (encoded) => {
    const picture = new globalThis.Image();
    picture.src = `data:image/png;base64,${encoded}`;
    await picture.decode();
    const canvas = document.createElement("canvas");
    canvas.width = picture.width;
    canvas.height = picture.height;
    const context = canvas.getContext("2d");
    context.drawImage(picture, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      data: [...context.getImageData(0, 0, canvas.width, canvas.height).data],
    };
  }, image.toString("base64"));
}
function colorAt(image, x, y) {
  const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4;
  return image.data.slice(offset, offset + 3);
}
const difference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

async function captureWithRing(page, locator) {
  const box = await locator.boundingBox();
  const image = await pixels(
    page,
    await page.screenshot({
      clip: {
        x: box.x - 6,
        y: box.y - 6,
        width: box.width + 12,
        height: box.height + 12,
      },
      animations: "disabled",
    }),
  );
  return { image, scale: image.width / (box.width + 12) };
}

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

test("line tab indicators and default tab focus rings remain visible", async ({
  page,
}) => {
  const line = page.getByRole("tab", { name: "General", exact: true });
  await line.scrollIntoViewIfNeeded();
  for (const focused of [false, true]) {
    if (focused) {
      await line.focus();
    }
    await expect
      .poll(() =>
        line.evaluate((element) => {
          const style = globalThis.getComputedStyle(element);
          const indicator = globalThis.getComputedStyle(element, "::after");
          return {
            radius: style.borderRadius,
            clip: style.clipPath,
            opacity: indicator.opacity,
            width: indicator.width,
            right: indicator.right,
            image: indicator.backgroundImage,
          };
        }),
      )
      .toEqual({
        radius: "0px",
        clip: "none",
        opacity: "1",
        width: "2px",
        right: "-4px",
        image: "none",
      });
  }
  const pill = page.getByRole("tab", { name: "Editor tab", exact: true });
  await pill.scrollIntoViewIfNeeded();
  const before = await captureWithRing(page, pill);
  await pill.focus();
  await expect(pill).toBeFocused();
  await expect
    .poll(async () => {
      const after = await captureWithRing(page, pill);
      return difference(
        colorAt(before.image, 4 * before.scale, before.image.height / 2),
        colorAt(after.image, 4 * after.scale, after.image.height / 2),
      );
    })
    .toBeGreaterThan(12);
});

test("OTP slots keep their width and one-pixel dividers", async ({ page }) => {
  const group = page.locator("[data-slot=input-otp-group]").first();
  await group.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      group.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBe(108);
  // Both divider positions must have the same single-pixel painted width;
  // translucent overlapping or doubled SVG borders would fail this comparison.
  await expect
    .poll(async () => {
      const image = await pixels(
        page,
        await group.screenshot({ animations: "disabled" }),
      );
      const scale = image.width / 108;
      const sample = (x) => colorAt(image, (x + 0.5) * scale, image.height / 2);
      return {
        sameBorder: difference(sample(35), sample(71)),
        sameFill: difference(sample(34), sample(70)),
        firstWidth: difference(sample(34), sample(36)),
        lastWidth: difference(sample(70), sample(72)),
        contrast: difference(sample(35), sample(34)),
      };
    })
    .toEqual({
      sameBorder: 0,
      sameFill: 0,
      firstWidth: 0,
      lastWidth: 0,
      contrast: expect.any(Number),
    });
  const image = await pixels(
    page,
    await group.screenshot({ animations: "disabled" }),
  );
  const scale = image.width / 108;
  expect(
    difference(
      colorAt(image, 35.5 * scale, image.height / 2),
      colorAt(image, 34.5 * scale, image.height / 2),
    ),
  ).toBeGreaterThan(8);
});

test("checkbox hit area remains larger than its shaped paint surface", async ({
  page,
}) => {
  const checkbox = page.getByRole("checkbox", {
    name: "Wrap lines",
    exact: true,
  });
  const surface = checkbox.locator("[data-slot=checkbox-surface]");
  await checkbox.scrollIntoViewIfNeeded();
  await expect(checkbox).not.toBeChecked();
  const before = await captureWithRing(page, surface);
  const uncheckedFill = await surface.evaluate(
    (element) => globalThis.getComputedStyle(element).backgroundColor,
  );
  const box = await checkbox.boundingBox();
  // This point is inside the promised 12px hit extension, outside the 16px paint.
  await page.mouse.click(box.x - 8, box.y + box.height / 2);
  await expect(checkbox).toBeChecked();
  await expect(surface).toHaveAttribute("data-checked", "");
  await expect
    .poll(() =>
      surface.evaluate(
        (element) => globalThis.getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(uncheckedFill);
  await checkbox.press("Space");
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeFocused();
  await expect(surface).not.toHaveAttribute("data-checked");
  await expect
    .poll(async () => {
      const after = await captureWithRing(page, surface);
      return difference(
        colorAt(before.image, 4 * before.scale, before.image.height / 2),
        colorAt(after.image, 4 * after.scale, after.image.height / 2),
      );
    })
    .toBeGreaterThan(12);
});
