import { newDb } from "pg-mem";
import { ServerConfig } from "../../src/config.js";
import { DatabasePool, PgDatabasePool } from "../../src/db/pool.js";

export async function createTestDatabase(configOverrides: Partial<ServerConfig> = {}): Promise<{
  pool: DatabasePool;
  cleanup: () => Promise<void>;
  isLiveDb: boolean;
}> {
  // If live DATABASE_URL is set in environment, use real PostgreSQL
  if (process.env.DATABASE_URL) {
    const config: ServerConfig = {
      databaseUrl: process.env.DATABASE_URL,
      allowWrite: configOverrides.allowWrite ?? true,
      maxRowLimit: configOverrides.maxRowLimit ?? 1000,
      queryTimeoutMs: 30000,
      statementTimeoutMs: 30000,
      maxConnections: 10,
      ...configOverrides,
    };
    const pool = new PgDatabasePool(config);
    return {
      pool,
      isLiveDb: true,
      cleanup: async () => {
        await pool.close();
      },
    };
  }

  // Otherwise use in-memory Postgres via pg-mem
  const db = newDb();

  // Create tables in pg-mem
  db.public.none(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      price NUMERIC(10, 2),
      in_stock BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      title TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bench_1000 (
      num INTEGER PRIMARY KEY
    );
  `);

  // Populate bench_1000 rows
  const values = Array.from({ length: 1000 }, (_, i) => `(${i + 1})`).join(",");
  db.public.none(`INSERT INTO bench_1000 (num) VALUES ${values};`);

  const pgAdapter = db.adapters.createPg();
  const rawPool = new pgAdapter.Pool();

  const config: ServerConfig = {
    allowWrite: configOverrides.allowWrite ?? false,
    maxRowLimit: configOverrides.maxRowLimit ?? 1000,
    queryTimeoutMs: 30000,
    statementTimeoutMs: 30000,
    maxConnections: 10,
    ...configOverrides,
  };

  class InMemTestPool implements DatabasePool {
    getConfig(): ServerConfig {
      return config;
    }

    async query<_R = any>(text: string, params?: unknown[], _options?: { timeoutMs?: number }): Promise<any> {
      const result = await rawPool.query(text, params);

      // Enhance pg-mem results with PK/UQ annotations for information_schema discovery queries
      if (text.includes("information_schema.table_constraints") && result && result.rows) {
        const enhancedRows = result.rows.map((r: any) => {
          let isPk = r.is_primary_key;
          let isUq = r.is_unique;

          const tableName = r.name || (params && typeof params[1] === "string" ? params[1] : "");
          const colName = r.column_name;

          if (tableName === "products" && colName === "id") {
            isPk = true;
            isUq = true;
          } else if (tableName === "products" && colName === "sku") {
            isUq = true;
          } else if ((tableName === "items" || tableName === "categories") && colName === "id") {
            isPk = true;
            isUq = true;
          } else if (tableName === "categories" && colName === "title") {
            isUq = true;
          }

          return {
            ...r,
            is_primary_key: isPk,
            is_unique: isUq,
          };
        });

        return {
          ...result,
          rows: enhancedRows,
        };
      }

      return result;
    }

    async connect(): Promise<any> {
      return rawPool.connect();
    }

    async testConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
      return { ok: true, version: "PostgreSQL 16.0 (pg-mem)" };
    }

    async close(): Promise<void> {
      await rawPool.end();
    }
  }

  const pool = new InMemTestPool();

  return {
    pool,
    isLiveDb: false,
    cleanup: async () => {
      await pool.close();
    },
  };
}
