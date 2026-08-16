import { z } from "zod";
import { DatabasePool } from "../db/pool.js";
import { SetRoleResult } from "../result.js";

export const setRoleSchema = {
  role: z
    .string()
    .min(1)
    .describe("Role or username to set (e.g. 'analyst', 'app_user', or 'NONE' / 'RESET' to restore default)"),
};

export async function setRole(
  pool: DatabasePool,
  args: { role: string }
): Promise<SetRoleResult> {
  const targetRole = args.role.trim();
  const isReset = targetRole.toUpperCase() === "NONE" || targetRole.toUpperCase() === "RESET";

  if (isReset) {
    pool.setActiveRole(null);
    const res = await pool.query<{ current_user: string; session_user: string }>(
      "SELECT current_user, session_user"
    );
    const row = res.rows[0] || { current_user: "unknown", session_user: "unknown" };
    return {
      activeRole: row.current_user,
      sessionUser: row.session_user,
      isReset: true,
      message: `Active role reset to session user '${row.session_user}'.`,
    };
  }

  // Validate and test role switch with query-level override
  const res = await pool.query<{ current_user: string; session_user: string }>(
    "SELECT current_user, session_user",
    [],
    { role: targetRole }
  );

  const row = res.rows[0] || { current_user: targetRole, session_user: "unknown" };
  pool.setActiveRole(targetRole);

  return {
    activeRole: row.current_user,
    sessionUser: row.session_user,
    isReset: false,
    message: `Set active role to '${row.current_user}' (session user is '${row.session_user}').`,
  };
}
