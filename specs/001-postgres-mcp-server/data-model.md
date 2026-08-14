# Data Model: Postgres MCP Server

Phase 1 output for `/specs/001-postgres-mcp-server`. This feature does not persist its
own data; the model describes the entities surfaced and manipulated through the server's
tools.

## Entities

### DatabaseConnection

The configured link to the target PostgreSQL database.

- **Attributes**:
  - `connectionString` — full `postgres://` connection string (secret; never logged).
  - `host`, `port`, `database`, `user` — discrete connection parts (via env).
  - `password` — credential (secret; never logged).
  - `poolConfig` — `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`,
    `statement_timeout`, `query_timeout`.
- **Validation**: Credentials MUST be supplied via environment; a connection with no
  reachable database MUST fail fast with a clear status error (FR-001).

### Schema

A namespace in the connected database.

- **Attributes**: `name`.
- **Relationships**: contains many Tables.

### Table

A relation the assistant can discover and query.

- **Attributes**: `name`, `schema` (owning Schema), `type` (table/view).
- **Relationships**: belongs to one Schema; contains many Columns.

### Column

A field of a Table.

- **Attributes**: `name`, `dataType` (Postgres type), `nullable`, `isPrimaryKey`,
  `isUnique`.
- **Relationships**: belongs to one Table.

### QueryResult

The structured output of an executed query.

- **Attributes**: `columns` (names + types), `rows` (array of objects), `rowCount`,
  `truncated` (whether the configured limit was hit).
- **Validation**: result set MUST NOT exceed the configured row limit without the
  `truncated` flag being set (FR-004).

### Database

A distinct Postgres database visible to the connected user.

- **Attributes**: `name`, `owner`, `encoding`, `isTemplate`, `connectable`.
- **Validation**: only databases the connected user can see/connect to are returned
  (FR-002a, SC-001a).

### Role

A login role or group role.

- **Attributes**: `name`, `superuser`, `canLogin`, `canCreateDb`, `canCreateRole`,
  `canBypassRls`, `memberOf` (list of group roles), `members` (for group roles).
- **Validation**: reflects actual `pg_roles`/`pg_auth_members` catalog state; no
  password or secret attributes are exposed (FR-002b, SC-001a).

### Permission

A privilege granted on an object to a role.

- **Attributes**: `grantor`, `grantee`, `objectType` (schema/table/column),
  `objectName`, `privilege` (e.g., SELECT, INSERT, UPDATE, DELETE, USAGE), `grantable`.
- **Validation**: derived from `information_schema` privilege views / `aclexplode`;
  returns authorization metadata only, never credentials (FR-002c, SC-001a).

### QueryError

The uniform, structured error returned on failure.

- **Attributes**: `code` (stable machine-readable id), `message` (actionable, no
  secrets/stack traces), `detail` (optional, sanitized).
- **Validation**: MUST never contain credentials, connection strings, or internal stack
  traces (FR-008, SC-005).

## State Transitions

- **Connection lifecycle**: `connecting → connected → (query) → released`. Connections
  are acquired from the pool and always released in a `finally` block (FR-010).
- **Write mode**: global config flag, `read-only` (default) or `write-enabled`. A write
  statement while `read-only` is rejected before any execution (FR-006).
- **Query lifecycle**: `validate → execute → shape → return`. Parameterized SQL only;
  dynamic identifiers escaped or allow-listed (FR-007).

## Validation Rules (from spec requirements)

- FR-002 / FR-011: schema discovery reflects actual `information_schema` state.
- FR-002a: database discovery returns only databases visible/connectable to the user.
- FR-002b: role discovery returns roles with attributes and memberships, no secrets.
- FR-002c: permissions discovery returns grants by role and object, no secrets.
- FR-003: SELECT results returned with column names and row values.
- FR-004: result size limited with truncation indication.
- FR-005: pagination via `limit`/`offset` arguments.
- FR-006: writes rejected unless write mode enabled.
- FR-007: all SQL parameterized; no raw-input dynamic SQL.
- FR-009: uniform error/tool-naming conventions.