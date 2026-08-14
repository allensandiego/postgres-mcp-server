---

description: "Task list for postgres-mcp-server feature implementation"
---

# Tasks: Postgres MCP Server

**Input**: Design documents from `/specs/001-postgres-mcp-server/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the project constitution mandates automated tests (unit +
integration + contract) as non-negotiable quality gates.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create npm package structure with ESM `"type": "module"`, `bin` entry
  (`postgres-mcp-server`), and TypeScript config in `package.json` and `tsconfig.json`
- [x] T002 [P] Install runtime dependencies (`@modelcontextprotocol/server`, `pg`,
  `zod`, `pg-format`)
- [x] T003 [P] Install and configure dev tooling: `typescript`, `tsx`, `vitest`,
  `eslint` with `eslint-plugin-pg` (flat config in `eslint.config.js`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement configuration module in `src/config.ts` (parse `DATABASE_URL`,
  `ALLOW_WRITE`, row limit, query/statement timeouts from env with defaults)
- [x] T005 [P] Implement DB connection pool in `src/db/pool.ts` (pg `Pool`, safe
  acquire/release lifecycle, configured timeouts)
- [x] T006 [P] Implement uniform result and error shaping in `src/result.ts`
  (`QueryResult`, `QueryError` with stable codes from `contracts/tools.md`)
- [x] T007 Implement MCP server factory in `src/server.ts` (register tools via
  `McpServer`, wire `serveStdio`, stderr-only logging)
- [x] T008 Implement CLI entry point in `src/index.ts` (bin: load config, build pool,
  start stdio server, graceful shutdown)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Connect and Inspect Schema (Priority: P1) 🎯 MVP

**Goal**: Server connects to the database and exposes schema discovery tools
(`list_tables`, `describe_table`)

**Independent Test**: Connect to a test database, call `list_tables`/`describe_table`,
and confirm the returned schemas/tables/columns match the actual database.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US1] Contract test for `list_tables`/`describe_table` registration and
  argument validation in `tests/contract/schema-discovery.test.ts`
- [x] T010 [P] [US1] Integration test for schema discovery against a disposable seeded
  Postgres in `tests/integration/schema-discovery.test.ts`

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement `list_tables` tool in `src/tools/list-tables.ts`
  (schemas + tables + columns via `information_schema`)
- [x] T012 [P] [US1] Implement `describe_table` tool in `src/tools/describe-table.ts`
  (columns, types, primary key, `table_not_found` handling)
- [x] T013 [US1] Register schema discovery tools in `src/server.ts` with
  `readOnlyHint: true`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Discover Databases, Roles, and Permissions (Priority: P1)

**Goal**: Server exposes catalog discovery tools (`list_databases`, `list_roles`,
`list_permissions`)

**Independent Test**: Define a second role and a grant in a test database, then confirm
`list_databases`, `list_roles`, and `list_permissions` return the expected catalog data
without exposing credentials.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Contract test for `list_databases`/`list_roles`/`list_permissions`
  registration and argument validation in `tests/contract/catalog-discovery.test.ts`
- [x] T015 [P] [US2] Integration test for catalog discovery (roles + grants seeded) in
  `tests/integration/catalog-discovery.test.ts`

### Implementation for User Story 2

- [x] T016 [P] [US2] Implement `list_databases` tool in `src/tools/list-databases.ts`
  (databases visible/connectable to the user via `pg_database`)
- [x] T017 [P] [US2] Implement `list_roles` tool in `src/tools/list-roles.ts`
  (roles/attributes/membership via `pg_roles`/`pg_auth_members`, no secrets)
- [x] T018 [P] [US2] Implement `list_permissions` tool in `src/tools/list-permissions.ts`
  (grants via `information_schema` privilege views / `aclexplode`, `no_access` handling)
- [x] T019 [US2] Register catalog discovery tools in `src/server.ts` with
  `readOnlyHint: true`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Run Read-Only Queries (Priority: P2)

**Goal**: Server executes parameterized, bounded SELECT queries via `run_query`

**Independent Test**: Issue a parameterized SELECT against a seeded test database and
confirm returned rows/column names; confirm truncation at the configured limit.

### Tests for User Story 3 ⚠️

- [x] T020 [P] [US3] Contract test for `run_query` input schema and result/error shape
  in `tests/contract/run-query.test.ts`
- [x] T021 [P] [US3] Integration test for read-only query, pagination, and truncation in
  `tests/integration/run-query.test.ts`

### Implementation for User Story 3

- [x] T022 [US3] Implement `run_query` tool in `src/tools/run-query.ts` (parameterized
  SQL, `limit`/`offset`, truncation flag, `invalid_sql`/`table_not_found` errors)
- [x] T023 [US3] Register `run_query` tool in `src/server.ts` with `readOnlyHint: true`

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Safe Write Operations (Priority: P3)

**Goal**: Server executes writes via `run_write_query`, gated by explicit write mode

**Independent Test**: With `ALLOW_WRITE` unset, confirm a write is rejected
(`write_disabled`, no mutation); with it set, confirm an INSERT persists and returns the
affected row count.

### Tests for User Story 4 ⚠️

- [x] T024 [P] [US4] Contract test for `run_write_query` write-mode gating in
  `tests/contract/run-write-query.test.ts`
- [x] T025 [P] [US4] Integration test for write enabled/disabled behavior against a
  disposable DB in `tests/integration/run-write-query.test.ts`

### Implementation for User Story 4

- [x] T026 [US4] Implement `run_write_query` tool in `src/tools/run-write-query.ts`
  (write-mode gate, parameterized SQL, affected row count)
- [x] T027 [US4] Register `run_write_query` in `src/server.ts` only when `ALLOW_WRITE`
  is enabled (`destructiveHint: true`)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T028 [P] Security hardening: audit that no credential/connection-string/stack
  trace can appear in tool output or logs (FR-008, SC-005)
- [x] T029 [P] Performance verification: 1,000-row query within 2s and 10 concurrent
  sessions without connection leaks (SC-002, SC-006)
- [x] T030 [P] Write `README.md` with install, `npx` run, config env vars, and tool
  documentation
- [x] T031 Run `quickstart.md` validation scenarios end-to-end and confirm expected
  outcomes
- [x] T032 Final review: lint, typecheck, full test suite green (constitution quality gates)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Tools before registration
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Tool implementations within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for list_tables/describe_table in tests/contract/schema-discovery.test.ts"
Task: "Integration test for schema discovery in tests/integration/schema-discovery.test.ts"

# Launch all tools for User Story 1 together:
Task: "Implement list_tables tool in src/tools/list-tables.ts"
Task: "Implement describe_table tool in src/tools/describe-table.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
   - Developer D: User Story 4
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
