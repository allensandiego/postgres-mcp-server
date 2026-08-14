# Implementation Plan: Postgres MCP Server

**Branch**: `001-postgres-mcp-server` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-postgres-mcp-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Build an MCP server that connects an AI assistant to a single PostgreSQL database. The
server exposes schema, database, role/user, and permissions discovery tools, read-only
query execution, and opt-in safe write operations, returning structured, consistent
results while never leaking credentials. The application is written in TypeScript and is
runnable via `npx` (published package with a CLI entry point).

## Technical Context

**Language/Version**: TypeScript (Node.js runtime, current LTS)

**Primary Dependencies**: `@modelcontextprotocol/server` (MCP SDK v2), `pg`
(node-postgres driver), `zod` (tool input schemas), `pg-format` (identifier escaping).
CLI via the package's `bin` entry. Dev tooling: `tsx`/`typescript`, `vitest`,
`eslint-plugin-pg`. ESM (`"type": "module"`).

**Storage**: External PostgreSQL database (read/write via the connected database; no
embedded storage).

**Testing**: `vitest` for unit tests; integration tests against a disposable PostgreSQL
instance (Dockerized `postgres` image, seeded per run); contract tests via in-memory MCP
`Client` covering tool registration and argument validation.

**Target Platform**: Node.js LTS; published npm package executed via
`npx postgres-mcp-server` (stdio MCP transport).

**Project Type**: MCP server (stdio CLI).

**Performance Goals**: SC-002 — 1,000-row read query returns complete, correctly labeled
results within 2 seconds on a standard connection; bounded memory on large result sets.

**Constraints**: SC-005 — never emit credentials/stack traces; configurable row limit
(default 1,000) and query timeout (default 30s); read-only unless write mode enabled.

**Scale/Scope**: Single database connection per process; supports ~10 concurrent
assistant sessions (SC-006) without connection leaks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code Quality**: TypeScript with strict typing, linting, static analysis; readable
  structure — PASS.
- **Testing Standards**: Unit + integration tests mandatory, run in CI — PASS.
- **User Experience Consistency**: Uniform tool naming (`list_tables`, `describe_table`,
  `list_databases`, `list_roles`, `list_permissions`, `run_query`, `run_write_query`)
  and uniform error shape — PASS.
- **Performance Requirements**: Bounded queries (row limit, timeout), connection
  pooling/release, no unbounded result sets; discovery over catalog queries remains
  bounded — PASS.
- **Engineering & Security**: Parameterized SQL only, no dynamic SQL; credentials never
  committed, logged, or exposed (discovery returns privileges, not passwords);
  dependency pinning — PASS.

No gate violations; no Complexity Tracking required.

*Post-Phase-1 re-check*: Confirmed after design — strict TypeScript, `vitest` unit +
integration + contract tests, uniform tool naming (`list_tables`/`describe_table`/
`list_databases`/`list_roles`/`list_permissions`/`run_query`/`run_write_query`),
parameterized SQL with `eslint-plugin-pg` guard, bounded queries, and env-based secret
handling. Discovery queries read the `pg_catalog`/`information_schema` catalogs and
expose only privileges (never credentials). All gates still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-postgres-mcp-server/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.ts             # CLI entry (bin): parses config, starts stdio server
├── server.ts            # MCP server setup, tool/resource registration
├── config.ts            # Connection + limits + write-mode config
├── db/
│   └── pool.ts          # pg pool, safe connection lifecycle
├── tools/
│   ├── list-tables.ts       # schema discovery
│   ├── describe-table.ts
│   ├── list-databases.ts    # database discovery
│   ├── list-roles.ts        # role/user discovery
│   ├── list-permissions.ts  # permissions discovery
│   ├── run-query.ts         # read-only, bounded, parameterized
│   └── run-write-query.ts   # gated by write mode
└── result.ts            # uniform result + error shaping

tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: Single-package TypeScript project (Option 1). The server is a
self-contained npm package exposing a CLI `bin`, so a flat `src/` + `tests/` layout
matches the single-project default.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. Constitution Check passes with no violations.