import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export interface ServerConfig {
  databaseUrl?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | Record<string, unknown>;
  allowWrite: boolean;
  maxRowLimit: number;
  queryTimeoutMs: number;
  statementTimeoutMs: number;
  maxConnections: number;
}

export function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = typeof process !== "undefined" && process.argv ? process.argv.slice(2) : []
): ServerConfig {
  let cliDatabaseUrl: string | undefined;
  let cliAllowWrite: boolean | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("postgres://") || arg.startsWith("postgresql://")) {
      cliDatabaseUrl = arg;
    } else if (arg.startsWith("--url=") || arg.startsWith("--connection-string=") || arg.startsWith("--database-url=")) {
      cliDatabaseUrl = arg.substring(arg.indexOf("=") + 1);
    } else if ((arg === "--url" || arg === "-u" || arg === "--connection-string") && argv[i + 1]) {
      cliDatabaseUrl = argv[i + 1];
    } else if (arg === "--allow-write" || arg === "--write" || arg === "-w") {
      cliAllowWrite = true;
    } else if (arg.startsWith("--allow-write=")) {
      cliAllowWrite = parseBoolean(arg.substring(arg.indexOf("=") + 1), false);
    }
  }

  const databaseUrl =
    cliDatabaseUrl ||
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_CONNECTION_STRING ||
    env.PG_CONNECTION_STRING ||
    env.DATABASE_URI ||
    env.POSTGRES_URI ||
    env.PGURL ||
    env.PG_URL ||
    undefined;

  const host = env.PGHOST || env.POSTGRES_HOST || undefined;
  const port = env.PGPORT ? parseNumber(env.PGPORT, 5432) : undefined;
  const database = env.PGDATABASE || env.POSTGRES_DB || undefined;
  const user = env.PGUSER || env.POSTGRES_USER || undefined;
  const password = env.PGPASSWORD || env.POSTGRES_PASSWORD || undefined;
  
  const sslMode = env.PGSSLMODE?.toLowerCase();
  const ssl = sslMode === "require" || sslMode === "verify-full" || sslMode === "verify-ca" || parseBoolean(env.PGSSL, false)
    ? { rejectUnauthorized: sslMode === "verify-full" }
    : undefined;

  const allowWrite = cliAllowWrite !== undefined ? cliAllowWrite : parseBoolean(env.ALLOW_WRITE, false);
  const maxRowLimit = parseNumber(env.MAX_ROW_LIMIT || env.ROW_LIMIT, 1000);
  const queryTimeoutMs = parseNumber(env.QUERY_TIMEOUT_MS, 30000);
  const statementTimeoutMs = parseNumber(env.STATEMENT_TIMEOUT_MS, queryTimeoutMs);
  const maxConnections = parseNumber(env.MAX_CONNECTIONS || env.POOL_MAX, 10);

  return {
    databaseUrl,
    host,
    port,
    database,
    user,
    password,
    ssl,
    allowWrite,
    maxRowLimit,
    queryTimeoutMs,
    statementTimeoutMs,
    maxConnections,
  };
}

/**
 * Returns a sanitized summary of configuration safe for logging (no credentials).
 */
export function sanitizeConfig(config: ServerConfig): Record<string, unknown> {
  let sanitizedDb = config.database;
  let sanitizedHost = config.host;
  let sanitizedUser = config.user;
  let sanitizedPort = config.port;

  if (config.databaseUrl) {
    try {
      const parsed = new URL(config.databaseUrl);
      sanitizedHost = parsed.hostname;
      sanitizedUser = parsed.username || undefined;
      sanitizedDb = parsed.pathname.replace(/^\//, "") || undefined;
      if (parsed.port) {
        sanitizedPort = parseInt(parsed.port, 10);
      }
    } catch {
      // If URL parsing fails, omit
    }
  }

  return {
    host: sanitizedHost ?? "localhost",
    port: sanitizedPort ?? 5432,
    database: sanitizedDb ?? "postgres",
    user: sanitizedUser ?? "postgres",
    allowWrite: config.allowWrite,
    maxRowLimit: config.maxRowLimit,
    queryTimeoutMs: config.queryTimeoutMs,
    statementTimeoutMs: config.statementTimeoutMs,
    maxConnections: config.maxConnections,
  };
}
