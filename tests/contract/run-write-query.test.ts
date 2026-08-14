import { describe, expect, it } from "vitest";
import { createTestMcpClient } from "../helpers/mcp-client.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";

describe("US4: run_write_query contract tests", () => {
  it("registers run_write_query with destructiveHint", async () => {
    const { client, close } = await createTestMcpClient();

    try {
      const toolList = await client.listTools();
      const runWriteQueryTool = toolList.tools.find((t) => t.name === "run_write_query");

      expect(runWriteQueryTool).toBeDefined();
      expect(runWriteQueryTool?.annotations?.destructiveHint).toBe(true);
      expect(runWriteQueryTool?.inputSchema?.required).toContain("sql");
    } finally {
      await close();
    }
  });

  it("rejects write execution with write_disabled error when allowWrite is false", async () => {
    const mockPool = new MockDatabasePool({ allowWrite: false });
    const { client, close } = await createTestMcpClient({ allowWrite: false }, mockPool);

    try {
      const response = await client.callTool({
        name: "run_write_query",
        arguments: {
          sql: "INSERT INTO items (name) VALUES ('new_item')",
        },
      });

      expect(response.isError).toBe(true);
      const content = JSON.parse((response.content[0] as any).text);
      expect(content.code).toBe("write_disabled");
      expect(content.message).toContain("ALLOW_WRITE=1");
    } finally {
      await close();
    }
  });

  it("executes write statement and returns affected row count when allowWrite is true", async () => {
    const mockPool = new MockDatabasePool({ allowWrite: true }, () => ({
      rowCount: 3,
    }));

    const { client, close } = await createTestMcpClient({ allowWrite: true }, mockPool);

    try {
      const response = await client.callTool({
        name: "run_write_query",
        arguments: {
          sql: "UPDATE items SET active = true WHERE id IN ($1, $2, $3)",
          params: [1, 2, 3],
        },
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(content).toEqual({
        rowCount: 3,
      });
    } finally {
      await close();
    }
  });
});
