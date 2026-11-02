import { expect, test } from "@playwright/test";

const visual = (locator) =>
  locator.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return [
      style.backgroundColor,
      style.color,
      style.borderColor,
      globalThis.getComputedStyle(element, "::before").backgroundColor,
      globalThis.getComputedStyle(element, "::after").backgroundColor,
    ].join("|");
  });
// Fallback surfaces paint their border/fill into SVG background layers.
const paintedVisual = (locator) =>
  locator.evaluate((element) =>
    [null, "::before", "::after"]
      .flatMap((pseudo) => {
        const style = globalThis.getComputedStyle(element, pseudo);
        return [
          style.backgroundColor,
          style.borderColor,
          style.color,
          style.backgroundImage,
        ];
      })
      .join("|"),
  );
const computed = (locator, property) =>
  locator.evaluate(
    (element, name) => globalThis.getComputedStyle(element)[name],
    property,
  );

for (const fallback of [false, true]) {
  test.describe(fallback ? "fallback corners" : "native corners", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(fallback ? "/?corner-fallback=1" : "/");
      await page.evaluate(() => document.fonts.ready);
      if (fallback) {
        await expect(page.locator("html")).toHaveAttribute(
          "data-app-corners-fallback",
          "",
        );
      }
    });

    test("text triggers own label insets while composed icons keep their fixed hit area", async ({
      page,
    }, testInfo) => {
      const section = page.getByTestId("interaction-defaults");
      for (const name of [
        "action-text",
        "field-select",
        "field-combobox",
        "trigger-collapsible",
        "trigger-menu",
        "trigger-popover",
        "trigger-trace",
        "trigger-dialog",
        "trigger-alert-dialog",
        "trigger-sheet",
        "trigger-drawer",
      ]) {
        const control = page.getByTestId(name);
        await control.scrollIntoViewIfNeeded();
        const padding = await control.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const label = element
            .querySelector("[data-label]")
            .getBoundingClientRect();
          return {
            left: label.left - box.left,
            right: box.right - label.right,
            padding: parseFloat(
              globalThis.getComputedStyle(element).paddingLeft,
            ),
          };
        });
        expect(padding.left, name).toBeGreaterThanOrEqual(12);
        expect(padding.right, name).toBeGreaterThanOrEqual(12);
        expect(padding.padding, name).toBe(12);
      }
      for (const name of ["action-icon", "trigger-icon"]) {
        const box = await page.getByTestId(name).boundingBox();
        expect(box.width).toBe(36);
        expect(box.height).toBe(36);
      }
      const trace = page.getByTestId("trigger-trace");
      await trace.click();
      await expect(
        page.getByText("Reasoning details", { exact: true }),
      ).toBeVisible();
      await trace.press("Space");
      await expect(
        page.getByText("Reasoning details", { exact: true }),
      ).toBeHidden();
      await section.screenshot({
        path: testInfo.outputPath("interaction-defaults.png"),
        animations: "disabled",
      });
    });

    test("editable fields and binary controls retain visible hover feedback", async ({
      page,
    }) => {
      const targets = [
        page
          .getByRole("textbox", { name: "Hover text field", exact: true })
          .locator(".."),
        page
          .getByRole("textbox", { name: "Hover textarea", exact: true })
          .locator(".."),
        page.getByRole("combobox", { name: "Editable combobox" }).locator(".."),
        page
          .getByRole("combobox", { name: "Hover native selection" })
          .locator(".."),
        page
          .getByTestId("hover-checkbox")
          .locator('[data-slot="checkbox-surface"]'),
        page.getByTestId("hover-radio"),
        page.getByTestId("hover-switch"),
        page.getByTestId("hover-toggle"),
      ];
      for (const target of targets) {
        await target.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(180);
        const before = await paintedVisual(target);
        const hitTarget =
          (await target.getAttribute("data-slot")) === "checkbox-surface"
            ? target.locator("..")
            : target;
        await hitTarget.hover();
        await expect.poll(() => paintedVisual(target)).not.toBe(before);
      }
    });

    test("actions, selection fields and disclosure triggers have coherent hover and cursor semantics", async ({
      page,
    }) => {
      // WebKit exposes cursor:auto for native links/text fields and resolves
      // their pointer/I-beam at hit testing. Compare each browser's defaults.
      const nativeCursor = await page.evaluate(() => {
        const link = document.createElement("a");
        link.href = "#native-cursor-reference";
        const input = document.createElement("input");
        input.type = "text";
        document.body.append(link, input);
        const cursor = {
          link: globalThis.getComputedStyle(link).cursor,
          input: globalThis.getComputedStyle(input).cursor,
        };
        link.remove();
        input.remove();
        return cursor;
      });
      for (const name of [
        "action-text",
        "action-icon",
        "action-current",
        "field-select",
        "field-combobox",
        "trigger-collapsible",
        "trigger-menu",
        "trigger-popover",
        "trigger-trace",
        "trigger-dialog",
        "trigger-alert-dialog",
        "trigger-sheet",
        "trigger-drawer",
      ]) {
        const control = page.getByTestId(name);
        await control.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(180);
        const before = await visual(control);
        await control.hover();
        await expect
          .poll(() => visual(control), {
            message: `${name} must visibly respond to hover`,
          })
          .not.toBe(before);
        expect(await computed(control, "cursor"), name).toBe(
          name === "action-current" ? nativeCursor.link : "default",
        );
        expect(await computed(control, "opacity"), name).toBe("1");
      }
      const disabled = page.getByTestId("action-disabled");
      await expect(disabled).toBeDisabled();
      expect(await computed(disabled, "pointerEvents")).toBe("none");
      const select = page.getByTestId("field-select");
      const combo = page.getByTestId("field-combobox");
      await select.hover();
      await page.waitForTimeout(180);
      const selectHover = await visual(select);
      await combo.hover();
      await page.waitForTimeout(180);
      expect(await visual(combo)).toBe(selectHover);
      const input = page.getByRole("combobox", { name: "Editable combobox" });
      await input.hover();
      expect(await computed(input, "cursor")).toBe(nativeCursor.input);
      const inlineButton = input
        .locator("..")
        .getByRole("button", { name: "Show options" });
      const box = await inlineButton.boundingBox();
      expect(box.width).toBe(24);
      expect(box.height).toBe(24);
    });
  });
}
