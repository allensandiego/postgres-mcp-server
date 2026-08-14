import { z } from "zod";
import { DatabasePool } from "../db/pool.js";
import { DescribeTableResult, QueryError } from "../result.js";

export const describeTableSchema = {
  schema: z.string().describe("Schema name (e.g. 'public')"),
  table: z.string().describe("Table name"),
};

export async function describeTable(
  pool: DatabasePool,
  args: { schema: string; table: string }
): Promise<DescribeTableResult> {
  const { schema, table } = args;

  // Check if table exists
  const tableCheckSql = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = $1 AND table_name = $2
  `;
  const tableCheck = await pool.query(tableCheckSql, [schema, table]);
  if (tableCheck.rowCount === 0) {
    const error: QueryError = {
      code: "table_not_found",
      message: `Table '${schema}.${table}' not found in the database.`,
    };
    throw error;
  }

  const columnsSql = `
    WITH pk_uq AS (
      SELECT
        kcu.column_name,
        MAX(CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 1 ELSE 0 END) AS is_pk_int,
        MAX(CASE WHEN tc.constraint_type = 'UNIQUE' THEN 1 ELSE 0 END) AS is_uq_int
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = $1
        AND tc.table_name = $2
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY kcu.column_name
    )
    SELECT
      c.column_name,
      c.data_type,
      c.is_nullable = 'YES' AS nullable,
      COALESCE(pku.is_pk_int, 0) = 1 AS is_primary_key,
      COALESCE(pku.is_uq_int, 0) = 1 AS is_unique,
      c.ordinal_position
    FROM information_schema.columns c
    LEFT JOIN pk_uq pku
      ON c.column_name = pku.column_name
    WHERE c.table_schema = $1
      AND c.table_name = $2
    ORDER BY c.ordinal_position;
  `;

  const result = await pool.query<{
    column_name: string;
    data_type: string;
    nullable: boolean | string;
    is_primary_key: boolean | number | string;
    is_unique: boolean | number | string;
    ordinal_position: number;
  }>(columnsSql, [schema, table]);

  const columns = result.rows.map((row) => {
    const isPk =
      row.is_primary_key === true ||
      row.is_primary_key === 1 ||
      row.is_primary_key === "1" ||
      row.is_primary_key === "t" ||
      row.is_primary_key === "true";
    const isUq =
      row.is_unique === true ||
      row.is_unique === 1 ||
      row.is_unique === "1" ||
      row.is_unique === "t" ||
      row.is_unique === "true";
    const isNullable =
      row.nullable === true ||
      row.nullable === "YES" ||
      row.nullable === "t" ||
      row.nullable === "true";

    return {
      name: row.column_name,
      dataType: row.data_type,
      nullable: isNullable,
      isPrimaryKey: isPk,
      isUnique: isUq,
    };
  });

  // Find primary key column names (or joined if composite)
  const pkColumns = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
  const primaryKey = pkColumns.length > 0 ? pkColumns.join(", ") : undefined;

  return {
    schema,
    table,
    columns,
    primaryKey,
  };
}
