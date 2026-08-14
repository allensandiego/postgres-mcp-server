import { z } from "zod";
import { DatabasePool } from "../db/pool.js";
import { ColumnInfo, QueryError, QueryResult } from "../result.js";

export const runQuerySchema = {
  sql: z.string().describe("Read-only SQL query to execute (e.g. SELECT)"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Optional parameterized query values ($1, $2, etc.)"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of rows to return (capped by server maxRowLimit)"),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of rows to skip before returning results"),
};

// Check if SQL statement contains potentially mutating or multi-statement commands
function isMutatingQuery(sql: string): boolean {
  const normalized = sql
    .replace(/--.*$/gm, "") // strip single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
    .trim();

  // Disallow semicolon chaining multiple statements to prevent injection
  const statements = normalized.split(";").map((s) => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    return true;
  }

  const firstWord = statements[0]?.split(/\s+/)[0]?.toUpperCase() || "";
  const mutatingKeywords = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "RENAME",
  ];

  return mutatingKeywords.includes(firstWord);
}

export async function runQuery(
  pool: DatabasePool,
  args: {
    sql: string;
    params?: unknown[];
    limit?: number;
    offset?: number;
  }
): Promise<QueryResult> {
  const { sql, params = [], limit, offset } = args;
  const config = pool.getConfig();

  if (isMutatingQuery(sql)) {
    const error: QueryError = {
      code: "invalid_sql",
      message: "run_query only accepts read-only statements (e.g. SELECT). Use run_write_query for data modification.",
    };
    throw error;
  }

  // Determine effective limit (requested limit or server max, cannot exceed server max)
  const maxLimit = config.maxRowLimit;
  const effectiveLimit = limit ? Math.min(limit, maxLimit) : maxLimit;
  const fetchLimit = effectiveLimit + 1; // Fetch 1 extra to detect truncation

  // Try subquery pagination wrapping first
  let queryText: string;
  let queryParams: unknown[];

  const trimmedSql = sql.trim().replace(/;+$/, "");
  const baseParams = [...params];

  if (offset !== undefined && offset > 0) {
    queryText = `SELECT * FROM (${trimmedSql}) AS _mcp_subquery LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`;
    queryParams = [...baseParams, fetchLimit, offset];
  } else {
    queryText = `SELECT * FROM (${trimmedSql}) AS _mcp_subquery LIMIT $${baseParams.length + 1}`;
    queryParams = [...baseParams, fetchLimit];
  }

  let dbResult;
  try {
    dbResult = await pool.query(queryText, queryParams);
  } catch (err: any) {
    // If subquery wrapping failed (e.g. for SHOW, EXPLAIN, etc.), fallback to executing raw query
    if (err.code === "invalid_sql" || err.code === "42601") {
      dbResult = await pool.query(trimmedSql, baseParams);
    } else {
      throw err;
    }
  }

  let rows = dbResult.rows || [];
  let truncated = false;

  if (rows.length > effectiveLimit) {
    truncated = true;
    rows = rows.slice(0, effectiveLimit);
  }

  const columns: ColumnInfo[] =
    dbResult.fields && dbResult.fields.length > 0
      ? dbResult.fields.map((f) => ({
          name: f.name,
          dataType: String(f.dataTypeID),
        }))
      : rows.length > 0
      ? Object.keys(rows[0]).map((key) => ({
          name: key,
          dataType: typeof (rows[0] as any)[key],
        }))
      : [];

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
  };
}
