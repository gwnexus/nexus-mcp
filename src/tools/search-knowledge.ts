/**
 * search_knowledge -- Layer 1 Knowledge Access
 *
 * Searches project knowledge using keyword, semantic, or hybrid mode.
 * Scope filters are applied before any retrieval.
 *
 * ADR-0001 spec: search_knowledge(query, project_id, entity_types[], search_mode, limit)
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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

type SearchResult = {
  entity_type: string
  entity_id: string
  title: string
  status?: string
  snippet: string
  created_at: string
  relevance: string
}

// Entity table mapping
const ENTITY_TABLES: Record<
  string,
  { table: string; titleField: string; bodyField: string }
> = {
  session: { table: 'sessions', titleField: 'title', bodyField: 'summary' },
  decision: { table: 'decisions', titleField: 'title', bodyField: 'body' },
  letter: { table: 'letters', titleField: 'subject', bodyField: 'subject' },
  task: { table: 'tasks', titleField: 'title', bodyField: 'description' },
  research_note: {
    table: 'research_notes',
    titleField: 'title',
    bodyField: 'body',
  },
  planning_item: {
    table: 'planning_items',
    titleField: 'title',
    bodyField: 'body',
  },
  ingest_item: {
    table: 'ingest_items',
    titleField: 'title',
    bodyField: 'body',
  },
}

export async function searchKnowledge(args: SearchArgs) {
  const db = getServiceClient()
  const { query, project_id, entity_types, limit = 10 } = args

  const typesToSearch = entity_types?.length
    ? entity_types.filter((t) => t in ENTITY_TABLES)
    : Object.keys(ENTITY_TABLES)

  const results: SearchResult[] = []
  const lowerQuery = query.toLowerCase()
  const queryTerms = lowerQuery.split(/\s+/).filter(Boolean)

  // Search each entity table with keyword matching
  // (Semantic/hybrid mode will be enhanced with pgvector once embeddings are in place)
  for (const entityType of typesToSearch) {
    const config = ENTITY_TABLES[entityType]
    if (!config) continue

    const { data, error } = await db
      .from(config.table)
      .select(
        'id, ' +
          config.titleField +
          ', ' +
          config.bodyField +
          ', status, created_at',
      )
      .eq('project_id', project_id)
      .limit(limit)

    if (error || !data) continue

    for (const row of data) {
      const r = row as unknown as Record<string, unknown>
      const title = (r[config.titleField] as string) ?? ''
      const body = (r[config.bodyField] as string) ?? ''
      const combined = (title + ' ' + body).toLowerCase()

      // Keyword relevance: count how many query terms appear
      const matchCount = queryTerms.filter((term) =>
        combined.includes(term),
      ).length
      if (matchCount === 0) continue

      const snippet = body.length > 200 ? body.substring(0, 200) + '...' : body

      results.push({
        entity_type: entityType,
        entity_id: r.id as string,
        title: title,
        status: r.status as string | undefined,
        snippet,
        created_at: r.created_at as string,
        relevance: matchCount === queryTerms.length ? 'exact' : 'partial',
      })
    }
  }

  // Sort by relevance (exact first), then by date (newest first)
  results.sort((a, b) => {
    if (a.relevance !== b.relevance) {
      return a.relevance === 'exact' ? -1 : 1
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            query,
            project_id,
            search_mode: args.search_mode ?? 'keyword',
            total_results: results.length,
            results: results.slice(0, limit),
          },
          null,
          2,
        ),
      },
    ],
  }
}
