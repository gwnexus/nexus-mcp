/**
 * doc_delete -- Layer 2 Coordination
 *
 * Delete an ingest item from a project's knowledge base.
 * Delegates to POST /api/mcp/documents (action: doc_delete).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const deleteDocumentSchema = {
  document_id: z.string().uuid().describe('Document UUID to delete'),
}

type DeleteDocumentArgs = {
  document_id: string
  user_id: string
}

export async function deleteDocument(args: DeleteDocumentArgs) {
  const result = await nexusPost('/api/mcp/documents', {
    action: 'doc_delete',
    document_id: args.document_id,
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
