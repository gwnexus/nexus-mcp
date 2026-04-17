/**
 * doc_ingest -- Layer 2 Coordination
 *
 * Allows agents to push text/markdown content into a project's
 * knowledge base via the ingest_items table.
 * Delegates to POST /api/mcp/documents (action: doc_ingest).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const ingestDocumentSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  title: z.string().max(500).describe('Document title'),
  body: z.string().max(100_000).describe('Document content (text or markdown)'),
  source: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Source identifier (e.g. "mcp-agent", "research", "session-extract")',
    ),
  source_url: z.string().url().optional().describe('Source URL if applicable'),
  agent_id: z.string().max(200).optional().describe('Agent identifier if applicable'),
}

type IngestDocumentArgs = {
  project_id: string
  title: string
  body: string
  source?: string
  source_url?: string
  user_id: string
  agent_id?: string
}

export async function ingestDocument(args: IngestDocumentArgs) {
  const result = await nexusPost('/api/mcp/documents', {
    action: 'doc_ingest',
    project_id: args.project_id,
    title: args.title,
    body: args.body,
    source: args.source,
    source_url: args.source_url,
    agent_id: args.agent_id,
  })

  if (!result.ok) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: result.error }, null, 2),
        },
      ],
      isError: true,
    }
  }

  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(result.data, null, 2) },
    ],
  }
}
