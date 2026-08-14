import { describe, expect, it } from "vitest";
import { createTestMcpClient } from "../helpers/mcp-client.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";

describe("US1: schema discovery contract tests", () => {
  it("registers list_tables and describe_table tools with readOnlyHint", async () => {
    const { client, close } = await createTestMcpClient();

    try {
      const toolList = await client.listTools();
      const listTablesTool = toolList.tools.find((t) => t.name === "list_tables");
      const describeTableTool = toolList.tools.find((t) => t.name === "describe_table");

      expect(listTablesTool).toBeDefined();
      expect(listTablesTool?.annotations?.readOnlyHint).toBe(true);
      expect(listTablesTool?.inputSchema?.type).toBe("object");

      expect(describeTableTool).toBeDefined();
      expect(describeTableTool?.annotations?.readOnlyHint).toBe(true);
      expect(describeTableTool?.inputSchema?.type).toBe("object");
      expect(describeTableTool?.inputSchema?.required).toEqual(
        expect.arrayContaining(["schema", "table"])
      );
    } finally {
      await close();
    }
  });

  it("validates arguments and handles list_tables tool calls", async () => {
    const mockPool = new MockDatabasePool({}, (sql, _params) => {
      if (sql.includes("information_schema.tables")) {
        return [
          {
            schema: "public",
            name: "users",
            type: "table",
            column_name: "id",
            data_type: "integer",
            nullable: false,
            is_primary_key: true,
            is_unique: true,
            ordinal_position: 1,
          },
          {
            schema: "public",
            name: "users",
            type: "table",
            column_name: "email",
            data_type: "text",
            nullable: false,
            is_primary_key: false,
            is_unique: true,
            ordinal_position: 2,
          },
        ];
      }
      return [];
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "list_tables",
        arguments: { schema: "public" },
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(Array.isArray(content)).toBe(true);
      expect(content).toHaveLength(1);
      expect(content[0].name).toBe("users");
      expect(content[0].schema).toBe("public");
      expect(content[0].columns).toHaveLength(2);
      expect(content[0].columns[0]).toMatchObject({
        name: "id",
        dataType: "integer",
        isPrimaryKey: true,
      });
    } finally {
      await close();
    }
  });

  it("validates describe_table returns table_not_found for non-existent tables", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("FROM information_schema.tables")) {
        return { rows: [], rowCount: 0 };
      }
      return [];
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "describe_table",
        arguments: { schema: "public", table: "ghost_table" },
      });

      expect(response.isError).toBe(true);
      const content = JSON.parse((response.content[0] as any).text);
      expect(content.code).toBe("table_not_found");
      expect(content.message).toContain("ghost_table");
    } finally {
      await close();
    }
  });
});
