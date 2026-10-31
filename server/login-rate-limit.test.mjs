import { afterEach, expect, it } from "vitest";
import { createLoginLimiter } from "./login-rate-limit.mjs";
import { createTestStore } from "./test-helpers/store.mjs";

let store;
afterEach(async () => {
  if (store) {
    await store.close();
  }
  store = null;
});

it("shares the login budget across instances and preserves it on cold starts", async () => {
  store = createTestStore();
  const first = await createLoginLimiter(store.pool);
  const second = await createLoginLimiter(store.pool);
  for (let i = 0; i < 10; i++) {
    await first.consume("203.0.113.9");
  }
  for (let i = 0; i < 10; i++) {
    await second.consume("203.0.113.9");
  }
  const restarted = await createLoginLimiter(store.pool);
  await expect(restarted.consume("203.0.113.9")).rejects.toMatchObject({
    remainingPoints: 0,
    consumedPoints: 21,
  });
  await expect(restarted.consume("203.0.113.10")).resolves.toMatchObject({
    remainingPoints: 19,
  });
  await restarted.delete("203.0.113.9");
  await expect(first.consume("203.0.113.9")).resolves.toMatchObject({
    remainingPoints: 19,
  });
});

it("fails closed on database errors instead of switching to per-process counters", async () => {
  store = createTestStore();
  const limiter = await createLoginLimiter(store.pool);
  await store.close();
  store = null;
  await expect(limiter.consume("203.0.113.9")).rejects.toBeInstanceOf(Error);
});
