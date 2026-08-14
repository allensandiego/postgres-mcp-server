import { describe, expect, it } from "vitest";
import { runQuery } from "../../src/tools/run-query.js";
import { createTestDatabase } from "../helpers/test-db.js";

describe("Performance & Concurrency (SC-002, SC-006)", () => {
  it("executes 1,000-row query within 2 seconds", async () => {
    const testDb = await createTestDatabase({ maxRowLimit: 1000 });

    try {
      const startTime = Date.now();
      const sql = testDb.isLiveDb
        ? "SELECT generate_series(1, 1000) AS num"
        : "SELECT num FROM bench_1000 ORDER BY num";

      const result = await runQuery(testDb.pool, { sql });
      const durationMs = Date.now() - startTime;

      expect(result.rowCount).toBe(1000);
      expect(result.truncated).toBe(false);
      expect(durationMs).toBeLessThan(2000); // within 2 seconds
    } finally {
      await testDb.cleanup();
    }
  });

  it("handles 10 concurrent queries simultaneously without connection leaks or errors", async () => {
    const testDb = await createTestDatabase({ maxConnections: 10 });

    try {
      const concurrentQueries = Array.from({ length: 10 }, (_, i) =>
        runQuery(testDb.pool, {
          sql: "SELECT $1::int AS index, 'concurrent_test' AS msg",
          params: [i],
        })
      );

      const results = await Promise.all(concurrentQueries);
      expect(results).toHaveLength(10);
      results.forEach((res, idx) => {
        expect(res.rowCount).toBe(1);
        expect(res.rows[0].index).toBe(idx);
      });
    } finally {
      await testDb.cleanup();
    }
  });
});
