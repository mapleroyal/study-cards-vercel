import { createHash, timingSafeEqual } from "node:crypto";
import { sealData, unsealData } from "iron-session";

const cookieName = "lumina-session";
const ttl = 60 * 60 * 24 * 30;
export function getSecret() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET must contain at least 32 characters.");
  }
  return secret;
}
function fingerprint() {
  return createHash("sha256")
    .update(process.env.APP_PASSWORD || "")
    .digest("hex");
}
export async function readSession(header = "") {
  const token = String(header || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token || !process.env.APP_PASSWORD) {
    return false;
  }
  try {
    const session = await unsealData(token, { password: getSecret(), ttl });
    return session.owner === true && session.passwordVersion === fingerprint();
  } catch {
    return false;
  }
}
export async function createSessionCookie() {
  const token = await sealData(
    { owner: true, passwordVersion: fingerprint() },
    { password: getSecret(), ttl },
  );
  return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export const clearSessionCookie = () =>
  `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
export function verifyPassword(value) {
  if (!process.env.APP_PASSWORD || typeof value !== "string") {
    return false;
  }
  const hash = (v) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(value), hash(process.env.APP_PASSWORD));
}
export async function sealSecret(value) {
  return sealData({ value }, { password: getSecret(), ttl: 0 });
}
export async function unsealSecret(value) {
  return (await unsealData(value, { password: getSecret(), ttl: 0 })).value;
}
