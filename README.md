# nexus-mcp

[![npm](https://img.shields.io/npm/v/@mpowr/nexus-mcp)](https://www.npmjs.com/package/@mpowr/nexus-mcp)

MCP server for the Gatewarden Nexus platform. Provides the mediation layer between
local agent runtimes (terminals) and the Nexus HTTP API.

## Install

```bash
npx @mpowr/nexus-mcp
```

Or add to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["-y", "@mpowr/nexus-mcp"],
      "env": {
        "NEXUS_API_URL": "https://nexus.mpowr.tech",
        "NEXUS_PRIVATE_TOKEN": "nxs_pat_..."
      }
    }
  }
}
```

## Architecture

The server exposes 38 tools across 4 layers via the Model Context Protocol
(stdio transport). All data access goes through the Nexus API — the MCP server
has no direct database access.

- **Layer 1 — Knowledge Access:** kb_search, kb_memory, kb_get, kb_related, project_list
- **Layer 2 — Coordination:** vault letters (vl_create/vl_reply/vl_inbox/vl_outbox/vl_ack),
  tasks (task_create/task_update/task_note/task_list), sessions (session_create/session_list/session_close/session_append),
  decision comments (dc_add/dc_list), documents (doc_ingest/doc_list),
  skills (sk_list/sk_get/sk_create/sk_update/sk_activate/sk_assign/sk_unassign/sk_export)
- **Layer 3 — Governance:** ADR lifecycle (adr_create/adr_submit/adr_decide)
- **Layer 4 — Reviews:** entity reviews (rv_list/rv_get/rv_create/rv_decide/rv_comment)

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
  tools/             # Tool modules (38 tools total)
  __tests__/         # Unit tests (112) and E2E integration tests (34)
```

## Related

- [nexus](https://github.com/mpowr-it/nexus) — Backend + Frontend (Next.js/Supabase/Netlify)
- [nexus-cli](https://github.com/mpowr-it/nexus-cli) — Rust CLI client

## License

Gatewarden Nexus is a product of the Gatewarden product group, owned by
RelicFrog Holding UG (haftungsbeschränkt). This repository is licensed to
MPOWR IT GmbH under an enterprise whitelabel license.
