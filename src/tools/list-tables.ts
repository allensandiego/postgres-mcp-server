import { z } from "zod";
import { DatabasePool } from "../db/pool.js";
import { TableInfo } from "../result.js";

export const listTablesSchema = {
  schema: z
    .string()
    .optional()
    .describe("Optional schema name to filter tables (defaults to all non-system schemas)"),
};

export async function listTables(
  pool: DatabasePool,
  args: { schema?: string } = {}
): Promise<TableInfo[]> {
  const schemaFilter = args.schema;

  const sql = `
    WITH pk_uq AS (
      SELECT
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        MAX(CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 1 ELSE 0 END) AS is_pk_int,
        MAX(CASE WHEN tc.constraint_type = 'UNIQUE' THEN 1 ELSE 0 END) AS is_uq_int
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY kcu.table_schema, kcu.table_name, kcu.column_name
    )
    SELECT
      t.table_schema AS schema,
      t.table_name AS name,
      CASE
        WHEN t.table_type = 'BASE TABLE' THEN 'table'
        WHEN t.table_type = 'VIEW' THEN 'view'
        ELSE LOWER(t.table_type)
      END AS type,
      c.column_name,
      c.data_type,
      c.is_nullable = 'YES' AS nullable,
      COALESCE(pku.is_pk_int, 0) = 1 AS is_primary_key,
      COALESCE(pku.is_uq_int, 0) = 1 AS is_unique,
      c.ordinal_position
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    LEFT JOIN pk_uq pku
      ON c.table_schema = pku.table_schema
      AND c.table_name = pku.table_name
      AND c.column_name = pku.column_name
    WHERE
      ($1::text IS NOT NULL AND t.table_schema = $1)
      OR ($1::text IS NULL AND t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast'))
    ORDER BY t.table_schema, t.table_name, c.ordinal_position;
  `;

  const result = await pool.query<{
    schema: string;
    name: string;
    type: string;
    column_name: string;
    data_type: string;
    nullable: boolean | string;
    is_primary_key: boolean | number | string;
    is_unique: boolean | number | string;
    ordinal_position: number;
  }>(sql, [schemaFilter ?? null]);

  // Group columns by table
  const tableMap = new Map<string, TableInfo>();

  for (const row of result.rows) {
    const key = `${row.schema}.${row.name}`;
    if (!tableMap.has(key)) {
      tableMap.set(key, {
        schema: row.schema,
        name: row.name,
        type: row.type,
        columns: [],
      });
    }

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

    const table = tableMap.get(key)!;
    table.columns.push({
      name: row.column_name,
      dataType: row.data_type,
      nullable: isNullable,
      isPrimaryKey: isPk,
      isUnique: isUq,
    });
  }

  return Array.from(tableMap.values());
}
