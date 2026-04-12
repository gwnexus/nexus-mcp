/**
 * kb_get -- Layer 1 Knowledge Access
 *
 * Fetches a single knowledge object in canonical form.
 * Returns metadata, current version, body, and linked references.
 * Delegates to POST /api/mcp/documents (action: kb_get).
 *
 * ADR-0001 spec: kb_get(entity_type, entity_id, render_mode)
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const getDocumentSchema = {
  entity_type: z
    .enum([
      'session',
      'decision',
      'letter',
      'task',
      'research_note',
      'planning_item',
      'ingest_item',
    ])
    .describe('Type of the knowledge object'),
  entity_id: z.string().uuid().describe('UUID of the entity'),
  render_mode: z
    .enum(['structured', 'markdown', 'summary'])
    .default('structured')
    .describe('Output format: structured JSON, markdown, or summary'),
}

type GetDocumentArgs = {
  entity_type: string
  entity_id: string
  render_mode?: string
}

export async function getDocument(args: GetDocumentArgs) {
  const result = await nexusPost('/api/mcp/documents', {
    action: 'kb_get',
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    render_mode: args.render_mode ?? 'structured',
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

  // For markdown and summary modes, the API returns { content: "..." }
  // For structured mode, the API returns the full object
  const data = result.data as Record<string, unknown>
  const renderMode = args.render_mode ?? 'structured'

  if (renderMode === 'markdown' || renderMode === 'summary') {
    return {
      content: [
        {
          type: 'text' as const,
          text: (data.content as string) ?? JSON.stringify(data, null, 2),
        },
      ],
    }
  }

  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(data, null, 2) },
    ],
  }
}
