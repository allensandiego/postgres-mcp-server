import { DatabasePool } from "../db/pool.js";
import { DatabaseInfo } from "../result.js";

export const listDatabasesSchema = {};

export async function listDatabases(pool: DatabasePool): Promise<DatabaseInfo[]> {
  const sql = `
    SELECT
      d.datname AS name,
      pg_catalog.pg_get_userbyid(d.datdba) AS owner,
      pg_catalog.pg_encoding_to_char(d.encoding) AS encoding,
      d.datistemplate AS is_template,
      pg_catalog.has_database_privilege(current_user, d.datname, 'CONNECT') AS connectable
    FROM pg_catalog.pg_database d
    WHERE d.datallowconn = true
    ORDER BY d.datname;
  `;

  const result = await pool.query<{
    name: string;
    owner: string;
    encoding: string;
    is_template: boolean;
    connectable: boolean;
  }>(sql);

  return result.rows.map((row) => ({
    name: row.name,
    owner: row.owner,
    encoding: row.encoding,
    isTemplate: Boolean(row.is_template),
    connectable: Boolean(row.connectable),
  }));
}
