/**
 * doc_list -- Layer 2 Coordination
 *
 * List ingested documents for a project with optional source filtering.
 * Delegates to POST /api/mcp/documents (action: doc_list).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const listDocumentsSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  source: z
    .string()
    .max(200)
    .optional()
    .describe('Filter by source (e.g., "mcp-agent", "research", "session-extract")'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum number of documents to return (default 50)'),
}

type ListDocumentsArgs = {
  project_id: string
  source?: string
  limit?: number
  user_id: string
}

export async function listDocuments(args: ListDocumentsArgs) {
  const result = await nexusPost('/api/mcp/documents', {
    action: 'doc_list',
    project_id: args.project_id,
    source: args.source,
    limit: args.limit ?? 50,
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
      { type: 'text' as const, text: JSON.stringify({ schema: 'nexus.doc-list.v1', data: result.data }, null, 2) },
    ],
  }
}
