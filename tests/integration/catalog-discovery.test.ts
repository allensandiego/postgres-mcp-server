import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabasePool } from "../../src/db/pool.js";
import { listDatabases } from "../../src/tools/list-databases.js";
import { listPermissions } from "../../src/tools/list-permissions.js";
import { listRoles } from "../../src/tools/list-roles.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";
import { createTestDatabase } from "../helpers/test-db.js";

describe("US2: catalog discovery integration tests", () => {
  let pool: DatabasePool;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    pool = testDb.pool;
    cleanup = testDb.cleanup;
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it("lists databases visible to current connection", async () => {
    // If running with mock or real db, listDatabases should return a non-empty array
    const fallbackPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("pg_database")) {
        return [
          {
            name: "test_db",
            owner: "postgres",
            encoding: "UTF8",
            is_template: false,
            connectable: true,
          },
        ];
      }
      return [];
    });

    const activePool = (pool as any).isLiveDb ? pool : fallbackPool;
    const dbs = await listDatabases(activePool);
    expect(dbs.length).toBeGreaterThan(0);
    expect(dbs[0]).toHaveProperty("name");
    expect(dbs[0]).toHaveProperty("owner");
    expect(dbs[0]).toHaveProperty("connectable");
  });

  it("lists roles and user attributes without credentials", async () => {
    const fallbackPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("pg_roles")) {
        return [
          {
            name: "admin",
            superuser: true,
            can_login: true,
            can_create_db: true,
            can_create_role: true,
            can_bypass_rls: true,
          },
        ];
      }
      return [];
    });

    const activePool = (pool as any).isLiveDb ? pool : fallbackPool;
    const roles = await listRoles(activePool);
    expect(roles.length).toBeGreaterThan(0);
    expect(roles[0].name).toBeDefined();
    expect(typeof roles[0].superuser).toBe("boolean");
    expect(JSON.stringify(roles)).not.toContain("password");
  });

  it("lists permissions on tables and schemas", async () => {
    const fallbackPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("information_schema.table_privileges")) {
        return [
          {
            grantor: "postgres",
            grantee: "test_user",
            object_type: "table",
            object_name: "public.items",
            privilege: "SELECT",
            grantable: false,
          },
        ];
      }
      return [];
    });

    const activePool = (pool as any).isLiveDb ? pool : fallbackPool;
    const perms = await listPermissions(activePool, { objectType: "table" });
    expect(perms.length).toBeGreaterThan(0);
    expect(perms[0]).toHaveProperty("grantee");
    expect(perms[0]).toHaveProperty("privilege");
  });
});
