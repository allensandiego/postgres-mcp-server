import pg from "pg";
import format from "pg-format";
import { ServerConfig } from "../config.js";
import { classifyError } from "../result.js";

const { Pool } = pg;

export interface DatabasePool {
  query<R extends pg.QueryResultRow = any>(
    text: string,
    params?: unknown[],
    options?: { timeoutMs?: number; role?: string }
  ): Promise<pg.QueryResult<R>>;
  connect(): Promise<pg.PoolClient>;
  testConnection(): Promise<{ ok: boolean; version?: string; error?: string }>;
  close(): Promise<void>;
  getConfig(): ServerConfig;
  getActiveRole(): string | null;
  setActiveRole(role: string | null): void;
}

export class PgDatabasePool implements DatabasePool {
  private pool: pg.Pool;
  private config: ServerConfig;
  private activeRole: string | null = null;

  constructor(config: ServerConfig, customPool?: pg.Pool) {
    this.config = config;

    if (customPool) {
      this.pool = customPool;
    } else {
      const poolConfig: pg.PoolConfig = {
        max: config.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: config.statementTimeoutMs,
        query_timeout: config.queryTimeoutMs,
      };

      if (config.databaseUrl) {
        poolConfig.connectionString = config.databaseUrl;
      } else {
        poolConfig.host = config.host || "localhost";
        poolConfig.port = config.port || 5432;
        poolConfig.database = config.database || "postgres";
        poolConfig.user = config.user || "postgres";
        poolConfig.password = config.password;
      }

      if (config.ssl) {
        poolConfig.ssl = config.ssl;
      }

      this.pool = new Pool(poolConfig);

      // Handle unexpected pool errors silently on stderr
      this.pool.on("error", (err) => {
        console.error("Unexpected error on idle client in pool:", err.message);
      });
    }
  }

  getConfig(): ServerConfig {
    return this.config;
  }

  getActiveRole(): string | null {
    return this.activeRole;
  }

  setActiveRole(role: string | null): void {
    if (role && (role.toUpperCase() === "NONE" || role.toUpperCase() === "RESET")) {
      this.activeRole = null;
    } else {
      this.activeRole = role ? role.trim() : null;
    }
  }

  async query<R extends pg.QueryResultRow = any>(
    text: string,
    params?: unknown[],
    options?: { timeoutMs?: number; role?: string }
  ): Promise<pg.QueryResult<R>> {
    const client = await this.connect();
    let hasError = false;
    let roleApplied = false;

    // Determine target role: query override first, then session active role
    const effectiveRole = options?.role !== undefined ? options.role : this.activeRole;

    try {
      if (options?.timeoutMs) {
        await client.query(`SET statement_timeout = ${Math.floor(options.timeoutMs)}`);
      }

      if (effectiveRole) {
        if (effectiveRole.toUpperCase() === "NONE" || effectiveRole.toUpperCase() === "RESET") {
          await client.query("RESET ROLE");
        } else {
          await client.query(format("SET ROLE %I", effectiveRole));
          roleApplied = true;
        }
      }

      const result = await client.query<R>(text, params);
      return result;
    } catch (err) {
      hasError = true;
      throw classifyError(err);
    } finally {
      if (roleApplied && !hasError) {
        try {
          await client.query("RESET ROLE");
        } catch {
          hasError = true; // force destruction of client if reset role failed
        }
      }
      client.release(hasError ? true : undefined);
    }
  }

  async connect(): Promise<pg.PoolClient> {
    try {
      return await this.pool.connect();
    } catch (err) {
      throw classifyError(err);
    }
  }

  async testConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const res = await this.query<{ version: string }>("SELECT version()");
      return { ok: true, version: res.rows[0]?.version };
    } catch (err: any) {
      return { ok: false, error: err.message || "Connection failed" };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabasePool(config: ServerConfig, customPool?: pg.Pool): DatabasePool {
  return new PgDatabasePool(config, customPool);
}
