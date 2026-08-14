import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabasePool } from "../../src/db/pool.js";
import { runQuery } from "../../src/tools/run-query.js";
import { createTestDatabase } from "../helpers/test-db.js";

describe("US3: run-query integration tests", () => {
  let pool: DatabasePool;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const testDb = await createTestDatabase({ maxRowLimit: 10 });
    pool = testDb.pool;
    cleanup = testDb.cleanup;

    // Seed test rows
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS test_orders (
          id SERIAL PRIMARY KEY,
          customer_name TEXT NOT NULL,
          amount NUMERIC(10,2)
        );
      `);
      for (let i = 1; i <= 20; i++) {
        await pool.query(`INSERT INTO test_orders (customer_name, amount) VALUES ($1, $2);`, [
          `Customer ${i}`,
          i * 10.5,
        ]);
      }
    } catch {
      // Table might exist
    }
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it("executes read query with parameters and returns structured result", async () => {
    const result = await runQuery(pool, {
      sql: "SELECT id, customer_name, amount FROM test_orders WHERE id = $1",
      params: [1],
    });

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].customer_name).toBe("Customer 1");
    expect(result.truncated).toBe(false);
    expect(result.columns.length).toBe(3);
  });

  it("supports limit and offset pagination", async () => {
    const page1 = await runQuery(pool, {
      sql: "SELECT id, customer_name FROM test_orders ORDER BY id",
      limit: 5,
      offset: 0,
    });

    expect(page1.rowCount).toBe(5);
    expect(page1.rows[0].id).toBe(1);
    expect(page1.rows[4].id).toBe(5);

    const page2 = await runQuery(pool, {
      sql: "SELECT id, customer_name FROM test_orders ORDER BY id",
      limit: 5,
      offset: 5,
    });

    expect(page2.rowCount).toBe(5);
    expect(page2.rows[0].id).toBe(6);
    expect(page2.rows[4].id).toBe(10);
  });

  it("indicates truncation when rows exceed maxRowLimit", async () => {
    const result = await runQuery(pool, {
      sql: "SELECT * FROM test_orders ORDER BY id",
    });

    // maxRowLimit is configured as 10
    expect(result.rowCount).toBe(10);
    expect(result.truncated).toBe(true);
  });
});
