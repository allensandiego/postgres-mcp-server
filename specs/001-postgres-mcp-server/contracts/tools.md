# Tool Contracts: Postgres MCP Server

This project exposes its interface as MCP **tools** over stdio. Each contract documents
the tool name, purpose, input schema, and output shape. Tool names follow the
constitution's User Experience Consistency principle (predictable, aligned naming).

## Common Result & Error Shape

All tools return MCP tool results. On success, `content` is a text block; where
structured output is useful, `structuredContent` carries the parsed value. On failure,
the result is marked `isError: true` with a uniform `QueryError` shape
(`{ code, message, detail? }`).

## Tools

### list_tables

- **Purpose**: Discover schemas and their tables/columns without writing a query
  (FR-002).
- **Input**: `{ schema?: string }` — optional filter; defaults to all user schemas.
- **Output**: List of `{ schema, name, type, columns: [{ name, dataType, nullable,
  isPrimaryKey, isUnique }] }`.

### describe_table

- **Purpose**: Detail the columns and types of one table (FR-002).
- **Input**: `{ schema: string, table: string }`.
- **Output**: `{ schema, table, columns: [...] , primaryKey?: string }`.

### list_databases

- **Purpose**: Discover databases visible/connectable to the connected user (FR-002a).
- **Input**: none.
- **Output**: List of `{ name, owner, encoding, isTemplate, connectable }`.

### list_roles

- **Purpose**: Discover roles/users and their attributes and memberships (FR-002b).
- **Input**: none.
- **Output**: List of `{ name, superuser, canLogin, canCreateDb, canCreateRole,
  canBypassRls, memberOf: string[], members?: string[] }`. Never exposes passwords or
  secrets.

### list_permissions

- **Purpose**: Discover privileges granted to roles on schemas, tables, and columns
  (FR-002c).
- **Input**: `{ objectType?: 'schema'|'table'|'column', schema?: string, table?:
  string }` — optional filters; defaults to all visible.
- **Output**: List of `{ grantor, grantee, objectType, objectName, privilege,
  grantable }`. Returns authorization metadata only.

### run_query

- **Purpose**: Execute a read-only SELECT and return structured rows (FR-003).
- **Input**: `{ sql: string, params?: unknown[], limit?: number, offset?: number }`.
  - `limit`/`offset` enable pagination (FR-005). `limit` MUST NOT exceed the configured
    maximum.
  - SQL MUST be parameterized; identifiers MUST be escaped/allow-listed (FR-007).
- **Output**: `{ columns: [{ name, dataType }], rows: object[], rowCount: number,
  truncated: boolean }`.

### run_write_query

- **Purpose**: Execute INSERT/UPDATE/DELETE/DDL when write mode is enabled (FR-006).
- **Input**: `{ sql: string, params?: unknown[] }`.
- **Behavior**: Rejected with `isError: true` and code `write_disabled` when write mode
  is off; returns affected `rowCount` when enabled.
- **Output**: `{ rowCount: number, affectedTables?: string[] }`.

## Annotations

- `list_tables`, `describe_table`, `list_databases`, `list_roles`, `list_permissions`,
  `run_query`: `readOnlyHint: true`.
- `run_write_query`: `destructiveHint: true` when it can mutate data; only registered
  (or guarded) when write mode is enabled.

## Error Codes

| Code | Meaning |
|------|---------|
| `invalid_sql` | Query failed to parse/execute; `message` is actionable |
| `table_not_found` | Referenced table/column does not exist |
| `write_disabled` | Write attempted while read-only |
| `result_truncated` | (informational) limit reached |
| `connection_lost` | DB connection unavailable |
| `timeout` | Query exceeded configured timeout |
| `no_access` | Connected user lacks privilege to view the requested catalog object |