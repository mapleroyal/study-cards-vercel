import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionCookie,
  readSession,
  verifyPassword,
  sealSecret,
  unsealSecret,
} from "./auth.mjs";
const old = {
  secret: process.env.APP_SECRET,
  password: process.env.APP_PASSWORD,
};
afterEach(() => {
  if (old.secret === undefined) {
    delete process.env.APP_SECRET;
  } else {
    process.env.APP_SECRET = old.secret;
  }
  if (old.password === undefined) {
    delete process.env.APP_PASSWORD;
  } else {
    process.env.APP_PASSWORD = old.password;
  }
});
function configure() {
  process.env.APP_SECRET =
    "test-session-secret-more-than-thirty-two-characters";
  process.env.APP_PASSWORD = "test-owner-password";
}
describe("owner sessions", () => {
  it("requires the configured password and rejects missing configuration", () => {
    configure();
    expect(verifyPassword("wrong")).toBe(false);
    expect(verifyPassword("test-owner-password")).toBe(true);
    delete process.env.APP_PASSWORD;
    expect(verifyPassword("")).toBe(false);
  });
  it("authenticates a sealed cookie and rejects tampering or password rotation", async () => {
    configure();
    const cookie = await createSessionCookie();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(await readSession(cookie)).toBe(true);
    expect(
      await readSession(cookie.replace("lumina-session=", "lumina-session=x")),
    ).toBe(false);
    process.env.APP_PASSWORD = "rotated-password";
    expect(await readSession(cookie)).toBe(false);
  });
  it("sets Secure on production session cookies", async () => {
    configure();
    // Vite replaces NODE_ENV at transform time; use Node to exercise the
    // production environment without accidentally testing a transformed literal.
    const moduleUrl = new URL("./auth.mjs", import.meta.url).href;
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import { createSessionCookie, clearSessionCookie } from ${JSON.stringify(moduleUrl)};
      process.stdout.write(JSON.stringify([
        (await createSessionCookie()).includes("; Secure"),
        clearSessionCookie().includes("; Secure"),
      ]));
    `,
      ],
      { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8" },
    );
    expect(JSON.parse(result)).toEqual([true, true]);
  });
  it("seals provider credentials without exposing plaintext", async () => {
    configure();
    const sealed = await sealSecret("sk-or-test-secret");
    expect(sealed).not.toContain("sk-or-test-secret");
    expect(await unsealSecret(sealed)).toBe("sk-or-test-secret");
    process.env.APP_SECRET =
      "different-session-secret-more-than-thirty-two-characters";
    expect(await unsealSecret(sealed)).toBeUndefined();
  });
});
