import { describe, expect, it } from "vitest";
import { classifyError, formatErrorResponse, formatSuccessResponse, sanitizeErrorMessage } from "../../src/result.js";

describe("result and error module", () => {
  it("sanitizes connection URLs and passwords from error messages", () => {
    const errorWithUrl = "Failed to connect to postgres://user:secretpassword123@db.example.com:5432/mydb";
    const sanitized = sanitizeErrorMessage(errorWithUrl);
    expect(sanitized).not.toContain("secretpassword123");
    expect(sanitized).toContain("postgres://[REDACTED]@db.example.com:5432/mydb");

    const errorWithParam = "Error connecting with password='mypassword' to host";
    const sanitizedParam = sanitizeErrorMessage(errorWithParam);
    expect(sanitizedParam).not.toContain("mypassword");
  });

  it("classifies undefined table/column (42P01 / 42703) as table_not_found", () => {
    const pgErr = { code: "42P01", message: 'relation "non_existent" does not exist' };
    const classified = classifyError(pgErr);
    expect(classified.code).toBe("table_not_found");
    expect(classified.message).toContain('relation "non_existent" does not exist');
  });

  it("classifies permission error (42501) as no_access", () => {
    const pgErr = { code: "42501", message: 'permission denied for table users' };
    const classified = classifyError(pgErr);
    expect(classified.code).toBe("no_access");
  });

  it("classifies timeout error (57014) as timeout", () => {
    const pgErr = { code: "57014", message: 'canceling statement due to statement timeout' };
    const classified = classifyError(pgErr);
    expect(classified.code).toBe("timeout");
  });

  it("classifies connection failures as connection_lost", () => {
    const pgErr = { code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:5432" };
    const classified = classifyError(pgErr);
    expect(classified.code).toBe("connection_lost");
  });

  it("classifies syntax errors (42601) as invalid_sql", () => {
    const pgErr = { code: "42601", message: 'syntax error at or near "SELCT"' };
    const classified = classifyError(pgErr);
    expect(classified.code).toBe("invalid_sql");
  });

  it("formats success and error responses properly for MCP", () => {
    const successRes = formatSuccessResponse({ data: [1, 2, 3] });
    expect(successRes.content[0].type).toBe("text");
    expect(JSON.parse(successRes.content[0].text)).toEqual({ data: [1, 2, 3] });

    const errorRes = formatErrorResponse({ code: "write_disabled", message: "Writes disabled" });
    expect(errorRes.isError).toBe(true);
    expect(errorRes.content[0].type).toBe("text");
    expect(JSON.parse(errorRes.content[0].text)).toEqual({
      code: "write_disabled",
      message: "Writes disabled",
    });
  });
});
