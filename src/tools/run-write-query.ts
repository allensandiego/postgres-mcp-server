import { z } from "zod";
import { DatabasePool } from "../db/pool.js";
import { QueryError, WriteQueryResult } from "../result.js";

export const runWriteQuerySchema = {
  sql: z.string().describe("SQL write/DDL statement to execute (e.g. INSERT, UPDATE, DELETE, CREATE TABLE)"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Optional parameterized query values ($1, $2, etc.)"),
  role: z
    .string()
    .optional()
    .describe("Optional PostgreSQL role to assume (SET ROLE) for this write query only"),
};

export async function runWriteQuery(
  pool: DatabasePool,
  args: { sql: string; params?: unknown[]; role?: string }
): Promise<WriteQueryResult> {
  const config = pool.getConfig();

  if (!config.allowWrite) {
    const error: QueryError = {
      code: "write_disabled",
      message: "Write operations are disabled. Set ALLOW_WRITE=1 to enable write statements.",
    };
    throw error;
  }

  const { sql, params = [], role } = args;
  const result = await pool.query(sql, params, { role });

  return {
    rowCount: typeof result.rowCount === "number" ? result.rowCount : 0,
  };
}
