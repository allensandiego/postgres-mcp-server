import { describe, expect, it } from "vitest";
import { createTestMcpClient } from "../helpers/mcp-client.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";

describe("US3: run_query contract tests", () => {
  it("registers run_query with readOnlyHint and input schema", async () => {
    const { client, close } = await createTestMcpClient();

    try {
      const toolList = await client.listTools();
      const runQueryTool = toolList.tools.find((t) => t.name === "run_query");

      expect(runQueryTool).toBeDefined();
      expect(runQueryTool?.annotations?.readOnlyHint).toBe(true);
      expect(runQueryTool?.inputSchema?.required).toContain("sql");
    } finally {
      await close();
    }
  });

  it("executes valid SELECT query and shapes columns/rows/rowCount/truncated", async () => {
    const mockPool = new MockDatabasePool({}, () => ({
      rows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      fields: [
        { name: "id", dataTypeID: 23 },
        { name: "name", dataTypeID: 25 },
      ],
    }));

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const response = await client.callTool({
        name: "run_query",
        arguments: {
          sql: "SELECT id, name FROM users WHERE id > $1",
          params: [0],
        },
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(content).toMatchObject({
        columns: [
          { name: "id", dataType: "23" },
          { name: "name", dataType: "25" },
        ],
        rows: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        rowCount: 2,
        truncated: false,
      });
    } finally {
      await close();
    }
  });

  it("rejects mutating statements when run through run_query", async () => {
    const { client, close } = await createTestMcpClient();

    try {
      const response = await client.callTool({
        name: "run_query",
        arguments: {
          sql: "INSERT INTO users (name) VALUES ('Charlie')",
        },
      });

      expect(response.isError).toBe(true);
      const content = JSON.parse((response.content[0] as any).text);
      expect(content.code).toBe("invalid_sql");
      expect(content.message).toContain("run_query only accepts read-only statements");
    } finally {
      await close();
    }
  });

  it("handles result set truncation when rows exceed limit", async () => {
    // Generate 5 items, but limit is set to 3
    const mockPool = new MockDatabasePool({ maxRowLimit: 3 }, () => ({
      rows: [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 }, // 4th row triggers truncation
      ],
    }));

    const { client, close } = await createTestMcpClient({ maxRowLimit: 3 }, mockPool);

    try {
      const response = await client.callTool({
        name: "run_query",
        arguments: {
          sql: "SELECT id FROM items",
          limit: 3,
        },
      });

      expect(response.isError).toBeFalsy();
      const content = JSON.parse((response.content[0] as any).text);
      expect(content.rowCount).toBe(3);
      expect(content.rows).toHaveLength(3);
      expect(content.truncated).toBe(true);
    } finally {
      await close();
    }
  });
});
