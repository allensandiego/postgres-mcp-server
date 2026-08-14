# Quickstart: Postgres MCP Server

End-to-end validation guide for `/specs/001-postgres-mcp-server`. This is a run guide —
implementation details live in `tasks.md` and the implementation phase.

## Prerequisites

- Node.js LTS and npm.
- A reachable PostgreSQL instance (local or via Docker: `docker run -d --name pgtest
  -e POSTGRES_PASSWORD=test -p 5432:5432 postgres`).
- Package published or runnable locally (see Setup).

## Setup

```bash
# Local development install
npm install
npm run build

# Configure connection (env vars; never committed)
export DATABASE_URL="postgres://postgres:test@localhost:5432/postgres"
# Optional: enable writes
# export ALLOW_WRITE=1
```

Seed a small table for read tests:

```bash
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS items (id serial PRIMARY KEY, name text);"
psql "$DATABASE_URL" -c "INSERT INTO items (name) SELECT 'item-'||g FROM generate_series(1,50) g;"
```

## Run / Test

Start the server over stdio and exercise it via the MCP Inspector:

```bash
# Via npx (published package)
npx postgres-mcp-server
# OR locally
npx tsx src/index.ts

# Inspect + call tools without a host
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Automated test suite (unit + integration + contract):

```bash
npm test
```

## Validation Scenarios

| Scenario | Command / Action | Expected Outcome |
|----------|------------------|------------------|
| Schema discovery (P1) | Call `list_tables` | Returns `items` table with its columns; empty list if DB has no user tables |
| Read query (P2) | Call `run_query` with `SELECT * FROM items WHERE id = $1` | Returns the matching row with column names |
| Truncation (P2/FR-004) | Call `run_query` with 5,000-row query, no `limit` | Returns ≤ configured max and `truncated: true` |
| Bad table (P2) | Call `run_query` on non-existent table | Structured error `table_not_found`, no partial data |
| Database discovery | Call `list_databases` | Returns the databases the connected user can see/connect to |
| Role discovery | Create a second role, call `list_roles` | Returns each role with attributes and memberships, no secrets |
| Permissions discovery | `GRANT SELECT ON items TO <role>`, call `list_permissions` | Returns the grant by role/object; no credentials |
| Write disabled (P3) | Call `run_write_query` with `ALLOW_WRITE` unset | `isError: true`, code `write_disabled`, no mutation |
| Write enabled (P3) | Set `ALLOW_WRITE=1`, run `INSERT` | Row persists; returns affected `rowCount` |
| Secret safety (SC-005) | Trigger any error | No credential/connection-string/stack trace in output |

## Artifacts

- Tool contracts and error codes: [contracts/tools.md](./contracts/tools.md)
- Entity/validation details: [data-model.md](./data-model.md)
- Tech decisions: [research.md](./research.md)