# Changelog

All notable changes to `@gwdn/nexus-mcp` are documented in this file.

## [0.10.1] — 2026-07-08

### Fixed

- **`task_note` — `Database operation failed` bug** — `task_notes.actor` is a `UUID` foreign key referencing `auth.users(id)`. The previous implementation passed `displayName` or `email` as the actor value, which are not UUIDs and violated the FK constraint. Now uses `identity.userId` exclusively.

### Added

- **`task_delete`** — Hard-delete a task by UUID. Project access is verified before deletion. Use for cleanup of erroneous or duplicate tasks.

### Changed

- **`task_update`** — `status` is now optional (was required). New optional fields: `title` (max 500 chars) and `description` (max 100k chars, nullable to clear). At least one field must be provided. Enum guards added for `status` and `priority`.
- Tool count: 60 → 61

### Backend

- `nexus-hub` commit `b648744` — `/api/mcp/tasks` route updated
- `nexus-hub` commit `cfafac0` — `/api/mcp/projects/:id/preflight` multi-agent aggregation fix
- `nexus-hub` commit `37c2164` — new `/api/mcp/projects/:id/preflight` endpoint with PAT auth

---

## [0.10.0] — 2026-07-08

### Release

- Tag `v0.10.0` applied to `main` at commit `4b6429c` (test fixture update for tool count 61)
- No functional changes relative to `0.9.0` beyond the test fix — `v0.10.1` carries the actual feature delta

---

## [0.9.0] — 2026-06-26

### Added

- **Nexus Dispatch tools (12 new `dispatch_*` tools)** — ADR-0052
  - `dispatch_create` — Create a routed Dispatch with actor resolution and project-link gate
  - `dispatch_reply` — Append reply or timeline entry with optional status transition
  - `dispatch_inbox` — List Dispatches addressed to a project (scope: blocking/waiting_on_me/cross_project)
  - `dispatch_outbox` — List Dispatches created by a project
  - `dispatch_ack` — Acknowledge an open Dispatch (open → acknowledged)
  - `dispatch_assign` — Assign/reassign to an actor via project registry
  - `dispatch_forward` — Forward to another actor or linked project
  - `dispatch_resolve` — Mark as resolved with optional resolution note
  - `dispatch_close` — Close a resolved Dispatch (terminal)
  - `dispatch_sweep` — Session-start prioritized overview (blocking, overdue, waiting_on_me, new_assignments)
  - `dispatch_get` — Full Dispatch with append-only timeline and participants
  - `dispatch_related` — Find structurally related Dispatches (loop prevention)
- **Legacy `vl_*` aliases updated** — `vl_create`, `vl_reply`, `vl_inbox`, `vl_outbox`, `vl_ack` now delegate to the new `dispatch_*` implementation via `/api/mcp/dispatches`
- **Test suite expanded** — 154 tests (was 127). New `dispatches.test.ts` covers all 12 dispatch tools + all 5 vl_* compat aliases
- **Public release** — Apache-2.0 license, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, contact emails at `post+*@gatewarden.eu`
- **README** — Full tool inventory (4 layers, 60 tools), architecture diagram, environment variables, project structure

### Changed

- Tool count: 48 → 60
- Layer 2 "Vault Letters" renamed to "Nexus Dispatch" in documentation and tool descriptions
- `vl_*` tools now route to `/api/mcp/dispatches` instead of `/api/mcp/letters`

### Compatibility

- All `vl_*` tools remain fully functional as compatibility aliases
- No breaking changes to existing agent configurations

---

## [0.8.11] — 2026-06-21

- Bump version for release tracking
- Session metadata enrichment: X-Nexus-Model and X-Nexus-Toolstack request headers

## [0.8.10] — 2026-06-19

- Agent file sync tools (af_*)
- Project directives tools (pd_*, directive_export)
- Session entry enrichment with machine_id

## [0.8.5] — 2026-05-30

- Token usage tracking via nexus-cost-control
- Reviews layer (rv_create, rv_get, rv_list, rv_decide, rv_comment)
- Skills management tools (sk_list, sk_get, sk_create, sk_update, sk_activate, sk_assign, sk_unassign, sk_export)

## [0.8.0] — 2026-04-25

- Initial public release on npm
- 38 tools across 4 layers
- Bearer token authentication via nxs_pat_* tokens
