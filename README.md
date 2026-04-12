# nexus-mcp

MCP server for the mpowr-nexus platform. Provides the mediation layer between
local agent runtimes (terminals) and the Nexus HTTP API.

## Architecture

The server exposes 27 tools across 3 layers via the Model Context Protocol
(stdio transport). All data access goes through the Nexus API — the MCP server
has no direct database access.

- **Layer 1 — Knowledge Access:** search_knowledge, get_project_memory,
  get_document, get_related_entities
- **Layer 2 — Coordination:** vault letters (create/reply/inbox/outbox/acknowledge),
  tasks (create/update/add_note), sessions (create/list/close/append_entry),
  decision comments, document ingestion, skills (list/get/create/update/activate)
- **Layer 3 — Governance:** ADR lifecycle (create/submit_review/record_decision),
  decision comments (add/list)

## Authentication

Identity is resolved once at startup via `GET /api/mcp/identity` using the
`NEXUS_PRIVATE_TOKEN` as a Bearer token. All subsequent API calls use the same
token for authentication. The Nexus backend resolves the token to a user
identity and enforces project-scoped RBAC.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXUS_API_URL` | yes | Nexus API base URL (e.g. `https://nexus.mpowr.tech`) |
| `NEXUS_PRIVATE_TOKEN` | yes | nxs_pat_* API token for identity resolution |

## Development

```bash
npm install
npm run typecheck   # TypeScript check
npm test            # Run tests
npm run build       # Compile to dist/
npm run dev         # Run via tsx (development)
npm start           # Run compiled JS (production)
```

## Project Structure

```
src/
  server.ts          # MCP server entry point (stdio transport)
  auth.ts            # Token-based identity resolution via Nexus API
  nexus-api.ts       # HTTP client for Nexus API (nexusGet, nexusPost)
  tools/             # 15 tool modules (27 tools total)
  __tests__/         # Unit tests with mocked API responses
```

## Related

- [nexus](https://github.com/mpowr-it/nexus) — Backend + Frontend (Next.js/Supabase/Netlify)
- [nexus-cli](https://github.com/mpowr-it/nexus-cli) — Rust CLI client
