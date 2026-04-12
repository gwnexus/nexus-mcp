/**
 * get_related_entities -- Layer 1 Knowledge Access
 *
 * Returns graph-neighbor entities related to a given entity.
 * Supports navigation patterns like:
 *   ADR -> linked research notes
 *   Session -> tasks created during session
 *   Letter -> related decisions
 *
 * ADR-0001 spec: get_related_entities(entity_type, entity_id, relation_types[], limit)
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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
    .array(z.string())
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

type RelatedEntity = {
  relation: string
  entity_type: string
  entity_id: string
  title: string
  status?: string
  created_at: string
}

export async function getRelatedEntities(args: GetRelatedEntitiesArgs) {
  const db = getServiceClient()
  const { entity_type, entity_id, limit = 20 } = args

  const related: RelatedEntity[] = []

  // First, get the source entity to find its project_id
  const tableMap: Record<string, string> = {
    session: 'sessions',
    decision: 'decisions',
    letter: 'letters',
    task: 'tasks',
    research_note: 'research_notes',
    planning_item: 'planning_items',
    ingest_item: 'ingest_items',
  }

  const table = tableMap[entity_type]
  if (!table) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: `Unknown entity type: ${entity_type}` },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const { data: source, error } = await db
    .from(table)
    .select('id, project_id, created_by, created_at')
    .eq('id', entity_id)
    .single()

  if (error || !source) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Entity not found', entity_type, entity_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const projectId = source.project_id as string

  // Find related entities based on entity type relationships

  // For sessions: find entries that reference other entities
  if (entity_type === 'session') {
    // Find tasks created by the same user around the same time in the same project
    const { data: tasks } = await db
      .from('tasks')
      .select('id, title, status, created_at')
      .eq('project_id', projectId)
      .eq('created_by', source.created_by)
      .order('created_at', { ascending: false })
      .limit(limit)

    for (const task of tasks ?? []) {
      related.push({
        relation: 'task_in_project',
        entity_type: 'task',
        entity_id: task.id as string,
        title: task.title as string,
        status: task.status as string,
        created_at: task.created_at as string,
      })
    }

    // Find decisions in the same project
    const { data: decisions } = await db
      .from('decisions')
      .select('id, title, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    for (const dec of decisions ?? []) {
      related.push({
        relation: 'decision_in_project',
        entity_type: 'decision',
        entity_id: dec.id as string,
        title: dec.title as string,
        status: dec.status as string,
        created_at: dec.created_at as string,
      })
    }
  }

  // For decisions: find supersession chains and related research
  if (entity_type === 'decision') {
    const { data: sourceDecision } = await db
      .from('decisions')
      .select('supersedes')
      .eq('id', entity_id)
      .single()

    // Find superseded decision
    if (sourceDecision?.supersedes) {
      const { data: superseded } = await db
        .from('decisions')
        .select('id, title, status, created_at')
        .eq('id', sourceDecision.supersedes)
        .single()

      if (superseded) {
        related.push({
          relation: 'supersedes',
          entity_type: 'decision',
          entity_id: superseded.id as string,
          title: superseded.title as string,
          status: superseded.status as string,
          created_at: superseded.created_at as string,
        })
      }
    }

    // Find decisions that supersede this one
    const { data: supersededBy } = await db
      .from('decisions')
      .select('id, title, status, created_at')
      .eq('supersedes', entity_id)

    for (const dec of supersededBy ?? []) {
      related.push({
        relation: 'superseded_by',
        entity_type: 'decision',
        entity_id: dec.id as string,
        title: dec.title as string,
        status: dec.status as string,
        created_at: dec.created_at as string,
      })
    }

    // Find research notes in the same project
    const { data: research } = await db
      .from('research_notes')
      .select('id, title, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    for (const note of research ?? []) {
      related.push({
        relation: 'research_in_project',
        entity_type: 'research_note',
        entity_id: note.id as string,
        title: note.title as string,
        status: note.status as string,
        created_at: note.created_at as string,
      })
    }
  }

  // For letters: find related letters in thread
  if (entity_type === 'letter') {
    const { data: sourceLetter } = await db
      .from('letters')
      .select('thread_id')
      .eq('id', entity_id)
      .single()

    if (sourceLetter?.thread_id) {
      const { data: threadLetters } = await db
        .from('letters')
        .select('id, subject, status, created_at')
        .eq('thread_id', sourceLetter.thread_id)
        .neq('id', entity_id)
        .order('created_at', { ascending: true })
        .limit(limit)

      for (const letter of threadLetters ?? []) {
        related.push({
          relation: 'thread_sibling',
          entity_type: 'letter',
          entity_id: letter.id as string,
          title: letter.subject as string,
          status: letter.status as string,
          created_at: letter.created_at as string,
        })
      }
    }
  }

  // For tasks: find related sessions and decisions
  if (entity_type === 'task') {
    const { data: sessions } = await db
      .from('sessions')
      .select('id, title, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    for (const session of sessions ?? []) {
      related.push({
        relation: 'session_in_project',
        entity_type: 'session',
        entity_id: session.id as string,
        title: session.title as string,
        status: session.status as string,
        created_at: session.created_at as string,
      })
    }
  }

  // Generic: for any entity, find other entities in the same project
  if (related.length === 0) {
    // Fallback: find recent items in the same project across all types
    for (const [type, tbl] of Object.entries(tableMap)) {
      if (type === entity_type) continue

      const titleField = type === 'letter' ? 'subject' : 'title'
      const { data: items } = await db
        .from(tbl)
        .select(`id, ${titleField}, status, created_at`)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(5)

      for (const item of items ?? []) {
        const r = item as Record<string, unknown>
        related.push({
          relation: 'same_project',
          entity_type: type,
          entity_id: r.id as string,
          title: (r[titleField] as string) ?? 'Untitled',
          status: r.status as string,
          created_at: r.created_at as string,
        })
      }
    }
  }

  // Apply relation_type filter if specified
  let filtered = related
  if (args.relation_types?.length) {
    filtered = related.filter((r) => args.relation_types!.includes(r.relation))
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            source: { entity_type, entity_id, project_id: projectId },
            total_related: filtered.length,
            related: filtered.slice(0, limit),
          },
          null,
          2,
        ),
      },
    ],
  }
}
