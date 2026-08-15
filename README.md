# Postgres MCP Server

A Model Context Protocol (MCP) server for PostgreSQL databases. Connects AI assistants (Claude Desktop, Cursor, Antigravity, etc.) to a PostgreSQL database with schema discovery, catalog introspection, read-only analytical queries, and opt-in safe write operations.

## Features

- **Schema Discovery**: Inspect schemas, tables, views, column data types, primary keys, and uniqueness constraints (`list_tables`, `describe_table`).
- **Catalog & Governance Discovery**: Discover visible databases, roles with attributes and memberships, and permissions across schemas, tables, and columns (`list_databases`, `list_roles`, `list_permissions`).
- **Bounded Read Queries**: Run parameterized SQL queries with pagination (`limit`, `offset`), strict maximum row limits, and automatic truncation detection (`run_query`).
- **Gated Safe Writes**: Write operations (`run_write_query` for INSERT, UPDATE, DELETE, DDL) are disabled by default and require explicit `ALLOW_WRITE=1` configuration.
- **Security & Privacy First**: Zero credential leakage. Connection strings, passwords, and internal stack traces are redacted from logs and tool responses. Parameterized SQL prevents SQL injection.
- **Stdio Transport**: Seamlessly runs over stdio conforming to standard MCP protocol clients.

---

## Quick Start

### Running via NPX

Pass the connection string directly as a command-line argument or via environment variable:

```bash
# Read-only mode (default)
npx @allensandiego/postgres-mcp-server postgres://user:password@localhost:5432/mydb

# Enable write mode via CLI flag
npx @allensandiego/postgres-mcp-server postgres://user:password@localhost:5432/mydb --allow-write

# Or configure via environment variables
export DATABASE_URL="postgres://user:password@localhost:5432/mydb"
export ALLOW_WRITE=1   # Optional: enable write queries
npx @allensandiego/postgres-mcp-server
```

### Global Installation

```bash
npm install -g @allensandiego/postgres-mcp-server

# Run read-only
postgres-mcp-server postgres://user:password@localhost:5432/mydb

# Run with write operations enabled
postgres-mcp-server postgres://user:password@localhost:5432/mydb --allow-write
```

### Local Development

```bash
# Clone and install dependencies
git clone https://github.com/allensandiego/postgres-mcp-server.git
cd postgres-mcp-server
npm install

# Build
npm run build

# Run with tsx in development
npm run dev -- postgres://user:password@localhost:5432/mydb --allow-write
```

---

## Configuration

The server can be configured via CLI flags or environment variables:

### Connection String

You can provide the connection string in any of the following ways (in order of precedence):
1. **CLI Positional Argument**: `postgres-mcp-server postgres://user:password@host:port/db`
2. **CLI Option**: `postgres-mcp-server --url=postgres://...` or `--connection-string=...`
3. **Environment Variables**: `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_CONNECTION_STRING`, `PG_CONNECTION_STRING`, `DATABASE_URI`, `POSTGRES_URI`, `PGURL`, or `PG_URL`

### Enabling Write Operations (`ALLOW_WRITE`)

By default, the server runs in **read-only mode** (`run_write_query` will reject any destructive or mutating SQL).
To enable write queries (INSERT, UPDATE, DELETE, CREATE, DROP, ALTER):
- **Via CLI flag**: Pass `--allow-write`, `--write`, or `-w`
- **Via Environment Variable**: Set `ALLOW_WRITE=1` (or `ALLOW_WRITE=true`)

### Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_CONNECTION_STRING` | Full PostgreSQL connection URI (`postgres://user:pass@host:port/db`) | None |
| `ALLOW_WRITE` | Enables write queries (`1`, `true`, `yes`, `on`) | `false` (Read-only) |
| `PGHOST` / `POSTGRES_HOST` | Database host name | `localhost` |
| `PGPORT` | Database port number | `5432` |
| `PGDATABASE` / `POSTGRES_DB` | Database name | `postgres` |
| `PGUSER` / `POSTGRES_USER` | Database user name | `postgres` |
| `PGPASSWORD` / `POSTGRES_PASSWORD` | Database password | None |
| `PGSSLMODE` / `PGSSL` | SSL configuration mode (`require`, `verify-full`, etc.) | Disabled |
| `MAX_ROW_LIMIT` / `ROW_LIMIT` | Maximum rows returned per query | `1000` |
| `QUERY_TIMEOUT_MS` | Per-query timeout in milliseconds | `30000` (30s) |
| `MAX_CONNECTIONS` / `POOL_MAX` | Maximum active database connections in pool | `10` |

---

## MCP Tools Reference

### 1. `list_tables`
Discover all user schemas and their tables/views and columns without writing SQL.
- **Arguments**:
  - `schema` *(optional string)*: Filter tables by schema name (e.g. `"public"`).
- **Output**: Array of `{ schema, name, type, columns: [{ name, dataType, nullable, isPrimaryKey, isUnique }] }`.

### 2. `describe_table`
Retrieve detailed column specifications and primary key definitions for a table.
- **Arguments**:
  - `schema` *(required string)*: Schema name (e.g. `"public"`).
  - `table` *(required string)*: Table name (e.g. `"users"`).
- **Output**: `{ schema, table, columns: [...], primaryKey?: string }`.

### 3. `list_databases`
Discover databases visible and connectable to the connected user.
- **Arguments**: None.
- **Output**: Array of `{ name, owner, encoding, isTemplate, connectable }`.

### 4. `list_roles`
Discover roles/users, their administrative attributes, and group memberships.
- **Arguments**: None.
- **Output**: Array of `{ name, superuser, canLogin, canCreateDb, canCreateRole, canBypassRls, memberOf, members }`.

### 5. `list_permissions`
Discover granted privileges across schemas, tables, and columns.
- **Arguments**:
  - `objectType` *(optional string)*: `"schema"`, `"table"`, or `"column"`.
  - `schema` *(optional string)*: Schema name filter.
  - `table` *(optional string)*: Table name filter.
- **Output**: Array of `{ grantor, grantee, objectType, objectName, privilege, grantable }`.

### 6. `run_query`
Execute a read-only parameterized `SELECT` query.
- **Arguments**:
  - `sql` *(required string)*: Parameterized SQL statement (e.g. `"SELECT * FROM orders WHERE status = $1"`).
  - `params` *(optional array)*: Parameter substitution values.
  - `limit` *(optional integer)*: Page limit (capped at `MAX_ROW_LIMIT`).
  - `offset` *(optional integer)*: Page offset for pagination.
- **Output**: `{ columns, rows, rowCount, truncated }`.

### 7. `run_write_query`
Execute modifying SQL statements (INSERT, UPDATE, DELETE, DDL). Only active when `ALLOW_WRITE=1` or `--allow-write` is provided.
- **Arguments**:
  - `sql` *(required string)*: SQL write statement.
  - `params` *(optional array)*: Parameter values.
- **Output**: `{ rowCount }`.

---

## MCP Client Setup Examples

### Gemini CLI Configuration (`mcp_config.json` or `settings.json`)

**Read-only mode (Default)**:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@allensandiego/postgres-mcp-server@latest",
        "postgres://username:password@localhost:5432/mydb"
      ]
    }
  }
}
```

**Write-enabled mode**:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@allensandiego/postgres-mcp-server@latest",
        "postgres://username:password@localhost:5432/mydb",
        "--allow-write"
      ]
    }
  }
}
```

*Or via environment variables:*
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@allensandiego/postgres-mcp-server@latest"],
      "env": {
        "DATABASE_URL": "postgres://username:password@localhost:5432/mydb",
        "ALLOW_WRITE": "1"
      }
    }
  }
}
```

### Claude Desktop Configuration (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@allensandiego/postgres-mcp-server@latest",
        "postgres://username:password@localhost:5432/mydb"
      ],
      "env": {
        "ALLOW_WRITE": "0"
      }
    }
  }
}
```

### Antigravity / Cursor Configuration

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@allensandiego/postgres-mcp-server@latest",
        "postgres://username:password@localhost:5432/mydb"
      ],
      "env": {
        "ALLOW_WRITE": "1"
      }
    }
  }
}
```

---

## Testing & Quality Gates

Run the automated test suite (unit + contract + integration tests):

```bash
npm test
```

Type checking:

```bash
npm run typecheck
```

Linting:

```bash
npm run lint
```

---

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md) - free for personal, educational, research, and non-commercial open-source use. Commercial use requires a commercial license.
