import { describe, expect, it } from "vitest";
import { createTestMcpClient } from "../helpers/mcp-client.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";

describe("set_role contract tests", () => {
  it("registers set_role tool with input schema", async () => {
    const { client, close } = await createTestMcpClient();

    try {
      const toolList = await client.listTools();
      const setRoleTool = toolList.tools.find((t) => t.name === "set_role");

      expect(setRoleTool).toBeDefined();
      expect(setRoleTool?.inputSchema?.required).toContain("role");
    } finally {
      await close();
    }
  });

  it("calls set_role tool successfully", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("current_user")) {
        return {
          rows: [{ current_user: "app_reader", session_user: "postgres" }],
        };
      }
      return { rows: [] };
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "set_role",
        arguments: {
          role: "app_reader",
        },
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(content).toMatchObject({
        activeRole: "app_reader",
        sessionUser: "postgres",
        isReset: false,
      });
      expect(mockPool.getActiveRole()).toBe("app_reader");
    } finally {
      await close();
    }
  });

  it("supports role override in run_query", async () => {
    let capturedRole: string | undefined;
    const mockPool = new MockDatabasePool({}, (_sql, _params) => {
      return {
        rows: [{ id: 1 }],
        fields: [{ name: "id", dataTypeID: 23 }],
      };
    });

    // Wrap query to inspect options
    const originalQuery = mockPool.query.bind(mockPool);
    mockPool.query = async (text, params, options) => {
      capturedRole = options?.role;
      return originalQuery(text, params, options);
    };

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "run_query",
        arguments: {
          sql: "SELECT 1 as id",
          role: "custom_role",
        },
      });

      expect(response.isError).toBeFalsy();
      expect(capturedRole).toBe("custom_role");
    } finally {
      await close();
    }
  });
});
