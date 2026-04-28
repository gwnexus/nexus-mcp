/**
 * doc_classify -- Layer 2 Coordination
 *
 * Update the classification of an ingest item.
 * Delegates to POST /api/mcp/documents (action: doc_classify).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const classifyDocumentSchema = {
  document_id: z.string().uuid().describe('Document UUID to classify'),
  classification: z
    .enum([
      'unclassified',
      'research_note',
      'planning_item',
      'decision_input',
      'reference',
      'archive',
    ])
    .describe('New classification for the document'),
}

type ClassifyDocumentArgs = {
  document_id: string
  classification: string
  user_id: string
}

export async function classifyDocument(args: ClassifyDocumentArgs) {
  const result = await nexusPost('/api/mcp/documents', {
    action: 'doc_classify',
    document_id: args.document_id,
    classification: args.classification,
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
