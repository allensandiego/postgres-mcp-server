import { ServerConfig } from "../../src/config.js";
import { DatabasePool } from "../../src/db/pool.js";
import { classifyError } from "../../src/result.js";

export interface MockQueryHandler {
  (sql: string, params?: unknown[]): Promise<any> | any;
}

export class MockDatabasePool implements DatabasePool {
  public queries: { sql: string; params?: unknown[] }[] = [];
  public handler?: MockQueryHandler;
  public config: ServerConfig;
  public closed = false;

  constructor(config?: Partial<ServerConfig>, handler?: MockQueryHandler) {
    this.config = {
      allowWrite: false,
      maxRowLimit: 1000,
      queryTimeoutMs: 30000,
      statementTimeoutMs: 30000,
      maxConnections: 10,
      ...config,
    };
    this.handler = handler;
  }

  getConfig(): ServerConfig {
    return this.config;
  }

  async query<R = any>(
    text: string,
    params?: unknown[],
    _options?: { timeoutMs?: number }
  ): Promise<{ rows: R[]; fields: { name: string; dataTypeID: number }[]; rowCount: number; command: string; oid: number }> {
    this.queries.push({ sql: text, params });
    if (this.handler) {
      try {
        const res = await this.handler(text, params);
        if (res && Array.isArray(res.rows)) {
          return {
            rows: res.rows,
            fields: res.fields || (res.rows[0] ? Object.keys(res.rows[0]).map((k) => ({ name: k, dataTypeID: 25 })) : []),
            rowCount: res.rowCount ?? res.rows.length,
            command: res.command ?? "SELECT",
            oid: 0,
          };
        }
        if (Array.isArray(res)) {
          return {
            rows: res,
            fields: res[0] ? Object.keys(res[0]).map((k) => ({ name: k, dataTypeID: 25 })) : [],
            rowCount: res.length,
            command: "SELECT",
            oid: 0,
          };
        }
        return {
          rows: [],
          fields: [],
          rowCount: res?.rowCount ?? 0,
          command: res?.command ?? "OK",
          oid: 0,
        };
      } catch (err) {
        throw classifyError(err);
      }
    }
    return {
      rows: [],
      fields: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
    };
  }

  async connect(): Promise<any> {
    return {
      query: (sql: string, params?: unknown[]) => this.query(sql, params),
      release: () => {},
    };
  }

  async testConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
    return { ok: true, version: "PostgreSQL 16.0 (Mock)" };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
