import { expect } from "@playwright/test";
let ownerCookies;
export async function signInToPreview(page) {
  if (process.env.PLAYWRIGHT_STORAGE_STATE) {
    return;
  }
  if (ownerCookies) {
    await page.context().addCookies(ownerCookies);
    return;
  }
  const response = await page.request.post("/api/session", {
    data: {
      password: process.env.PLAYWRIGHT_APP_PASSWORD || "playwright-test-owner",
    },
  });
  expect(response.ok()).toBe(true);
  ownerCookies = await page.context().cookies();
  const origin = new URL(response.url());
  if (
    process.env.LUMINA_TEST_FIXTURES === "1" &&
    origin.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
  ) {
    // The production server correctly emits Secure cookies. WebKit does not
    // send them on our disposable HTTP loopback host, unlike Chromium.
    // Keep the real signed session; relax transport only inside this fixture.
    ownerCookies = ownerCookies.map((cookie) => ({ ...cookie, secure: false }));
    await page.context().addCookies(ownerCookies);
  }
}
export function resetOwnerSession() {
  ownerCookies = null;
}
