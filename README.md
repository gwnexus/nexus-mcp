# nexus-mcp

[![npm](https://img.shields.io/npm/v/@gwdn/nexus-mcp)](https://www.npmjs.com/package/@gwdn/nexus-mcp)

MCP server for the Nexus platform. Provides the mediation layer between
local agent runtimes (terminals) and the Nexus HTTP API.

## Install

```bash
npx @gwdn/nexus-mcp
```

Or add to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["-y", "@gwdn/nexus-mcp"],
      "env": {
        "NEXUS_API_URL": "https://nexus.gatewarden.eu",
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
| `NEXUS_API_URL` | yes | Nexus API base URL (e.g. `https://nexus.gatewarden.eu`) |
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

## Known Issues

### npx cache prevents version upgrade

When using `npx` to run the MCP server, npm caches the resolved package in
`~/.npm/_npx/`. Subsequent invocations may continue to use the cached
(outdated) version even after a new release is published — especially in
terminals that were started before the update.

**Symptoms:** MCP tools report an older version, or new tools/fixes are missing.

**Fix:** Before starting OpenCode, clear all npx caches for this package:

```bash
find ~/.npm/_npx -path "*/node_modules/@gwdn/nexus-mcp" -type d \
  -exec rm -rf {} + 2>/dev/null
```

Then start OpenCode normally. npx will fetch the latest version into a fresh
cache entry.

> **Tip:** To avoid this entirely, pin `@latest` in your MCP config args:
> `["--yes", "@gwdn/nexus-mcp@latest"]`

## Related

- [nexus](https://github.com/gwnexus/nexus-hub) — Backend + Frontend (Next.js/Supabase/Netlify)
- [nexus-cli](https://github.com/gwnexus/nexus-cli) — Rust CLI client

## License

Nexus is a product of the Nexus Product Group, owned by
RelicFrog Holding UG (haftungsbeschränkt).
