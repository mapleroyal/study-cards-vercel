import { PGlite } from "@electric-sql/pglite";
import { createStudyStore } from "../store/index.mjs";

// PGlite executes actual PostgreSQL in-process. Its one connection is leased
// for a complete transaction, like a pg Pool with max: 1.
export function createTestStore() {
  const database = new PGlite();
  let tail = Promise.resolve();
  const query = async (sql, parameters = []) => {
    if (typeof sql === "object") {
      parameters = sql.values || [];
      sql = sql.text;
    }
    if (sql.includes("CREATE TABLE")) {
      const results = await database.exec(sql);
      return results.at(-1);
    }
    const result = await database.query(sql, parameters);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  const pool = {
    query,
    async connect() {
      const previous = tail;
      let release;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      return { query, release };
    },
    end: () => database.close(),
  };
  return createStudyStore({ pool });
}
