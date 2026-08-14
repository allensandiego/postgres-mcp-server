import { z } from "zod";
import { DatabasePool } from "../db/pool.js";
import { PermissionInfo } from "../result.js";

export const listPermissionsSchema = {
  objectType: z
    .enum(["schema", "table", "column"])
    .optional()
    .describe("Optional object type filter: 'schema', 'table', or 'column'"),
  schema: z
    .string()
    .optional()
    .describe("Optional schema filter (e.g. 'public')"),
  table: z
    .string()
    .optional()
    .describe("Optional table filter"),
};

export async function listPermissions(
  pool: DatabasePool,
  args: {
    objectType?: "schema" | "table" | "column";
    schema?: string;
    table?: string;
  } = {}
): Promise<PermissionInfo[]> {
  const { objectType, schema, table } = args;
  const results: PermissionInfo[] = [];

  // 1. Table privileges
  if (!objectType || objectType === "table") {
    const tablePrivSql = `
      SELECT
        grantor,
        grantee,
        'table' AS object_type,
        (table_schema || '.' || table_name) AS object_name,
        privilege_type AS privilege,
        is_grantable = 'YES' AS grantable
      FROM information_schema.table_privileges
      WHERE
        ($1::text IS NULL OR table_schema = $1)
        AND ($2::text IS NULL OR table_name = $2)
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, grantee, privilege_type;
    `;
    try {
      const res = await pool.query<{
        grantor: string;
        grantee: string;
        object_type: string;
        object_name: string;
        privilege: string;
        grantable: boolean;
      }>(tablePrivSql, [schema ?? null, table ?? null]);

      for (const row of res.rows) {
        results.push({
          grantor: row.grantor,
          grantee: row.grantee,
          objectType: row.object_type,
          objectName: row.object_name,
          privilege: row.privilege,
          grantable: Boolean(row.grantable),
        });
      }
    } catch {
      // ignore if view inaccessible
    }
  }

  // 2. Column privileges
  if (!objectType || objectType === "column") {
    const colPrivSql = `
      SELECT
        grantor,
        grantee,
        'column' AS object_type,
        (table_schema || '.' || table_name || '.' || column_name) AS object_name,
        privilege_type AS privilege,
        is_grantable = 'YES' AS grantable
      FROM information_schema.column_privileges
      WHERE
        ($1::text IS NULL OR table_schema = $1)
        AND ($2::text IS NULL OR table_name = $2)
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, column_name, grantee, privilege_type;
    `;
    try {
      const res = await pool.query<{
        grantor: string;
        grantee: string;
        object_type: string;
        object_name: string;
        privilege: string;
        grantable: boolean;
      }>(colPrivSql, [schema ?? null, table ?? null]);

      for (const row of res.rows) {
        results.push({
          grantor: row.grantor,
          grantee: row.grantee,
          objectType: row.object_type,
          objectName: row.object_name,
          privilege: row.privilege,
          grantable: Boolean(row.grantable),
        });
      }
    } catch {
      // ignore if view inaccessible
    }
  }

  // 3. Schema privileges (from information_schema.usage_privileges or pg_namespace ACLs)
  if (!objectType || objectType === "schema") {
    const schemaPrivSql = `
      SELECT
        pg_get_userbyid(nspowner) AS grantor,
        COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
        'schema' AS object_type,
        nspname AS object_name,
        privilege_type AS privilege,
        is_grantable AS grantable
      FROM pg_catalog.pg_namespace n
      CROSS JOIN LATERAL (
        SELECT
          (aclexplode(COALESCE(n.nspacl, acldefault('n'::"char", n.nspowner)))).*
      ) acl
      LEFT JOIN pg_catalog.pg_roles grantee ON acl.grantee = grantee.oid
      WHERE
        ($1::text IS NULL OR nspname = $1)
        AND nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY nspname, grantee;
    `;
    try {
      const res = await pool.query<{
        grantor: string;
        grantee: string;
        object_type: string;
        object_name: string;
        privilege: string;
        grantable: boolean;
      }>(schemaPrivSql, [schema ?? null]);

      for (const row of res.rows) {
        results.push({
          grantor: row.grantor || "postgres",
          grantee: row.grantee,
          objectType: row.object_type,
          objectName: row.object_name,
          privilege: row.privilege,
          grantable: Boolean(row.grantable),
        });
      }
    } catch {
      // fallback if aclexplode unavailable or permission denied
    }
  }

  return results;
}
