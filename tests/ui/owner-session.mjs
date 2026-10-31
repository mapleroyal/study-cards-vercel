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
}
export function resetOwnerSession() {
  ownerCookies = null;
}
