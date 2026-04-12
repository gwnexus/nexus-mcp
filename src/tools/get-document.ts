/**
 * get_document -- Layer 1 Knowledge Access
 *
 * Fetches a single knowledge object in canonical form.
 * Returns metadata, current version, body, and linked references.
 *
 * ADR-0001 spec: get_document(entity_type, entity_id, render_mode)
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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

// Table and field configuration per entity type
const ENTITY_CONFIG: Record<
  string,
  {
    table: string
    fields: string
    childTable?: string
    childFk?: string
    childFields?: string
  }
> = {
  session: {
    table: 'sessions',
    fields: '*',
    childTable: 'session_entries',
    childFk: 'session_id',
    childFields:
      'id, entry_type, actor, agent_id, summary, linked_entity_type, linked_entity_id, created_at',
  },
  decision: {
    table: 'decisions',
    fields: '*',
  },
  letter: {
    table: 'letters',
    fields: '*',
    childTable: 'letter_messages',
    childFk: 'letter_id',
    childFields: 'id, actor, agent_id, message_type, body, created_at',
  },
  task: {
    table: 'tasks',
    fields: '*',
  },
  research_note: {
    table: 'research_notes',
    fields: '*',
  },
  planning_item: {
    table: 'planning_items',
    fields: '*',
  },
  ingest_item: {
    table: 'ingest_items',
    fields: '*',
  },
}

function renderMarkdown(
  entityType: string,
  doc: Record<string, unknown>,
  children?: Record<string, unknown>[],
): string {
  const lines: string[] = []
  const title = (doc.title ?? doc.subject ?? 'Untitled') as string
  lines.push(`# ${entityType}: ${title}`)
  lines.push('')
  lines.push(`**ID:** ${doc.id}`)
  if (doc.status) lines.push(`**Status:** ${doc.status}`)
  if (doc.lifecycle_state) lines.push(`**Lifecycle:** ${doc.lifecycle_state}`)
  if (doc.adr_number) lines.push(`**ADR Number:** ${doc.adr_number}`)
  if (doc.priority) lines.push(`**Priority:** ${doc.priority}`)
  lines.push(`**Created:** ${doc.created_at}`)
  if (doc.updated_at) lines.push(`**Updated:** ${doc.updated_at}`)
  lines.push('')

  const body = (doc.body ?? doc.description ?? doc.summary ?? '') as string
  if (body) {
    lines.push('## Content')
    lines.push('')
    lines.push(body)
    lines.push('')
  }

  if (children && children.length > 0) {
    lines.push(`## Entries (${children.length})`)
    lines.push('')
    for (const child of children) {
      const childBody = (child.summary ??
        child.body ??
        child.message ??
        '') as string
      const childType = (child.entry_type ?? child.message_type ?? '') as string
      lines.push(`### ${childType} (${child.created_at})`)
      lines.push(childBody)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function renderSummary(
  entityType: string,
  doc: Record<string, unknown>,
): string {
  const title = (doc.title ?? doc.subject ?? 'Untitled') as string
  const status = (doc.status ?? doc.lifecycle_state ?? 'unknown') as string
  const body = (doc.body ?? doc.description ?? doc.summary ?? '') as string
  const snippet = body.length > 300 ? body.substring(0, 300) + '...' : body

  return [
    `${entityType}: ${title}`,
    `Status: ${status}`,
    `Created: ${doc.created_at}`,
    '',
    snippet,
  ].join('\n')
}

export async function getDocument(args: GetDocumentArgs) {
  const db = getServiceClient()
  const { entity_type, entity_id, render_mode = 'structured' } = args

  const config = ENTITY_CONFIG[entity_type]
  if (!config) {
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

  const { data: doc, error } = await db
    .from(config.table)
    .select(config.fields)
    .eq('id', entity_id)
    .single()

  if (error || !doc) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Document not found', entity_type, entity_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Fetch child entries if applicable
  let children: Record<string, unknown>[] | undefined
  if (config.childTable && config.childFk && config.childFields) {
    const { data: childData } = await db
      .from(config.childTable)
      .select(config.childFields)
      .eq(config.childFk, entity_id)
      .order('created_at', { ascending: true })

    children = (childData ?? []) as unknown as Record<string, unknown>[]
  }

  // Render based on mode
  let text: string
  const docRecord = doc as unknown as Record<string, unknown>
  switch (render_mode) {
    case 'markdown':
      text = renderMarkdown(entity_type, docRecord, children)
      break
    case 'summary':
      text = renderSummary(entity_type, docRecord)
      break
    case 'structured':
    default:
      text = JSON.stringify(
        {
          entity_type,
          entity_id,
          document: doc,
          ...(children ? { entries: children } : {}),
        },
        null,
        2,
      )
      break
  }

  return {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  }
}
