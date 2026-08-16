import { describe, expect, it } from "vitest";
import { MockDatabasePool } from "../helpers/mock-pool.js";
import { setRole } from "../../src/tools/set-role.js";

describe("setRole tool unit tests", () => {
  it("sets active role to a specified user/role", async () => {
    const mockPool = new MockDatabasePool({}, (sql, _params) => {
      if (sql.includes("current_user")) {
        return {
          rows: [{ current_user: "analyst", session_user: "postgres" }],
        };
      }
      return { rows: [] };
    });

    const result = await setRole(mockPool, { role: "analyst" });

    expect(result).toEqual({
      activeRole: "analyst",
      sessionUser: "postgres",
      isReset: false,
      message: "Set active role to 'analyst' (session user is 'postgres').",
    });
    expect(mockPool.getActiveRole()).toBe("analyst");
  });

  it("resets active role when role is NONE", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("current_user")) {
        return {
          rows: [{ current_user: "postgres", session_user: "postgres" }],
        };
      }
      return { rows: [] };
    });

    mockPool.setActiveRole("analyst");
    expect(mockPool.getActiveRole()).toBe("analyst");

    const result = await setRole(mockPool, { role: "NONE" });

    expect(result).toEqual({
      activeRole: "postgres",
      sessionUser: "postgres",
      isReset: true,
      message: "Active role reset to session user 'postgres'.",
    });
    expect(mockPool.getActiveRole()).toBeNull();
  });

  it("resets active role when role is RESET", async () => {
    const mockPool = new MockDatabasePool({}, (sql) => {
      if (sql.includes("current_user")) {
        return {
          rows: [{ current_user: "postgres", session_user: "postgres" }],
        };
      }
      return { rows: [] };
    });

    mockPool.setActiveRole("admin_user");
    const result = await setRole(mockPool, { role: "RESET" });

    expect(result.isReset).toBe(true);
    expect(mockPool.getActiveRole()).toBeNull();
  });

  it("fails and does not update active role if query throws error", async () => {
    const mockPool = new MockDatabasePool({}, () => {
      const err: any = new Error('permission denied to set role "superadmin"');
      err.code = "42501";
      throw err;
    });

    mockPool.setActiveRole(null);

    await expect(setRole(mockPool, { role: "superadmin" })).rejects.toMatchObject({
      code: "no_access",
    });
    expect(mockPool.getActiveRole()).toBeNull();
  });
});
