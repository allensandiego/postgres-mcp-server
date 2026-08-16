import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ServerConfig } from "./config.js";
import { DatabasePool, createDatabasePool } from "./db/pool.js";
import { classifyError, formatErrorResponse, formatSuccessResponse } from "./result.js";
import { describeTable, describeTableSchema } from "./tools/describe-table.js";
import { listDatabases, listDatabasesSchema } from "./tools/list-databases.js";
import { listPermissions, listPermissionsSchema } from "./tools/list-permissions.js";
import { listRoles, listRolesSchema } from "./tools/list-roles.js";
import { listTables, listTablesSchema } from "./tools/list-tables.js";
import { runQuery, runQuerySchema } from "./tools/run-query.js";
import { runWriteQuery, runWriteQuerySchema } from "./tools/run-write-query.js";
import { setRole, setRoleSchema } from "./tools/set-role.js";

export interface McpServerContext {
  server: McpServer;
  pool: DatabasePool;
}

export function createPostgresMcpServer(
  config: ServerConfig,
  customPool?: DatabasePool
): McpServerContext {
  const pool = customPool || createDatabasePool(config);

  const server = new McpServer(
    {
      name: "postgres-mcp-server",
      version: "0.1.4",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // 1. list_tables (User Story 1 - P1)
  server.registerTool(
    "list_tables",
    {
      description: "Discover schemas and their tables/columns without writing a query (FR-002)",
      inputSchema: listTablesSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const tables = await listTables(pool, args);
        return formatSuccessResponse(tables);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 2. describe_table (User Story 1 - P1)
  server.registerTool(
    "describe_table",
    {
      description: "Detail the columns, types, and primary keys of a specific table (FR-002)",
      inputSchema: describeTableSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const table = await describeTable(pool, args);
        return formatSuccessResponse(table);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 3. list_databases (User Story 2 - P1)
  server.registerTool(
    "list_databases",
    {
      description: "Discover databases visible/connectable to the connected user (FR-002a)",
      inputSchema: listDatabasesSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const databases = await listDatabases(pool);
        return formatSuccessResponse(databases);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 4. list_roles (User Story 2 - P1)
  server.registerTool(
    "list_roles",
    {
      description: "Discover roles/users and their attributes and memberships (FR-002b)",
      inputSchema: listRolesSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const roles = await listRoles(pool);
        return formatSuccessResponse(roles);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 5. list_permissions (User Story 2 - P1)
  server.registerTool(
    "list_permissions",
    {
      description: "Discover privileges granted to roles on schemas, tables, and columns (FR-002c)",
      inputSchema: listPermissionsSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const permissions = await listPermissions(pool, args);
        return formatSuccessResponse(permissions);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 6. run_query (User Story 3 - P2)
  server.registerTool(
    "run_query",
    {
      description: "Execute a read-only SELECT query and return structured rows (FR-003)",
      inputSchema: runQuerySchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const result = await runQuery(pool, args);
        return formatSuccessResponse(result);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 7. run_write_query (User Story 4 - P3)
  server.registerTool(
    "run_write_query",
    {
      description: "Execute INSERT/UPDATE/DELETE/DDL statements when write mode is enabled (FR-006)",
      inputSchema: runWriteQuerySchema,
      annotations: {
        destructiveHint: true,
      },
    },
    async (args) => {
      try {
        const result = await runWriteQuery(pool, args);
        return formatSuccessResponse(result);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  // 8. set_role (SET ROLE)
  server.registerTool(
    "set_role",
    {
      description: "Set active PostgreSQL role/user for the session (SET ROLE) or reset to default (RESET ROLE)",
      inputSchema: setRoleSchema,
      annotations: {
        readOnlyHint: false,
      },
    },
    async (args) => {
      try {
        const result = await setRole(pool, args);
        return formatSuccessResponse(result);
      } catch (err) {
        return formatErrorResponse(classifyError(err));
      }
    }
  );

  return { server, pool };
}
