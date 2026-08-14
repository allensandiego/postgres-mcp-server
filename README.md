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

```bash
# Set your connection string
export DATABASE_URL="postgres://user:password@localhost:5432/mydb"

# Optional: enable write mode
# export ALLOW_WRITE=1

# Start the server
npx postgres-mcp-server
```

### Local Development

```bash
# Clone and install dependencies
git clone https://github.com/your-org/postgres-mcp-server.git
cd postgres-mcp-server
npm install

# Build
npm run build

# Run with tsx in development
npm run dev
```

---

## Configuration

Configure the server using environment variables:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Full PostgreSQL connection URI (`postgres://user:pass@host:port/db`) | None |
| `PGHOST` / `POSTGRES_HOST` | Database host name | `localhost` |
| `PGPORT` | Database port number | `5432` |
| `PGDATABASE` / `POSTGRES_DB` | Database name | `postgres` |
| `PGUSER` / `POSTGRES_USER` | Database user name | `postgres` |
| `PGPASSWORD` / `POSTGRES_PASSWORD` | Database password | None |
| `PGSSLMODE` / `PGSSL` | SSL configuration mode (`require`, `verify-full`, etc.) | Disabled |
| `ALLOW_WRITE` | Enables write queries (`1`, `true`, `yes`) | `false` (Read-only) |
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
Execute modifying SQL statements (INSERT, UPDATE, DELETE, DDL). Only active when `ALLOW_WRITE=1`.
- **Arguments**:
  - `sql` *(required string)*: SQL write statement.
  - `params` *(optional array)*: Parameter values.
- **Output**: `{ rowCount }`.

---

## MCP Client Setup Examples

### Claude Desktop Configuration (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgres://username:password@localhost:5432/mydb",
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
      "args": ["postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgres://username:password@localhost:5432/mydb"
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
