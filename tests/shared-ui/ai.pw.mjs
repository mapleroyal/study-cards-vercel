import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

const region = (page, name) => page.getByRole("region", { name, exact: true });
const chatRegion = (page) => region(page, "AI conversation");

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto(
    testInfo.project.metadata.forceCornerFallback ? "/?corner-fallback=1" : "/",
  );
  await expect(chatRegion(page)).toBeVisible();
});

test("AI composer handles IME, multiline input, files and the real SDK stream lifecycle", async ({
  page,
  context,
  browserName,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const chat = chatRegion(page);
  const input = chat.getByRole("textbox", { name: "Demo message" });
  await input.fill("First line");
  await input.press("Shift+Enter");
  await input.press("e");
  await expect(input).toHaveValue("First line\ne");
  await input.evaluate((element) =>
    element.dispatchEvent(
      new globalThis.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    ),
  );
  await expect(chat.locator("[data-ai-message]")).toHaveCount(0);
  await chat.locator('input[type="file"]').setInputFiles([
    {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Local file"),
    },
  ]);
  await expect(chat.getByText("notes.txt", { exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Remove notes.txt" }).click();
  await expect(chat.getByText("notes.txt", { exact: true })).toHaveCount(0);
  await chat.locator('input[type="file"]').setInputFiles([
    {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Local file"),
    },
  ]);
  await input.press("Enter");
  await expect(
    chat.getByRole("button", { name: "Stop response" }),
  ).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(chat.locator("[data-ai-chat]")).toHaveAttribute(
    "data-status",
    "ready",
    { timeout: 15000 },
  );
  await expect(chat.locator("[data-ai-message]")).toHaveCount(2);
  await expect(
    chat.getByRole("heading", { name: "A shared foundation" }),
  ).toBeAttached();
  await expect(chat.getByText("notes.txt", { exact: true })).toBeAttached();
  const code = chat.locator('[data-slot="code-block"]').last();
  await expect(code.locator('[data-slot="code-block-line"]')).toHaveCount(2);
  await expect(code.locator('[style*="--shiki-light"]').first()).toBeAttached();
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await code.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    code.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  if (browserName === "chromium") {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'const appearance = "system";\nconsole.log(appearance);',
    );
  }
  expect(errors).toEqual([]);
});

test("stopping cancels streaming, preserves partial text and permits another turn", async ({
  page,
}) => {
  const chat = chatRegion(page);
  await chat
    .getByRole("textbox", { name: "Demo message" })
    .fill("Start a response");
  await chat.getByRole("button", { name: "Send message" }).click();
  await expect(chat.locator("[data-ai-response]")).not.toHaveCount(0);
  await chat.getByRole("button", { name: "Stop response" }).click();
  await expect(chat.locator("[data-ai-chat]")).toHaveAttribute(
    "data-status",
    "ready",
  );
  const stopped = await chat.locator("[data-ai-response]").allTextContents();
  await page.waitForTimeout(160);
  expect(await chat.locator("[data-ai-response]").allTextContents()).toEqual(
    stopped,
  );
  await expect(chat.getByRole("alert")).toHaveCount(0);
  await chat
    .getByRole("textbox", { name: "Demo message" })
    .fill("A second turn");
  await chat.getByRole("button", { name: "Send message" }).click();
  await expect(chat.locator("[data-ai-chat]")).toHaveAttribute(
    "data-status",
    "ready",
    { timeout: 15000 },
  );
  await expect(chat.locator("[data-ai-message]")).toHaveCount(4);
});

test("transport errors stay visible and can be retried without uncaught rejections", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const chat = region(page, "AI error verification");
  await chat
    .getByRole("textbox", { name: "Error demo message" })
    .fill("Try an error");
  await chat.getByRole("button", { name: "Send message" }).click();
  await expect(chat.getByRole("alert")).toContainText("Demo transport failure");
  await chat.getByRole("button", { name: "Retry response" }).click();
  await expect(chat.getByRole("alert")).toContainText("Demo transport failure");
  expect(errors).toEqual([]);
});

test("tool approval requires a decision and failed tool details remain accessible", async ({
  page,
}) => {
  const states = region(page, "Agent states");
  await states.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    states.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  await expect(states.getByText("Completed", { exact: true })).toBeVisible();
  await states.getByRole("button", { name: /check.*Failed/ }).click();
  await expect(
    states.getByText("File unavailable", { exact: true }),
  ).toBeVisible();
});

test("questionnaire retains required answers across navigation and serializes the form", async ({
  page,
}) => {
  const questions = region(page, "Agent clarification");
  await questions.getByRole("radio", { name: "Web app", exact: true }).check();
  await questions.getByRole("button", { name: "Next", exact: true }).click();
  await questions
    .getByRole("textbox", { name: "Optional details" })
    .fill("Keep system appearance");
  await questions
    .getByRole("button", { name: "Previous", exact: true })
    .click();
  await expect(
    questions.getByRole("radio", { name: "Web app", exact: true }),
  ).toBeChecked();
  await questions.getByRole("button", { name: "Next", exact: true }).click();
  await questions.getByRole("button", { name: "Save answers" }).click();
  await expect(questions.getByTestId("questionnaire-answer")).toContainText(
    '"direction":"web"',
  );
  await expect(questions.getByTestId("questionnaire-answer")).toContainText(
    "Keep system appearance",
  );
});

test("Typeset owns streaming rhythm and appends do not restyle previous blocks", async ({
  page,
}) => {
  const response = page.getByTestId("stable-response");
  const measure = () =>
    response.locator("h2, p").evaluateAll((elements) => {
      const rootTop = elements[0]
        .closest("[data-ai-response]")
        .getBoundingClientRect().top;
      return elements.map((element) => ({
        top: element.getBoundingClientRect().top - rootTop,
        margin: globalThis.getComputedStyle(element).marginBlockStart,
        size: globalThis.getComputedStyle(element).fontSize,
      }));
    });
  const before = await measure();
  expect(parseFloat(before[2].margin)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Append response block" }).click();
  await expect(
    response.getByRole("heading", { name: "Appended heading" }),
  ).toBeVisible();
  expect((await measure()).slice(0, 3)).toEqual(before);
  expect(await page.evaluate(() => window.aiUnsafe)).toBeUndefined();
  await expect(
    page
      .getByTestId("hostile-response")
      .locator("script, img, a[href^='javascript:']"),
  ).toHaveCount(0);
});

test("transcript follows the live edge, respects scrolling away and preserves prepended history", async ({
  page,
}) => {
  const scroll = region(page, "Transcript scrolling");
  const viewport = scroll.getByTestId("history-viewport");
  const remaining = () =>
    viewport.evaluate(
      (element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop,
    );
  await expect.poll(remaining).toBeLessThan(2);
  await scroll.getByRole("button", { name: "Stream more" }).click();
  await expect(scroll.getByRole("button", { name: "Stream more" })).toBeEnabled(
    { timeout: 10000 },
  );
  await expect.poll(remaining).toBeLessThan(2);
  await viewport.hover();
  await page.mouse.wheel(0, -500);
  await expect.poll(remaining).toBeGreaterThan(300);
  const top = await viewport.evaluate((element) => element.scrollTop);
  await scroll.getByRole("button", { name: "Stream more" }).click();
  await expect(scroll.getByRole("button", { name: "Stream more" })).toBeEnabled(
    { timeout: 10000 },
  );
  expect(
    Math.abs((await viewport.evaluate((element) => element.scrollTop)) - top),
  ).toBeLessThan(2);
  await viewport.hover();
  await page.mouse.wheel(0, -1500);
  await page.waitForTimeout(150);
  const anchor = await viewport.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const row = [...element.querySelectorAll("[data-row]")].find(
      (item) => item.getBoundingClientRect().bottom > bounds.top,
    );
    return {
      id: row.dataset.row,
      offset: row.getBoundingClientRect().top - bounds.top,
    };
  });
  await scroll.getByRole("button", { name: "Load earlier" }).click();
  await expect
    .poll(() =>
      viewport
        .locator(`[data-row="${anchor.id}"]`)
        .evaluate(
          (element) =>
            element.getBoundingClientRect().top -
            element
              .closest('[data-testid="history-viewport"]')
              .getBoundingClientRect().top,
        ),
    )
    .toBeCloseTo(anchor.offset, 0);
});

test("enhanced content loads on demand with safe math, themed diagrams and CJK", async ({
  page,
}) => {
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("blocked-image.invalid")) {
      external.push(request.url());
    }
  });
  expect(
    await page.evaluate(() =>
      globalThis.performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("rich-response-content")),
    ),
  ).toBe(false);
  const enhanced = region(page, "Enhanced responses");
  await enhanced.getByRole("button", { name: "Load enhanced content" }).click();
  const response = enhanced.getByTestId("enhanced-response");
  await expect(response.locator(".katex-mathml math")).toHaveCount(2);
  await expect(response.locator(".katex-html")).toHaveCount(2);
  await expect(response.locator(".katex-html").first()).toBeVisible();
  await expect(response.locator("strong")).toHaveText("重要。");
  await expect(response).toContainText("Price: $10.");
  await expect(response.locator('[data-slot="code-block-line"]')).toHaveCount(
    1,
  );
  const diagram = response.locator("[data-ai-diagram]");
  await expect(
    diagram.getByRole("img", { name: "Mermaid diagram" }).locator("svg"),
  ).toBeVisible();
  await expect(
    diagram.locator(
      "a[href], a[*|href], foreignObject, image, script, [onclick]",
    ),
  ).toHaveCount(0);
  await expect(
    enhanced.getByTestId("unsafe-math").locator("a, img, image, script"),
  ).toHaveCount(0);
  await expect(
    enhanced.getByTestId("restricted-diagrams").getByRole("status"),
  ).toHaveCount(6);
  await expect(
    enhanced
      .getByTestId("restricted-diagrams")
      .getByRole("img", { name: "Mermaid diagram" }),
  ).toHaveCount(0);
  expect(
    await diagram
      .getByRole("img", { name: "Mermaid diagram" })
      .locator("svg")
      .evaluate((svg) => {
        const bounds = svg.getBoundingClientRect();
        const nodes = [...svg.querySelectorAll(".node")];
        return (
          nodes.length === 2 &&
          nodes.every((node) => {
            const box = node.getBoundingClientRect();
            return (
              box.left >= bounds.left - 1 &&
              box.top >= bounds.top - 1 &&
              box.right <= bounds.right + 1 &&
              box.bottom <= bounds.bottom + 1
            );
          })
        );
      }),
  ).toBe(true);
  const dark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  await expect(diagram).toHaveAttribute(
    "data-diagram-theme",
    dark ? "dark" : "light",
  );
  await page.evaluate(() => document.documentElement.classList.toggle("dark"));
  await expect(diagram).toHaveAttribute(
    "data-diagram-theme",
    dark ? "light" : "dark",
  );
  await expect(
    diagram.getByRole("img", { name: "Mermaid diagram" }).locator("svg"),
  ).toBeVisible();
  await diagram.getByRole("button", { name: "Source", exact: true }).click();
  await expect(
    diagram.locator('[data-slot="code-block-content"]'),
  ).toContainText("graph LR");
  await diagram.getByRole("button", { name: "Diagram", exact: true }).click();
  await expect(
    diagram.getByRole("img", { name: "Mermaid diagram" }),
  ).toBeVisible();
  const streaming = enhanced.getByTestId("streaming-diagram");
  await expect(streaming.locator("[data-ai-diagram]")).toBeVisible();
  await expect(
    streaming.getByRole("img", { name: "Mermaid diagram" }),
  ).toHaveCount(0);
  await enhanced.getByRole("button", { name: "Complete diagram" }).click();
  await expect(
    streaming.getByRole("img", { name: "Mermaid diagram" }).locator("svg"),
  ).toBeVisible();
  await expect(
    enhanced.getByTestId("invalid-diagram").getByRole("status"),
  ).toContainText("Diagram unavailable");
  await expect(
    enhanced
      .getByTestId("invalid-diagram")
      .locator('[data-slot="code-block-content"]'),
  ).toContainText("invalid diagram syntax");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("new AI surfaces retain the shared corner treatment", async ({
  page,
}, testInfo) => {
  const chat = chatRegion(page);
  await chat.locator('input[type="file"]').setInputFiles([
    {
      name: "shape.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Shape fixture"),
    },
  ]);
  await chat
    .getByRole("textbox", { name: "Demo message" })
    .fill("Check the shared shapes");
  await chat.getByRole("button", { name: "Send message" }).click();
  await expect(chat.locator("[data-ai-chat]")).toHaveAttribute(
    "data-status",
    "ready",
    { timeout: 15000 },
  );
  const fallback =
    (await page.locator("html").getAttribute("data-app-corners-fallback")) !==
    null;
  for (const slot of [
    "input-group",
    "bubble-content",
    "attachment",
    "code-block",
  ]) {
    const surface = chat.locator(`[data-slot="${slot}"]`).last();
    await surface.scrollIntoViewIfNeeded();
    if (fallback) {
      await expect
        .poll(() =>
          surface.evaluate(
            (element) =>
              globalThis.getComputedStyle(element).clipPath !== "none" ||
              element.getAttribute("data-hyperellipse-host")?.includes("layer"),
          ),
        )
        .toBeTruthy();
    } else {
      await expect(surface).toHaveCSS("corner-shape", "superellipse(1.5)");
    }
    await testInfo.attach(`ai-${slot}-shape`, {
      body: await surface.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  }
});
