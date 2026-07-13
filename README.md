# Nexus MCP

[![npm](https://img.shields.io/npm/v/@gwdn/nexus-mcp)](https://www.npmjs.com/package/@gwdn/nexus-mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/node-20%2B-green.svg)](https://nodejs.org)

MCP server for the [Gatewarden Nexus](https://nexus.gatewarden.eu) platform. Provides the mediation layer between local agent runtimes and the Nexus HTTP API via the [Model Context Protocol](https://modelcontextprotocol.io) (stdio transport).

## Install

```bash
npx @gwdn/nexus-mcp
```

Or add to your agent's MCP configuration (OpenCode, Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["-y", "@gwdn/nexus-mcp@latest"],
      "env": {
        "NEXUS_API_URL": "https://nexus.gatewarden.eu",
        "NEXUS_PRIVATE_TOKEN": "nxs_pat_..."
      }
    }
  }
}
```

## Architecture

The server exposes 62 tools across 4 layers. All data access goes through the Nexus HTTP API -- the MCP server has no direct database access.

```
Agent Runtime (OpenCode, Claude, Cursor, ...)
    |
    |  stdio (MCP protocol)
    v
nexus-mcp (this package)
    |
    |  HTTPS (Bearer token auth)
    v
Nexus API (nexus.gatewarden.eu)
    |
    v
Supabase (PostgreSQL + RLS)
```

### Layer 1 -- Knowledge Access (5 tools)

| Tool | Description |
|------|-------------|
| `kb_search` | Full-text, semantic, or hybrid search across project entities |
| `kb_memory` | Structured project memory snapshot (ADRs, tasks, sessions, letters) |
| `kb_get` | Retrieve a specific entity by type and ID |
| `kb_related` | Find entities related to a given entity |
| `project_list` | List accessible projects |

### Layer 2 -- Coordination (24 tools)

| Group | Tools |
|-------|-------|
| **Projects** | `project_update` |
| **Sessions** | `session_create`, `session_close`, `session_list`, `session_append` |
| **Tasks** | `task_create`, `task_update`, `task_note`, `task_delete`, `task_list` |
| **Vault Letters** | `vl_create`, `vl_reply`, `vl_inbox`, `vl_outbox`, `vl_ack` |
| **Documents** | `doc_ingest`, `doc_list`, `doc_classify`, `doc_update`, `doc_delete` |
| **Skills** | `sk_list`, `sk_get`, `sk_create`, `sk_update`, `sk_activate`, `sk_assign`, `sk_unassign`, `sk_export` |
| **Decision Comments** | `dc_add`, `dc_list` |
| **Directives** | `pd_list`, `pd_get`, `pd_create`, `pd_update`, `pd_delete`, `pd_toggle`, `directive_export` |

### Layer 3 -- Governance (3 tools)

| Tool | Description |
|------|-------------|
| `adr_create` | Create a new ADR in draft status |
| `adr_submit` | Submit a draft ADR for review |
| `adr_decide` | Accept or reject an ADR under review |

### Layer 4 -- Reviews (5 tools)

| Tool | Description |
|------|-------------|
| `rv_list` | List reviews with optional filters |
| `rv_get` | Get review details by ID or entity |
| `rv_create` | Create a new review for a skill or agent |
| `rv_decide` | Transition a review state (submit, accept, reject, ...) |
| `rv_comment` | Add a comment to a review |

## Authentication

Identity is resolved once at startup via `GET /api/mcp/identity` using the
`NEXUS_PRIVATE_TOKEN` as a Bearer token. All subsequent API calls use the same
token for authentication. The Nexus backend resolves the token to a user
identity and enforces project-scoped RBAC.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXUS_API_URL` | yes | Nexus API base URL (e.g. `https://nexus.gatewarden.eu`) |
| `NEXUS_PRIVATE_TOKEN` | yes | `nxs_pat_*` API token for identity resolution |
| `NEXUS_MODEL` | no | Model identifier for session metadata enrichment |
| `NEXUS_TOOLSTACK` | no | Toolstack identifier (e.g. `opencode`, `claude-code`) |
| `NEXUS_SEC_OPENAI_API_KEY` | no | OpenAI API key for semantic search embeddings |

## Development

```bash
npm install
npm run typecheck   # TypeScript check
npm test            # Run tests (159 unit + 34 E2E)
npm run build       # Compile to dist/
npm run dev         # Run via tsx (development)
npm start           # Run compiled JS (production)
```

## Project Structure

```
nexus-mcp/
├── src/
│   ├── server.ts          # MCP server entry point (stdio transport)
│   ├── auth.ts            # Token-based identity resolution via Nexus API
│   ├── nexus-api.ts       # HTTP client for Nexus API (nexusGet, nexusPost)
│   ├── machine-id.ts      # Machine identification for session metadata
│   ├── tools/             # 24 tool modules (38 tools total)
│   └── __tests__/         # 12 test files (127 unit + 34 E2E)
├── LICENSE                # Apache-2.0
├── SECURITY.md            # Security policy
├── CONTRIBUTING.md        # Contribution guidelines
└── CODE_OF_CONDUCT.md     # Contributor Covenant
```

## Known Issues

### npx cache prevents version upgrade

When using `npx` to run the MCP server, npm caches the resolved package in
`~/.npm/_npx/`. Subsequent invocations may continue to use the cached
(outdated) version even after a new release is published.

**Symptoms:** MCP tools report an older version, or new tools/fixes are missing.

**Fix:** Clear all npx caches for this package before starting your agent:

```bash
find ~/.npm/_npx -path "*/node_modules/@gwdn/nexus-mcp" -type d \
  -exec rm -rf {} + 2>/dev/null
```

> **Tip:** Pin `@latest` in your MCP config args to always resolve the newest version:
> `["--yes", "@gwdn/nexus-mcp@latest"]`

## Related

- [Gatewarden Nexus](https://nexus.gatewarden.eu) -- Platform (Next.js / Supabase)
- [nexus-cli](https://github.com/gwnexus/nexus-cli) -- Workspace CLI (Rust)
- [nexus-link](https://github.com/gwnexus/nexus-link) -- Hardware agent (Rust)

## License

[Apache-2.0](LICENSE) -- Copyright (c) 2026 RelicFrog Holding UG (haftungsbeschraenkt)
