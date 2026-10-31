import { RateLimiterPostgres } from "rate-limiter-flexible";

// PostgreSQL shares the budget across Vercel instances and cold starts. The
// maintained adapter creates its table and performs atomic counter updates.
export async function createLoginLimiter(pool) {
  const limiter = await new Promise((resolve, reject) => {
    const instance = new RateLimiterPostgres(
      {
        storeClient: pool,
        storeType: "pool",
        tableName: "lumina_login_limits",
        keyPrefix: "owner-login",
        points: 20,
        duration: 15 * 60,
        clearExpiredByTimeout: false,
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(instance);
        }
      },
    );
  });
  // Serverless invocations cannot rely on the adapter's background timer.
  await limiter.clearExpired(Date.now() - 60 * 60 * 1000);
  return limiter;
}
