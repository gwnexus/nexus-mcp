/**
 * doc_update -- Layer 2 Coordination
 *
 * Update title, body, or source_url of an ingest item.
 * Supports full body replacement or append mode.
 * Delegates to POST /api/mcp/documents (action: doc_update).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const updateDocumentSchema = {
  document_id: z.string().uuid().describe('Document UUID to update'),
  title: z.string().max(500).optional().describe('New document title'),
  body: z
    .string()
    .max(100_000)
    .optional()
    .describe('New document body (replaces existing content)'),
  source_url: z.string().url().optional().describe('Updated source URL'),
  append_body: z
    .string()
    .max(100_000)
    .optional()
    .describe(
      'Content to append to existing body (ignored if body is also provided)',
    ),
}

type UpdateDocumentArgs = {
  document_id: string
  title?: string
  body?: string
  source_url?: string
  append_body?: string
  user_id: string
}

export async function updateDocument(args: UpdateDocumentArgs) {
  const result = await nexusPost('/api/mcp/documents', {
    action: 'doc_update',
    document_id: args.document_id,
    title: args.title,
    body: args.body,
    source_url: args.source_url,
    append_body: args.append_body,
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
