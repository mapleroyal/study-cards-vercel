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
const colorAt = (image, x, y) =>
  image.data.slice(
    (Math.round(y) * image.width + Math.round(x)) * 4,
    (Math.round(y) * image.width + Math.round(x)) * 4 + 3,
  );
const difference = (a, b) =>
  Math.max(...a.map((value, index) => Math.abs(value - b[index])));
const style = (locator, property, pseudo = null) =>
  locator.evaluate(
    (element, [name, part]) =>
      globalThis.getComputedStyle(element, part).getPropertyValue(name),
    [property, pseudo],
  );
const fallback = (page) =>
  page.evaluate(() =>
    document.documentElement.hasAttribute("data-app-corners-fallback"),
  );

async function settled(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(resolve),
        ),
      ),
  );
}
async function paintReady(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  if (await fallback(page)) {
    await expect
      .poll(
        async () =>
          (await style(locator, "clip-path")) !== "none" ||
          (await locator.getAttribute("data-hyperellipse-host"))?.includes(
            "layer",
          ),
      )
      .toBeTruthy();
  }
  await settled(page);
}
async function captureRing(page, locator) {
  const box = await locator.boundingBox();
  return pixels(
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
}
async function attach(locator, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await locator.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ page }, testInfo) => {
  const force = Boolean(testInfo.project.metadata.forceCornerFallback);
  await page.goto(force ? "/?corner-fallback=1" : "/");
  if (force) {
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-corners-fallback",
      "",
    );
  }
  await expect(page.getByTestId("corner-stage")).toBeVisible();
  await settled(page);
});

test("painted app corners are superellipses while semantic circles remain circular", async ({
  page,
}, testInfo) => {
  const shape = page.getByTestId("corner-shape-probe");
  const circle = page.getByTestId("corner-circle-probe");
  await paintReady(page, shape);
  const shapeImage = await pixels(page, await shape.screenshot());
  const circleImage = await pixels(page, await circle.screenshot());
  // This point is inside superellipse(1.5), but outside a circle/rounded arc.
  expect(difference(colorAt(shapeImage, 8, 8), [20, 28, 40])).toBeLessThan(15);
  expect(difference(colorAt(circleImage, 8, 8), [240, 242, 246])).toBeLessThan(
    15,
  );
  expect(difference(colorAt(shapeImage, 0, 0), [240, 242, 246])).toBeLessThan(
    15,
  );
  expect(await circle.getAttribute("data-hyperellipse-host")).toBeNull();
  expect(await style(circle, "clip-path")).toBe("none");
  await attach(page.getByTestId("corner-stage"), testInfo, "corner-paint");
});

test("native fields retain their fill and visible focus and invalid rings", async ({
  page,
}, testInfo) => {
  for (const name of ["Corner field", "Corner notes"]) {
    const field = page.getByRole("textbox", { name, exact: true });
    const surface = field.locator("..");
    await paintReady(page, surface);
    const unfocused = await captureRing(page, surface);
    await field.focus();
    await expect(field).toBeFocused();
    await expect
      .poll(() =>
        field.evaluate((element) => element.matches(":focus-visible")),
      )
      .toBe(true);
    if (await fallback(page)) {
      await expect(surface).toHaveAttribute("data-hyperellipse-host", /layer/);
    }
    await expect
      .poll(async () => {
        const focused = await captureRing(page, surface);
        return difference(
          colorAt(unfocused, 4, unfocused.height / 2),
          colorAt(focused, 4, focused.height / 2),
        );
      })
      .toBeGreaterThan(12);
    const focused = await captureRing(page, surface);
    expect(
      difference(colorAt(focused, 12, 16), colorAt(focused, 0, 16)),
    ).toBeGreaterThan(3);
    await field.evaluate((element) =>
      element.setAttribute("aria-invalid", "true"),
    );
    await expect
      .poll(async () => {
        const invalid = await captureRing(page, surface);
        return difference(
          colorAt(focused, 4, focused.height / 2),
          colorAt(invalid, 4, invalid.height / 2),
        );
      })
      .toBeGreaterThan(12);
    await field.evaluate((element) => element.removeAttribute("aria-invalid"));
    await attach(surface, testInfo, name.toLowerCase().replaceAll(" ", "-"));
    await field.blur();
  }
});

test("keyboard state changes repaint toggles and highlighted menu items", async ({
  page,
}, testInfo) => {
  const toggle = page.getByRole("button", {
    name: "Corner toggle",
    exact: true,
  });
  await paintReady(page, toggle);
  await toggle.focus();
  await settled(page);
  const before = await pixels(page, await toggle.screenshot());
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => {
      const after = await pixels(page, await toggle.screenshot());
      return difference(
        colorAt(before, before.width / 2, 5),
        colorAt(after, after.width / 2, 5),
      );
    })
    .toBeGreaterThan(20);
  const select = page.getByRole("combobox", {
    name: "Corner format",
    exact: true,
  });
  await select.focus();
  await page.keyboard.press("ArrowDown");
  const list = page.locator('[data-slot="select-list"]');
  await expect(list).toBeVisible();
  // The popup can paint before its initial keyboard focus has moved.
  await expect(
    list.getByRole("option", { name: "Markdown", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const option = page
    .locator('[data-slot="select-list"]')
    .getByRole("option", { name: "Plain text", exact: true });
  await expect(option).toHaveAttribute("data-highlighted", "");
  await paintReady(page, option);
  const background = await style(option, "background-color");
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  await attach(
    page.locator('[data-slot="select-list"]'),
    testInfo,
    "highlighted-options",
  );
  await page.keyboard.press("Enter");
  await expect(select).toContainText("Plain text");
});

test("full bleed image and dialog footer paint stay inside the outer corners", async ({
  page,
}, testInfo) => {
  const card = page.getByTestId("corner-image-card");
  await paintReady(page, card);
  await card.locator("img").evaluate((element) => element.decode());
  // The single shell token also shapes its clipped content, including after a
  // viewport-only repaint (the fallback replaces the shell's border-radius).
  const viewport = card.locator('[data-slot="surface-viewport"]');
  await viewport.evaluate((element) => {
    element.style.opacity = "0.99";
  });
  await settled(page);
  const cardPixels = await pixels(page, await card.screenshot());
  expect(colorAt(cardPixels, cardPixels.width / 2, 8)[0]).toBeGreaterThan(220);
  for (const [x, y] of [
    [5, 5],
    [cardPixels.width - 6, 5],
    [1, 1],
    [cardPixels.width - 2, 1],
    [1, cardPixels.height - 2],
  ]) {
    const pixel = colorAt(cardPixels, x, y);
    expect(pixel[0] - Math.max(pixel[1], pixel[2])).toBeLessThan(30);
  }
  await attach(
    page.getByTestId("corner-card-stage"),
    testInfo,
    "clipped-card-image",
  );
  await page
    .getByRole("button", { name: "Corner dialog", exact: true })
    .click();
  const dialog = page.getByTestId("corner-dialog");
  await expect(dialog).toBeVisible();
  await paintReady(page, dialog);
  const footer = page.getByTestId("corner-footer");
  await expect(footer).toBeVisible();
  const dialogPixels = await pixels(page, await dialog.screenshot());
  const footerCenter = colorAt(
    dialogPixels,
    dialogPixels.width / 2,
    dialogPixels.height - 3,
  );
  expect(
    footerCenter[0] - Math.max(footerCenter[1], footerCenter[2]),
  ).toBeGreaterThan(180);
  // A neutral, empty backdrop isolates the actual outside shadow from the
  // gallery's controls underneath this portal. The popup's styles stay intact.
  await page.addStyleTag({
    content:
      "body { background: rgb(240, 242, 246) !important; } body > #root { visibility: hidden; }",
  });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  const shadowShot = await page.screenshot({
    clip: {
      x: bounds.x - 12,
      y: bounds.y - 12,
      width: bounds.width + 24,
      height: bounds.height + 24,
    },
    animations: "disabled",
  });
  const shadowPixels = await pixels(page, shadowShot);
  expect(
    difference(
      colorAt(shadowPixels, 1, shadowPixels.height / 2),
      colorAt(shadowPixels, 10, shadowPixels.height / 2),
    ),
  ).toBeGreaterThan(2);
  await testInfo.attach("dialog-outside-shadow", {
    body: shadowShot,
    contentType: "image/png",
  });
  for (const x of [1, dialogPixels.width - 2]) {
    const pixel = colorAt(dialogPixels, x, dialogPixels.height - 2);
    expect(pixel[0] - Math.max(pixel[1], pixel[2])).toBeLessThan(30);
  }
  await attach(dialog, testInfo, "clipped-dialog-footer");
});

test("corner paint follows resize and theme changes then becomes idle", async ({
  page,
}, testInfo) => {
  const field = page.getByRole("textbox", {
    name: "Corner field",
    exact: true,
  });
  const surface = field.locator("..");
  await paintReady(page, surface);
  await field.focus();
  if (await fallback(page)) {
    await expect(surface).toHaveAttribute("data-hyperellipse-host", /layer/);
  }
  const before = await pixels(page, await surface.screenshot());
  await page.evaluate(() => document.documentElement.classList.toggle("dark"));
  await expect
    .poll(async () => {
      const after = await pixels(page, await surface.screenshot());
      return difference(
        colorAt(before, 6, before.height / 2),
        colorAt(after, 6, after.height / 2),
      );
    })
    .toBeGreaterThan(60);
  const viewport = page.viewportSize();
  await page.setViewportSize({
    width: Math.max(320, viewport.width - 60),
    height: viewport.height,
  });
  await settled(page);
  const resized = await captureRing(page, surface);
  expect(
    difference(
      colorAt(resized, 4, resized.height / 2),
      colorAt(resized, 0, resized.height / 2),
    ),
  ).toBeGreaterThan(12);
  await field.blur();
  await settled(page);
  // Ignore animation elsewhere in the gallery; an idle control should not
  // continuously rebuild its SVG or trigger its own observer.
  await page.waitForTimeout(300);
  const samples = [];
  await expect
    .poll(
      async () => {
        const records = await surface.evaluate(
          (element) =>
            new Promise((resolve) => {
              const changes = [];
              const started = globalThis.performance.now();
              const observer = new globalThis.MutationObserver((mutations) => {
                changes.push(
                  ...mutations.map(({ attributeName }) => ({
                    attributeName,
                    at: Math.round(globalThis.performance.now() - started),
                  })),
                );
              });
              observer.observe(element, { attributes: true, subtree: true });
              setTimeout(() => {
                observer.disconnect();
                resolve(changes);
              }, 250);
            }),
        );
        samples.push(records);
        return records.length;
      },
      {
        timeout: 10000,
        message:
          "corner paint should settle without a continuing mutation loop",
      },
    )
    .toBe(0);
  await testInfo.attach("idle-paint-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  await attach(
    page.getByTestId("corner-controls"),
    testInfo,
    "resized-themed-controls",
  );
});

test("tooltip arrow paints outside the shaped popup", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "Preview shortcut", exact: true })
    .hover();
  const popup = page.locator('[data-slot="tooltip-content"]');
  const arrow = page.locator('[data-slot="tooltip-arrow"]');
  await expect(popup).toBeVisible();
  await paintReady(page, popup);
  const popupBox = await popup.boundingBox();
  const arrowBox = await arrow.boundingBox();
  expect(arrowBox.y + arrowBox.height).toBeGreaterThan(
    popupBox.y + popupBox.height + 1,
  );
  const clip = {
    x: Math.floor(popupBox.x - 2),
    y: Math.floor(popupBox.y - 2),
    width: Math.ceil(popupBox.width + 4),
    height: Math.ceil(popupBox.height + 10),
  };
  const screenshot = await page.screenshot({ clip, animations: "disabled" });
  const painted = await pixels(page, screenshot);
  const foreground = (await style(arrow, "background-color"))
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number);
  const tip = colorAt(
    painted,
    arrowBox.x + arrowBox.width / 2 - clip.x,
    popupBox.y + popupBox.height + 2 - clip.y,
  );
  expect(difference(tip, foreground)).toBeLessThan(35);
  await testInfo.attach("tooltip-arrow", {
    body: screenshot,
    contentType: "image/png",
  });
});
