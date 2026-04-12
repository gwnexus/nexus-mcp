# nexus-mcp

MCP server for the mpowr-nexus platform. Provides the mediation layer between
local agent runtimes (terminals) and the Nexus backend (Supabase).

## Architecture

The server exposes 27 tools across 3 layers via the Model Context Protocol
(stdio transport):

- **Layer 1 — Knowledge Access:** search_knowledge, get_project_memory,
  get_document, get_related_entities
- **Layer 2 — Coordination:** vault letters (create/reply/inbox/outbox/acknowledge),
  tasks (create/update/add_note), sessions (create/list/append_entry),
  decision comments, document ingestion, skills (list/get/create/update/delete/
  seed_defaults)
- **Layer 3 — Governance:** ADR lifecycle (submit_review, approve, reject, supersede)

## Authentication

Identity is resolved once at startup from `NEXUS_PRIVATE_TOKEN` (nxs_pat_*).
The token is SHA-256 hashed and looked up in the `api_keys` table. All write
operations use the resolved user identity automatically.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key |
| `NEXUS_PRIVATE_TOKEN` | yes | nxs_pat_* API token for identity resolution |

## Development

```bash
npm install
npm run typecheck   # TypeScript check
npm test            # Run 86 tests
npm run build       # Compile to dist/
npm run dev         # Run via tsx (development)
npm start           # Run compiled JS (production)
```

## Project Structure

```
src/
  server.ts          # MCP server entry point (stdio transport)
  auth.ts            # Token-based identity resolution
  db.ts              # Supabase service client
  tools/             # 15 tool modules (27 tools total)
  __tests__/         # 86 unit tests with mocked Supabase
```

## Related

- [nexus](https://github.com/mpowr-it/nexus) — Backend + Frontend (Next.js/Supabase/Netlify)
- [nexus-cli](https://github.com/mpowr-it/nexus-cli) — Rust CLI client
