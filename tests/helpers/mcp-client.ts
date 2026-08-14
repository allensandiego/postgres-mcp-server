import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ServerConfig } from "../../src/config.js";
import { DatabasePool } from "../../src/db/pool.js";
import { createPostgresMcpServer } from "../../src/server.js";

export interface TestMcpEnvironment {
  client: Client;
  server: any;
  pool: DatabasePool;
  close: () => Promise<void>;
}

export async function createTestMcpClient(
  config: Partial<ServerConfig> = {},
  customPool?: DatabasePool
): Promise<TestMcpEnvironment> {
  const fullConfig: ServerConfig = {
    allowWrite: false,
    maxRowLimit: 1000,
    queryTimeoutMs: 30000,
    statementTimeoutMs: 30000,
    maxConnections: 10,
    ...config,
  };

  const { server, pool } = createPostgresMcpServer(fullConfig, customPool);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    server,
    pool,
    close: async () => {
      await client.close();
      await server.close();
      await pool.close();
    },
  };
}
