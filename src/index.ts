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
  let isShuttingDown = false;
  const shutdown = async (trigger: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.error(`Received ${trigger}, shutting down...`);

    // Force exit after a short timeout so shutdown never blocks the client
    const forceTimer = setTimeout(() => {
      process.exit(0);
    }, 500);
    forceTimer.unref();

    try {
      await server.close();
    } catch (err: any) {
      console.error("Error closing server:", err?.message);
    }

    try {
      await pool.close();
    } catch (err: any) {
      console.error("Error closing database pool:", err?.message);
    }

    console.error("Server stopped cleanly.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  // Handle stdin stream close/end (crucial when parent process disconnects)
  process.stdin.on("close", () => shutdown("stdin close"));
  process.stdin.on("end", () => shutdown("stdin end"));
  if (transport.onclose !== undefined) {
    transport.onclose = () => shutdown("transport close");
  }

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
