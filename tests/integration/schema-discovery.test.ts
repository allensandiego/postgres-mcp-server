import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabasePool } from "../../src/db/pool.js";
import { describeTable } from "../../src/tools/describe-table.js";
import { listTables } from "../../src/tools/list-tables.js";
import { createTestDatabase } from "../helpers/test-db.js";

describe("US1: schema discovery integration tests", () => {
  let pool: DatabasePool;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    pool = testDb.pool;
    cleanup = testDb.cleanup;

    // Seed test schema if needed
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          sku TEXT UNIQUE NOT NULL,
          price NUMERIC(10, 2),
          in_stock BOOLEAN DEFAULT true
        );
      `);
    } catch {
      // Table may already exist
    }
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it("lists discovered tables and their columns", async () => {
    const tables = await listTables(pool, { schema: "public" });
    expect(tables.length).toBeGreaterThan(0);

    const productTable = tables.find((t) => t.name === "products");
    expect(productTable).toBeDefined();
    expect(productTable?.schema).toBe("public");
    expect(productTable?.type).toBe("table");

    const idCol = productTable?.columns.find((c) => c.name === "id");
    expect(idCol).toBeDefined();
    expect(idCol?.isPrimaryKey).toBe(true);

    const skuCol = productTable?.columns.find((c) => c.name === "sku");
    expect(skuCol).toBeDefined();
    expect(skuCol?.isUnique).toBe(true);
  });

  it("describes a specific table correctly", async () => {
    const desc = await describeTable(pool, { schema: "public", table: "products" });
    expect(desc.schema).toBe("public");
    expect(desc.table).toBe("products");
    expect(desc.primaryKey).toContain("id");
    expect(desc.columns.length).toBeGreaterThanOrEqual(3);
  });

  it("throws table_not_found error for unknown table", async () => {
    await expect(
      describeTable(pool, { schema: "public", table: "non_existent_xyz" })
    ).rejects.toMatchObject({
      code: "table_not_found",
    });
  });
});
