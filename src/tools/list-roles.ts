import { DatabasePool } from "../db/pool.js";
import { RoleInfo } from "../result.js";

export const listRolesSchema = {};

export async function listRoles(pool: DatabasePool): Promise<RoleInfo[]> {
  const rolesSql = `
    SELECT
      r.rolname AS name,
      r.rolsuper AS superuser,
      r.rolcanlogin AS can_login,
      r.rolcreatedb AS can_create_db,
      r.rolcreaterole AS can_create_role,
      r.rolbypassrls AS can_bypass_rls
    FROM pg_catalog.pg_roles r
    ORDER BY r.rolname;
  `;

  const membershipsSql = `
    SELECT
      parent.rolname AS role_name,
      member.rolname AS member_name
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles parent ON m.roleid = parent.oid
    JOIN pg_catalog.pg_roles member ON m.member = member.oid;
  `;

  const [rolesResult, membersResult] = await Promise.all([
    pool.query<{
      name: string;
      superuser: boolean;
      can_login: boolean;
      can_create_db: boolean;
      can_create_role: boolean;
      can_bypass_rls: boolean;
    }>(rolesSql),
    pool.query<{
      role_name: string;
      member_name: string;
    }>(membershipsSql).catch(() => ({ rows: [] })), // fallback gracefully if permission restricted
  ]);

  const memberOfMap = new Map<string, string[]>();
  const membersMap = new Map<string, string[]>();

  for (const m of membersResult.rows) {
    // member is part of role_name
    if (!memberOfMap.has(m.member_name)) {
      memberOfMap.set(m.member_name, []);
    }
    memberOfMap.get(m.member_name)!.push(m.role_name);

    // role_name has member
    if (!membersMap.has(m.role_name)) {
      membersMap.set(m.role_name, []);
    }
    membersMap.get(m.role_name)!.push(m.member_name);
  }

  return rolesResult.rows.map((row) => ({
    name: row.name,
    superuser: Boolean(row.superuser),
    canLogin: Boolean(row.can_login),
    canCreateDb: Boolean(row.can_create_db),
    canCreateRole: Boolean(row.can_create_role),
    canBypassRls: Boolean(row.can_bypass_rls),
    memberOf: memberOfMap.get(row.name) || [],
    members: membersMap.get(row.name) || [],
  }));
}
