import { describe, expect, it } from "vitest";
import { loadConfig, parseBoolean, parseNumber, sanitizeConfig } from "../../src/config.js";

describe("config module", () => {
  it("parses boolean values correctly", () => {
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("on")).toBe(true);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean(undefined, false)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });

  it("parses number values correctly", () => {
    expect(parseNumber("500", 1000)).toBe(500);
    expect(parseNumber("invalid", 1000)).toBe(1000);
    expect(parseNumber("-10", 1000)).toBe(1000);
    expect(parseNumber(undefined, 1000)).toBe(1000);
  });

  it("loads default config from empty environment", () => {
    const config = loadConfig({});
    expect(config.allowWrite).toBe(false);
    expect(config.maxRowLimit).toBe(1000);
    expect(config.queryTimeoutMs).toBe(30000);
    expect(config.statementTimeoutMs).toBe(30000);
    expect(config.maxConnections).toBe(10);
  });

  it("loads discrete environment variables correctly", () => {
    const config = loadConfig({
      PGHOST: "db.internal",
      PGPORT: "5433",
      PGDATABASE: "analytics",
      PGUSER: "analyst",
      PGPASSWORD: "secret-password",
      ALLOW_WRITE: "true",
      MAX_ROW_LIMIT: "250",
      QUERY_TIMEOUT_MS: "15000",
    });

    expect(config.host).toBe("db.internal");
    expect(config.port).toBe(5433);
    expect(config.database).toBe("analytics");
    expect(config.user).toBe("analyst");
    expect(config.password).toBe("secret-password");
    expect(config.allowWrite).toBe(true);
    expect(config.maxRowLimit).toBe(250);
    expect(config.queryTimeoutMs).toBe(15000);
  });

  it("sanitizes config object to prevent credential leakage", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://superadmin:supersecret@db.prod.com:5432/maindb",
      ALLOW_WRITE: "1",
    });

    const sanitized = sanitizeConfig(config);
    expect(sanitized.host).toBe("db.prod.com");
    expect(sanitized.database).toBe("maindb");
    expect(sanitized.user).toBe("superadmin");
    // Ensure password is not present in sanitized output
    expect(JSON.stringify(sanitized)).not.toContain("supersecret");
  });
});
