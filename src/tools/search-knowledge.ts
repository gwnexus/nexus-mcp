/**
 * kb_search -- Layer 1 Knowledge Access
 *
 * Searches project knowledge using keyword, semantic, or hybrid mode.
 * Delegates to POST /api/mcp/search.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const searchKnowledgeSchema = {
  query: z.string().describe('Free-text search query'),
  project_id: z.string().uuid().describe('Project UUID to scope the search'),
  entity_types: z
    .array(
      z.enum([
        'session',
        'decision',
        'letter',
        'task',
        'research_note',
        'planning_item',
        'ingest_item',
      ]),
    )
    .optional()
    .describe('Filter to specific entity types'),
  search_mode: z
    .enum(['keyword', 'semantic', 'hybrid'])
    .default('keyword')
    .describe('Search mode: keyword, semantic, or hybrid'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum results to return'),
}

type SearchArgs = {
  query: string
  project_id: string
  entity_types?: string[]
  search_mode?: string
  limit?: number
}

export async function searchKnowledge(args: SearchArgs) {
  const result = await nexusPost('/api/mcp/search', {
    project_id: args.project_id,
    query: args.query,
    entity_types: args.entity_types,
    search_mode: args.search_mode ?? 'keyword',
    limit: args.limit ?? 10,
  })

  if (!result.ok) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: result.error }, null, 2) }],
      isError: true,
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
  }
}
