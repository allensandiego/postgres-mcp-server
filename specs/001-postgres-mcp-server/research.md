# Research: Postgres MCP Server

Phase 0 output for `/specs/001-postgres-mcp-server`. Resolves the Technical Context
decisions in [plan.md](./plan.md). No `[NEEDS CLARIFICATION]` markers remained in the
spec; all decisions below were validated against current ecosystem practice.

## 1. MCP Server Framework

- **Decision**: Official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), using
  `McpServer`, `registerTool`, and `serveStdio` (stdio transport). Zod for tool
  `inputSchema`.
- **Rationale**: The SDK is the canonical implementation of the MCP protocol for
  TypeScript. `registerTool` derives the JSON Schema the client sees from a single Zod
  schema, validates arguments before handlers run, and infers handler argument types.
  `serveStdio` owns the stdio transport and supports both legacy (2025-era) and modern
  (2026-07-28) protocol revisions from one factory. stdout is the protocol channel;
  logging must go to `console.error`.
- **Alternatives considered**: Hand-rolled JSON-RPC over stdio (too much protocol
  surface to reimplement); `@modelcontextprotocol/sdk` v1 (superseded; v2 package split
  `@modelcontextprotocol/server` is the current path).

## 2. PostgreSQL Driver & SQL Safety

- **Decision**: `pg` (node-postgres) `Pool`. Parameterized queries only — `$1`, `$2`
  placeholders with a values array. Identifier quoting via `pg-format` (`%I`) when
  dynamic identifiers are unavoidable. Row limit + `query_timeout` / `statement_timeout`
  enforced at the pool and query level.
- **Rationale**: `pg` is the de facto Node/Postgres driver with built-in pooling and
  TypeScript types. Parameterized queries are the only injection-safe pattern; values
  travel out-of-band so they can never change statement structure. Postgres cannot bind
  identifiers as parameters, so dynamic identifiers require `%I` escaping or an
  allow-list. Connection release in `finally` (or `pool.query` for one-shot queries)
  prevents pool exhaustion (CWE-404).
- **Alternatives considered**: Prisma/Drizzle ORMs (unnecessary abstraction for a thin
  SQL-facing MCP server); `pg-promise` (adds wrapper complexity without clear benefit);
  `eslint-plugin-pg` adopted as a lint layer to catch injection/leak shapes in CI.

## 3. Packaging & npx Execution

- **Decision**: Publish as an npm package with a `bin` entry pointing to the compiled
  entry (`postgres-mcp-server`). Distribute via npm registry so `npx postgres-mcp-server`
  works; `tsx` used for local development; a build step compiles to JS for publishing.
- **Rationale**: `npx` runs the package's `bin` if the package is published and the
  binary name resolves. The MCP Inspector launches a server command itself
  (`npx @modelcontextprotocol/inspector npx tsx src/index.ts`), which validates the
  stdio contract without a host. ESM (`"type": "module"`) is required by the SDK.
- **Alternatives considered**: Direct `node` invocation (requires manual dependency
  resolution); shipping only source + `tsx` (adds startup overhead and a runtime
  dependency); global install (npx is the requested and standard path).

## 4. Configuration & Secrets

- **Decision**: Connection details via environment variables (`DATABASE_URL` or
  discrete `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`). Write mode is an
  explicit opt-in env flag (e.g., `ALLOW_WRITE=1`). Limits/timeouts configurable via env
  with defaults (row limit 1,000, query timeout 30s).
- **Rationale**: Environment variables keep credentials out of source (satisfies SC-005
  and the constitution's "secrets never committed"). Opt-in write mode satisfies the
  spec's default-read-only requirement (FR-006, SC-004).
- **Alternatives considered**: CLI flags for credentials (visible in process lists);
  config files committed to repo (risk of secret leakage).

## 5. Testing Strategy

- **Decision**: `vitest` for unit tests; integration tests against a disposable Postgres
  instance (Dockerized `postgres` image) seeded per test run. Contract tests exercise
  tool registration and argument validation through an in-memory MCP `Client`.
- **Rationale**: Integration coverage of DB connectivity, tool contracts, and the
  write-mode gate matches the constitution's Testing Standards (unit + integration +
  MCP protocol behavior). An isolated disposable DB makes write tests safe.
- **Alternatives considered**: Only unit tests (miss protocol/DB behavior); real
  persistent dev DB (nondeterministic, unsafe for write tests).

## 6. Discovery (Databases, Roles, Permissions)

- **Decision**: Implement discovery as read-only tools backed by catalog queries
  (`pg_catalog` / `information_schema`):
  - Databases: `pg_database` (filtered by `has_database_privilege` / connection access).
  - Roles/users: `pg_roles` / `pg_auth_members` for attributes and group membership.
  - Permissions: `information_schema` privilege views (`table_privileges`,
    `schema_privileges`, `column_privileges`) plus `aclexplode` for ACL detail.
  - Access scoped to what the connected user can actually see (catalog visibility rules).
- **Rationale**: Postgres exposes this metadata natively via catalog/system views; using
  them keeps discovery accurate and avoids maintaining a shadow model. Read-only catalog
  queries satisfy the default-read-only posture. Exposing privileges (grants) is safe
  because it reveals authorization metadata, not secrets/passwords.
- **Alternatives considered**: Querying `pg_database`/`pg_roles` unfiltered (may expose
  objects the user cannot see / risks leaking unrelated catalog detail); maintaining an
  external registry (diverges from the live database). Filtering by the connected user's
  privileges is chosen to match SC-001a and FR-002a/b/c.