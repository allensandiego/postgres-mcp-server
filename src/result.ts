export type QueryErrorCode =
  | "invalid_sql"
  | "table_not_found"
  | "write_disabled"
  | "result_truncated"
  | "connection_lost"
  | "timeout"
  | "no_access";

export interface QueryError {
  code: QueryErrorCode;
  message: string;
  detail?: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export interface TableColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: string;
  columns: TableColumnInfo[];
}

export interface DescribeTableResult {
  schema: string;
  table: string;
  columns: TableColumnInfo[];
  primaryKey?: string;
}

export interface DatabaseInfo {
  name: string;
  owner: string;
  encoding: string;
  isTemplate: boolean;
  connectable: boolean;
}

export interface RoleInfo {
  name: string;
  superuser: boolean;
  canLogin: boolean;
  canCreateDb: boolean;
  canCreateRole: boolean;
  canBypassRls: boolean;
  memberOf: string[];
  members?: string[];
}

export interface PermissionInfo {
  grantor: string;
  grantee: string;
  objectType: string;
  objectName: string;
  privilege: string;
  grantable: boolean;
}

export interface WriteQueryResult {
  rowCount: number;
  affectedTables?: string[];
}

const VALID_ERROR_CODES: Set<string> = new Set([
  "invalid_sql",
  "table_not_found",
  "write_disabled",
  "result_truncated",
  "connection_lost",
  "timeout",
  "no_access",
]);

/**
 * Sanitizes an error message or string by stripping credentials, connection strings,
 * and stack traces to satisfy SC-005 and FR-008.
 */
export function sanitizeErrorMessage(input: unknown): string {
  if (input === null || input === undefined) {
    return "Unknown error occurred";
  }

  let text: string;
  if (typeof input === "string") {
    text = input;
  } else if (typeof input === "object" && input !== null && "message" in input && typeof (input as any).message === "string") {
    text = (input as any).message;
  } else if (input instanceof Error) {
    text = input.message;
  } else {
    text = String(input);
  }

  // Redact connection strings: postgres://user:password@host:port/db or postgresql://...
  text = text.replace(/(postgres|postgresql):\/\/[^@\s]+@/gi, "$1://[REDACTED]@");
  
  // Redact password parameters
  text = text.replace(/password\s*=\s*['"]?[^'"\s;]+['"]?/gi, "password=[REDACTED]");
  
  // Redact node/v8 stack trace paths if any leaked into the message
  text = text.replace(/^\s*at\s+.*$/gm, "").trim();

  return text || "Error occurred";
}

/**
 * Classifies an exception into a standard QueryError.
 */
export function classifyError(err: unknown): QueryError {
  if (typeof err === "object" && err !== null) {
    const errorObj = err as Record<string, unknown>;
    const rawCode = String(errorObj.code || "");
    const rawMessage = typeof errorObj.message === "string" ? errorObj.message : "";
    const sanitized = sanitizeErrorMessage(rawMessage || err);

    // If it's already a shaped QueryError with one of our stable codes, preserve it
    if (VALID_ERROR_CODES.has(rawCode)) {
      return {
        code: rawCode as QueryErrorCode,
        message: sanitized,
        detail: errorObj.detail ? sanitizeErrorMessage(errorObj.detail) : undefined,
      };
    }

    // PostgreSQL error code mappings
    // 42P01: undefined_table, 42703: undefined_column
    if (rawCode === "42P01" || rawCode === "42703") {
      return {
        code: "table_not_found",
        message: sanitized,
        detail: errorObj.detail ? sanitizeErrorMessage(errorObj.detail) : undefined,
      };
    }

    // 42501: insufficient_privilege
    if (rawCode === "42501") {
      return {
        code: "no_access",
        message: "Access denied: insufficient privilege to view or perform operation on the requested object",
        detail: errorObj.detail ? sanitizeErrorMessage(errorObj.detail) : undefined,
      };
    }

    // 57014: query_canceled (often statement timeout)
    if (rawCode === "57014" || sanitized.toLowerCase().includes("timeout") || sanitized.toLowerCase().includes("timed out")) {
      return {
        code: "timeout",
        message: "Query exceeded configured timeout limit",
      };
    }

    // Connection errors: 08000, 08003, 08006, 08001, 08004, ECONNREFUSED, ENOTFOUND
    if (
      rawCode.startsWith("08") ||
      rawCode === "ECONNREFUSED" ||
      rawCode === "ENOTFOUND" ||
      rawCode === "EPIPE" ||
      rawCode === "ETIMEDOUT" ||
      sanitized.toLowerCase().includes("econnrefused") ||
      sanitized.toLowerCase().includes("connection")
    ) {
      return {
        code: "connection_lost",
        message: "Database connection unavailable or failed",
        detail: sanitized,
      };
    }

    // Syntax errors and standard SQL parsing errors (42601, 42804, 42883, etc.)
    if (rawCode.startsWith("42") || rawCode.startsWith("22") || rawCode.startsWith("23")) {
      return {
        code: "invalid_sql",
        message: sanitized,
        detail: errorObj.detail ? sanitizeErrorMessage(errorObj.detail) : undefined,
      };
    }
  }

  const sanitized = sanitizeErrorMessage(err);

  // Fallback string matching
  if (sanitized.toLowerCase().includes("write disabled") || sanitized.toLowerCase().includes("read-only")) {
    return {
      code: "write_disabled",
      message: "Write operations are disabled. Set ALLOW_WRITE=1 to enable write statements.",
    };
  }

  if (sanitized.toLowerCase().includes("not found")) {
    return {
      code: "table_not_found",
      message: sanitized,
    };
  }

  return {
    code: "invalid_sql",
    message: sanitized,
  };
}

/**
 * Shapes successful tool responses for MCP.
 */
export function formatSuccessResponse<T>(data: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Shapes error tool responses for MCP with isError: true.
 */
export function formatErrorResponse(error: QueryError) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(error, null, 2),
      },
    ],
  };
}
