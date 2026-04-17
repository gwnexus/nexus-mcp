/**
 * kb_related -- Layer 1 Knowledge Access
 *
 * Returns graph-neighbor entities related to a given entity.
 * Delegates to POST /api/mcp/related.
 *
 * ADR-0001 spec: kb_related(entity_type, entity_id, relation_types[], limit)
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const getRelatedEntitiesSchema = {
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
    .describe('Type of the source entity'),
  entity_id: z.string().uuid().describe('UUID of the source entity'),
  relation_types: z
    .array(z.string().max(50))
    .optional()
    .describe(
      'Filter by specific relation types (e.g., "references", "created_in", "supersedes")',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum related entities to return'),
}

type GetRelatedEntitiesArgs = {
  entity_type: string
  entity_id: string
  relation_types?: string[]
  limit?: number
}

export async function getRelatedEntities(args: GetRelatedEntitiesArgs) {
  const result = await nexusPost('/api/mcp/related', {
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    relation_types: args.relation_types,
    limit: args.limit ?? 20,
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
