# Feature Specification: Postgres MCP Server

**Feature Branch**: `001-postgres-mcp-server`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "I want to build an mcp server for a postgres database."

Scope addition (plan amendment): the server must also include database discovery,
role/user discovery, and permissions discovery.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect and Inspect Schema (Priority: P1)

An AI assistant user connects to a Postgres database through the MCP server to discover
what data is available. The assistant lists schemas, tables, and column definitions,
then references them to write informed queries.

**Why this priority**: Discovery is the foundation of every downstream use. Without
schema inspection, no other tool can produce reliable, context-aware queries. It
delivers immediate value as a standalone capability.

**Independent Test**: Can be fully tested by connecting to a test database and asking
the assistant to list all tables and their columns; the result must match the actual
schema and be returned within a reasonable time.

**Acceptance Scenarios**:

1. **Given** a running server configured with a reachable Postgres database, **When** the
   assistant requests the list of tables, **Then** the server returns the schema names,
   table names, and column definitions from that database.
2. **Given** a database with no user-created tables, **When** the assistant requests the
   list of tables, **Then** the server returns an empty list without an error.

---

### User Story 2 - Discover Databases, Roles, and Permissions (Priority: P1)

An AI assistant user inspects the server's environment: which databases exist, which
roles/users exist, and what permissions/privileges are granted (on schemas, tables, and
columns). This answers governance, access-audit, and "who can see/do what" questions
without requiring manual SQL.

**Why this priority**: Visibility into databases, roles, and permissions is a first-class
discovery need on par with schema inspection and enables safe, context-aware querying
(e.g., knowing whether a write is permitted before attempting one).

**Independent Test**: Can be fully tested by connecting to a test database that defines a
second role and a grant, then asking the assistant to list roles and permissions; the
results must match the actual catalog.

**Acceptance Scenarios**:

1. **Given** a reachable Postgres server, **When** the assistant requests the list of
   databases, **Then** the server returns the database names from the catalog.
2. **Given** a test database with multiple roles, **When** the assistant requests the
   list of roles/users, **Then** the server returns each role with its attributes (e.g.,
   login, superuser, member of).
3. **Given** a schema/table with grants defined, **When** the assistant requests
   permissions, **Then** the server returns the granted privileges by role and object
   (schema, table, column) without exposing credentials.
4. **Given** the current user lacks permission to read certain catalog data, **When**
   discovery runs, **Then** the server returns what is visible and reports inaccessible
   objects without leaking details.

---

### User Story 3 - Run Read-Only Queries (Priority: P2)

An AI assistant runs SELECT queries against the connected database and receives
structured results. The assistant can paginate or limit large result sets and receives
consistent, parseable responses.

**Why this priority**: Read-only querying is the most common operation after discovery.
It is safe by default, delivers immediate analytical value, and is fully testable
without write access to the database.

**Independent Test**: Can be fully tested by issuing a parameterized SELECT against a
seeded test database and verifying the returned rows and column names match expectations.

**Acceptance Scenarios**:

1. **Given** a seeded test database, **When** the assistant runs a valid SELECT query,
   **Then** the server returns the matching rows with their column names.
2. **Given** a query whose result set exceeds the configured limit, **When** the
   assistant runs it without an explicit limit, **Then** the server returns at most the
   configured maximum number of rows and indicates truncation.
3. **Given** a query referencing a non-existent table, **When** the assistant runs it,
   **Then** the server returns a structured, actionable error and no partial data.

---

### User Story 4 - Safe Write Operations (Priority: P3)

A trusted user enables write mode and runs INSERT, UPDATE, DELETE, or DDL statements
through the server. Writes are explicit, auditable, and guarded by configuration so a
read-only misconfiguration can never mutate data.

**Why this priority**: Writes are powerful and dangerous. They are valuable but must
only be enabled deliberately, so they rank below read-only paths in importance.

**Independent Test**: Can be fully tested against an isolated disposable database by
enabling write mode, running an INSERT, and verifying the row persists; also verifiable
that writes fail cleanly when write mode is disabled.

**Acceptance Scenarios**:

1. **Given** a server with write mode disabled, **When** a write statement is issued,
   **Then** the server rejects it with a clear error and makes no changes.
2. **Given** a server with write mode enabled, **When** a valid INSERT is issued, **Then**
   the server applies the change and returns the affected row count.
3. **Given** write mode enabled and a statement that fails (e.g., a constraint
   violation), **When** it is executed, **Then** the server reports the error and leaves
   the database unchanged.

---

### Edge Cases

- What happens when the database connection is lost mid-session? The server must
  surface a clear error and allow reconnection without exposing internals.
- How does the system handle extremely large result sets? Results must be limited or
  paginated to avoid unbounded memory or response size.
- How does the system handle concurrent assistants sharing one connection pool?
  Queries must be serialized safely over the pool without deadlocks or leaked
  connections.
- What happens when a query is malformed or times out? A structured, actionable error
  must be returned and the connection must remain usable.
- How are connection credentials handled? Credentials must never appear in tool output
  or logs.
- What happens when SQL contains semicolon-separated multiple statements? Behavior must
  be explicitly defined (reject or sequence) to prevent ambiguity and injection risk.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to a Postgres database using a provided connection
  string and report connection status.
- **FR-002**: System MUST expose schema discovery tools that list schemas, tables,
  columns, and their types without requiring a query.
- **FR-002a**: System MUST expose database discovery that lists the databases visible to
  the connected user.
- **FR-002b**: System MUST expose role/user discovery that lists roles, their
  attributes, and group membership.
- **FR-002c**: System MUST expose permissions discovery that lists grants/privileges by
  role and object (schema, table, column).
- **FR-003**: System MUST execute read-only SQL queries and return structured results
  with column names and row values.
- **FR-004**: System MUST limit result set size to a configurable maximum and indicate
  when results are truncated.
- **FR-005**: System MUST support pagination or offset/limit arguments for large result
  sets.
- **FR-006**: System MUST execute write statements (INSERT, UPDATE, DELETE, DDL) ONLY
  when write mode is explicitly enabled; otherwise MUST reject them.
- **FR-007**: System MUST parameterize or validate all SQL to prevent injection and
  MUST NOT construct dynamic SQL from raw user input.
- **FR-008**: System MUST never expose connection credentials, full connection strings,
  or internal stack traces in any output.
- **FR-009**: System MUST return errors in a uniform, structured, actionable format
  with consistent tool naming as defined in the Assumptions section.
- **FR-010**: System MUST cleanly release database connections on completion or failure
  to prevent connection exhaustion.
- **FR-011**: System MUST expose database tables and/or schema as MCP resources for
  assistant discovery where applicable.

### Key Entities *(include if feature involves data)*

- **Database Connection**: The configured link to a Postgres database, defined by host,
  port, database name, user, and secret credentials; scoped to the server session.
- **Schema / Table / Column**: Metadata describing the structure of data the assistant
  can discover and query.
- **Database**: A distinct Postgres database visible to the connected user.
- **Role / User**: A login role or group role, with attributes and memberships.
- **Permission / Privilege**: A grant of a privilege on an object to a role.
- **Query Result**: The structured output of a query, composed of column definitions and
  rows, with truncation metadata when applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An assistant can discover all tables and columns in a connected database
  with 100% accuracy relative to the actual schema.
- **SC-001a**: An assistant can list all visible databases, roles/users with attributes,
  and permissions with 100% accuracy relative to the catalog, without leaking
  credentials.
- **SC-002**: A read-only query against a result set of 1,000 rows returns complete,
  correctly labeled results within 2 seconds on a standard connection.
- **SC-003**: Queries returning more than the configured limit never return more than
  that limit and always indicate truncation.
- **SC-004**: With write mode disabled, 100% of write attempts are rejected with a clear
  error and no data is mutated.
- **SC-005**: No connection credential, connection string secret, or stack trace appears
  in any tool output across all test scenarios.
- **SC-006**: The server maintains stable behavior under 10 concurrent assistant
  sessions without connection leaks or crashes.

## Assumptions

- The MCP server targets the MCP protocol's standard client expectations (tool call /
  resource pattern) and will comply with the protocol version it declares.
- The initial scope is a single database connection per server process; multi-database
  management is out of scope for v1.
- Read-only operation is the default; write capability is an explicitly enabled,
  opt-in configuration.
- Credentials are provided out-of-band via environment variables or config, never
  committed to the repository.
- Result size limits and timeouts are configurable, with sensible defaults (e.g.,
  limit of 1,000 rows, 30-second query timeout).
- Tool naming follows a documented, consistent convention (e.g., `list_tables`,
  `describe_table`, `list_databases`, `list_roles`, `list_permissions`, `run_query`,
  `run_write_query`) to satisfy the User Experience Consistency principle.
- Discovery tools (databases, roles, permissions) are read-only and reflect only what
  the connected user is permitted to see.
- The project's own codebase stack is chosen during planning; this spec is intentionally
  implementation-agnostic.
