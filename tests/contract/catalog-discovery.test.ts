import { describe, expect, it } from "vitest";
import { createTestMcpClient } from "../helpers/mcp-client.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";

describe("US2: catalog discovery contract tests", () => {
  it("registers list_databases, list_roles, list_permissions with readOnlyHint", async () => {
    const { client, close } = await createTestMcpClient();

    try {
      const toolList = await client.listTools();
      const listDatabasesTool = toolList.tools.find((t) => t.name === "list_databases");
      const listRolesTool = toolList.tools.find((t) => t.name === "list_roles");
      const listPermissionsTool = toolList.tools.find((t) => t.name === "list_permissions");

      expect(listDatabasesTool).toBeDefined();
      expect(listDatabasesTool?.annotations?.readOnlyHint).toBe(true);

      expect(listRolesTool).toBeDefined();
      expect(listRolesTool?.annotations?.readOnlyHint).toBe(true);

      expect(listPermissionsTool).toBeDefined();
      expect(listPermissionsTool?.annotations?.readOnlyHint).toBe(true);
    } finally {
      await close();
    }
  });

  it("handles list_databases tool call", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("pg_database")) {
        return [
          {
            name: "postgres",
            owner: "postgres",
            encoding: "UTF8",
            is_template: false,
            connectable: true,
          },
        ];
      }
      return [];
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "list_databases",
        arguments: {},
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(Array.isArray(content)).toBe(true);
      expect(content[0]).toEqual({
        name: "postgres",
        owner: "postgres",
        encoding: "UTF8",
        isTemplate: false,
        connectable: true,
      });
    } finally {
      await close();
    }
  });

  it("handles list_roles tool call without exposing secrets", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("FROM pg_catalog.pg_roles")) {
        return [
          {
            name: "postgres",
            superuser: true,
            can_login: true,
            can_create_db: true,
            can_create_role: true,
            can_bypass_rls: true,
          },
          {
            name: "readonly_user",
            superuser: false,
            can_login: true,
            can_create_db: false,
            can_create_role: false,
            can_bypass_rls: false,
          },
        ];
      }
      return [];
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "list_roles",
        arguments: {},
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(content).toHaveLength(2);
      expect(content[0].name).toBe("postgres");
      expect(content[0].superuser).toBe(true);
      expect(content[1].name).toBe("readonly_user");
      expect(content[1].canCreateDb).toBe(false);
      // Ensure no password properties are ever returned
      expect(JSON.stringify(content)).not.toContain("password");
    } finally {
      await close();
    }
  });

  it("handles list_permissions tool call with filters", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("information_schema.table_privileges")) {
        return [
          {
            grantor: "postgres",
            grantee: "analyst",
            object_type: "table",
            object_name: "public.orders",
            privilege: "SELECT",
            grantable: false,
          },
        ];
      }
      return [];
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "list_permissions",
        arguments: { objectType: "table", schema: "public", table: "orders" },
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({
        grantor: "postgres",
        grantee: "analyst",
        objectType: "table",
        objectName: "public.orders",
        privilege: "SELECT",
        grantable: false,
      });
    } finally {
      await close();
    }
  });
});
