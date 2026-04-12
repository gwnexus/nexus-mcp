/**
 * append_session_entry -- Layer 2 Coordination
 *
 * Appends an entry to an existing session.
 * Enforces append-only semantics and session write isolation.
 * Delegates to POST /api/mcp/sessions (action: append_entry).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const appendSessionEntrySchema = {
  session_id: z.string().uuid().describe('Session UUID to append to'),
  entry_type: z
    .enum([
      'decision_referenced',
      'task_created',
      'task_updated',
      'letter_sent',
      'letter_replied',
      'research_added',
      'conflict_detected',
      'adr_drafted',
      'adr_accepted',
      'handoff_recorded',
      'note',
      'correction',
    ])
    .describe('Type of session entry'),
  summary: z.string().describe('Entry content / summary text'),
  linked_entity_type: z
    .string()
    .optional()
    .describe(
      'Type of linked entity (e.g., "task", "decision", "letter", "research_link")',
    ),
  linked_entity_id: z
    .string()
    .uuid()
    .optional()
    .describe('UUID of the linked entity'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type AppendSessionEntryArgs = {
  session_id: string
  entry_type: string
  summary: string
  linked_entity_type?: string
  linked_entity_id?: string
  user_id: string
  agent_id?: string
}

export async function appendSessionEntry(args: AppendSessionEntryArgs) {
  const result = await nexusPost('/api/mcp/sessions', {
    action: 'append_entry',
    session_id: args.session_id,
    entry_type: args.entry_type,
    summary: args.summary,
    agent_id: args.agent_id,
    linked_entity_type: args.linked_entity_type,
    linked_entity_id: args.linked_entity_id,
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
