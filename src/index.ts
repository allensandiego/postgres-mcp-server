#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, sanitizeConfig } from "./config.js";
import { createPostgresMcpServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const sanitized = sanitizeConfig(config);

  console.error("Starting postgres-mcp-server with configuration:", JSON.stringify(sanitized, null, 2));

  const { server, pool } = createPostgresMcpServer(config);

  // Test DB connection asynchronously in background (do not block server start)
  pool
    .testConnection()
    .then((status) => {
      if (status.ok) {
        console.error("Connected successfully to PostgreSQL database.");
      } else {
        console.error("PostgreSQL connection check failed:", status.error);
      }
    })
    .catch((err) => {
      console.error("PostgreSQL connection error:", err.message);
    });

  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.error(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      await pool.close();
      console.error("Server stopped cleanly.");
      process.exit(0);
    } catch (err: any) {
      console.error("Error during shutdown:", err.message);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason instanceof Error ? reason.message : String(reason));
  });

  await server.connect(transport);
  console.error("Postgres MCP Server is listening on stdio.");
}

main().catch((err) => {
  console.error("Fatal error starting server:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
