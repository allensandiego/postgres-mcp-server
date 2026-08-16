import { describe, expect, it } from "vitest";
import { PgDatabasePool } from "../../src/db/pool.js";

describe("set_role pool integration tests", () => {
  it("manages activeRole state on PgDatabasePool", () => {
    const pool = new PgDatabasePool({
      allowWrite: false,
      maxRowLimit: 1000,
      queryTimeoutMs: 30000,
      statementTimeoutMs: 30000,
      maxConnections: 10,
    });

    expect(pool.getActiveRole()).toBeNull();

    pool.setActiveRole("analyst");
    expect(pool.getActiveRole()).toBe("analyst");

    pool.setActiveRole("NONE");
    expect(pool.getActiveRole()).toBeNull();

    pool.setActiveRole("reader");
    expect(pool.getActiveRole()).toBe("reader");

    pool.setActiveRole("RESET");
    expect(pool.getActiveRole()).toBeNull();
  });

  it("applies role and resets role on checkout and release", async () => {
    const executedQueries: string[] = [];

    // Mock pg.Pool
    const fakeClient = {
      query: async (text: string) => {
        executedQueries.push(text);
        if (text.includes("SELECT 1")) {
          return { rows: [{ "?column?": 1 }], fields: [], rowCount: 1 };
        }
        return { rows: [], fields: [], rowCount: 0 };
      },
      release: (err?: boolean) => {
        executedQueries.push(`release(${err ?? false})`);
      },
    };

    const fakePool: any = {
      connect: async () => fakeClient,
      on: () => {},
      end: async () => {},
    };

    const pool = new PgDatabasePool(
      {
        allowWrite: false,
        maxRowLimit: 1000,
        queryTimeoutMs: 30000,
        statementTimeoutMs: 30000,
        maxConnections: 10,
      },
      fakePool
    );

    pool.setActiveRole("readonly_user");

    const result = await pool.query("SELECT 1");
    expect(result.rows).toEqual([{ "?column?": 1 }]);

    expect(executedQueries).toContain("SET ROLE readonly_user");
    expect(executedQueries).toContain("SELECT 1");
    expect(executedQueries).toContain("RESET ROLE");
    expect(executedQueries).toContain("release(false)");
  });

  it("overrides session role with query-level role and safely quotes identifiers", async () => {
    const executedQueries: string[] = [];

    const fakeClient = {
      query: async (text: string) => {
        executedQueries.push(text);
        return { rows: [{ val: 42 }], fields: [], rowCount: 1 };
      },
      release: (err?: boolean) => {
        executedQueries.push(`release(${err ?? false})`);
      },
    };

    const fakePool: any = {
      connect: async () => fakeClient,
      on: () => {},
      end: async () => {},
    };

    const pool = new PgDatabasePool(
      {
        allowWrite: false,
        maxRowLimit: 1000,
        queryTimeoutMs: 30000,
        statementTimeoutMs: 30000,
        maxConnections: 10,
      },
      fakePool
    );

    pool.setActiveRole("default_role");

    await pool.query("SELECT 42", [], { role: "Special Role" });

    expect(executedQueries).toContain('SET ROLE "Special Role"');
    expect(executedQueries).not.toContain("SET ROLE default_role");
    expect(executedQueries).toContain("RESET ROLE");
  });
});
