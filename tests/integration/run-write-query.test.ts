import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabasePool } from "../../src/db/pool.js";
import { runQuery } from "../../src/tools/run-query.js";
import { runWriteQuery } from "../../src/tools/run-write-query.js";
import { createTestDatabase } from "../helpers/test-db.js";

describe("US4: run-write-query integration tests", () => {
  let readOnlyPool: DatabasePool;
  let writeEnabledPool: DatabasePool;
  let cleanupReadOnly: () => Promise<void>;
  let cleanupWrite: () => Promise<void>;

  beforeAll(async () => {
    const testDbReadOnly = await createTestDatabase({ allowWrite: false });
    readOnlyPool = testDbReadOnly.pool;
    cleanupReadOnly = testDbReadOnly.cleanup;

    const testDbWrite = await createTestDatabase({ allowWrite: true });
    writeEnabledPool = testDbWrite.pool;
    cleanupWrite = testDbWrite.cleanup;

    // Seed table using raw query for test
    try {
      await writeEnabledPool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          action TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch {
      // ignore
    }
  });

  afterAll(async () => {
    if (cleanupReadOnly) await cleanupReadOnly();
    if (cleanupWrite) await cleanupWrite();
  });

  it("rejects writes when write mode is disabled (allowWrite = false)", async () => {
    await expect(
      runWriteQuery(readOnlyPool, {
        sql: "INSERT INTO audit_logs (action) VALUES ('test_action')",
      })
    ).rejects.toMatchObject({
      code: "write_disabled",
    });
  });

  it("executes write statements when write mode is enabled (allowWrite = true)", async () => {
    const result = await runWriteQuery(writeEnabledPool, {
      sql: "INSERT INTO audit_logs (action) VALUES ($1)",
      params: ["user_login"],
    });

    expect(result.rowCount).toBe(1);

    // Verify row persisted
    const queryRes = await runQuery(writeEnabledPool, {
      sql: "SELECT * FROM audit_logs WHERE action = $1",
      params: ["user_login"],
    });

    expect(queryRes.rowCount).toBeGreaterThanOrEqual(1);
    expect(queryRes.rows[0].action).toBe("user_login");
  });
});
