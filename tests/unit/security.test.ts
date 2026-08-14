import { describe, expect, it } from "vitest";
import { classifyError, formatErrorResponse, sanitizeErrorMessage } from "../../src/result.js";
import { createTestMcpClient } from "../helpers/mcp-client.js";
import { MockDatabasePool } from "../helpers/mock-pool.js";

describe("security and credential sanitization (SC-005, FR-008)", () => {
  it("never includes database password in error responses", () => {
    const rawError = new Error(
      "Connection failed for postgresql://myadmin:super_secret_pw123@db.example.com:5432/proddb"
    );
    const classified = classifyError(rawError);
    const formatted = formatErrorResponse(classified);

    const serialized = JSON.stringify(formatted);
    expect(serialized).not.toContain("super_secret_pw123");
    expect(serialized).toContain("[REDACTED]");
  });

  it("strips V8/Node stack traces from error messages", () => {
    const errorWithStack = `Query failed with error
      at PGClient.query (/node_modules/pg/lib/client.js:123:45)
      at async runQuery (/src/tools/run-query.ts:50:10)`;

    const sanitized = sanitizeErrorMessage(errorWithStack);
    expect(sanitized).not.toContain("at PGClient.query");
    expect(sanitized).not.toContain("client.js:123:45");
  });

  it("strips credentials when calling tools via MCP client that throw DB connection errors", async () => {
    const mockPool = new MockDatabasePool({}, () => {
      throw new Error("connect ECONNREFUSED postgres://admin:leaked_secret@10.0.0.1:5432/secret_db");
    });

    const { client, close } = await createTestMcpClient({}, mockPool);

    try {
      const result = await client.callTool({
        name: "run_query",
        arguments: { sql: "SELECT 1" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as any).text;
      expect(text).not.toContain("leaked_secret");
      expect(text).toContain("[REDACTED]");
    } finally {
      await close();
    }
  });
});
