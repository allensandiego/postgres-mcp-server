<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: N/A (initial adoption)
- Added sections: Core Principles (Code Quality, Testing Standards, User Experience
  Consistency, Performance Requirements), Engineering & Security Constraints,
  Development Workflow & Review Process, Governance
- Removed sections: N/A
- Deferred TODOs: none
-->

# postgres-mcp-server Constitution

## Core Principles

### I. Code Quality
Every deliverable MUST be readable, maintainable, and free of dead code. Naming MUST be
clear and intention-revealing; structure MUST follow the project's defined conventions.
Linting, formatting, and static analysis MUST pass before any code is committed. Any
complexity beyond the obvious MUST be explicitly justified in the spec or review comments.

### II. Testing Standards
Tests are NON-NEGOTIABLE. All functionality MUST be covered by automated tests written
before or alongside the implementation. Unit tests MUST validate core logic; integration
tests MUST cover database connectivity, MCP protocol behavior, and tool contracts. Tests
MUST run and pass in CI before a feature is accepted. No feature or refactor MAY be
merged with failing or missing tests.

### III. User Experience Consistency
Every tool, resource, and error surfaced through the MCP server MUST follow consistent
naming, shape, and messaging conventions. Tool names MUST be predictable and aligned with
their behavior; error responses MUST use a uniform structure with actionable messages;
success responses MUST be stable and documented. User-facing behavior MUST not change
surprisingly across releases — breaking changes require explicit versioning and notice.

### IV. Performance Requirements
Database operations MUST be efficient and bounded. Queries MUST avoid N+1 patterns, use
indexes as designed, and paginate or limit large result sets. Connection usage MUST be
pooled and released reliably; long-running or heavy operations MUST stream or chunk
output rather than block. Performance budgets and benchmark thresholds, where defined in
a spec, MUST be met and verified before release.

## Engineering & Security Constraints

- Stack and dependencies MUST be declared and pinned; new dependencies MUST be justified
  and reviewed.
- Secrets and connection credentials MUST NEVER be committed, logged, or exposed in tool
  output.
- The server MUST comply with the MCP protocol version it declares; protocol and contract
  changes MUST be versioned explicitly.
- SQL MUST be parameterized to prevent injection; dynamic SQL construction is forbidden.
- Every public tool MUST have documented input/output schema and behavior.

## Development Workflow & Review Process

- All changes MUST go through review before merge; reviewers MUST verify constitution
  compliance explicitly.
- Commits MUST be small, focused, and describe the intent; specs must exist for features
  before implementation begins.
- Quality gates MUST pass in order: tests → lint/static analysis → performance checks.
- Ambiguity in requirements MUST be resolved in the spec, not at implementation time.

## Governance

This constitution supersedes all other development practices. Amendments require
documentation of the change, approval, and a migration plan for existing work. Any
deviation MUST be explicitly documented and justified. The constitution version follows
Semantic Versioning: MAJOR for removals or redefinitions, MINOR for additions or material
expansions, PATCH for clarifications. Compliance MUST be verified during every review and
in the definition of every feature spec.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
