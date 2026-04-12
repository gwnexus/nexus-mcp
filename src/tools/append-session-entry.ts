/**
 * append_session_entry -- Layer 2 Coordination
 *
 * Appends an entry to an existing session.
 * Enforces append-only semantics and session write isolation.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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
  const db = getServiceClient()
  const {
    session_id,
    entry_type,
    summary,
    linked_entity_type,
    linked_entity_id,
    user_id,
    agent_id,
  } = args

  // Verify session exists and check write isolation
  const { data: session, error: sessionError } = await db
    .from('sessions')
    .select('id, created_by, project_id')
    .eq('id', session_id)
    .single()

  if (sessionError || !session) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Session not found', session_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Session write isolation: only the creator can append entries
  if (session.created_by !== user_id) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error:
                'Session write isolation: only the session creator can append entries',
              session_id,
              session_owner: session.created_by,
              caller: user_id,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Append the entry
  const { data: entry, error: entryError } = await db
    .from('session_entries')
    .insert({
      session_id,
      entry_type,
      actor: user_id,
      agent_id: agent_id ?? null,
      summary,
      linked_entity_type: linked_entity_type ?? null,
      linked_entity_id: linked_entity_id ?? null,
    })
    .select()
    .single()

  if (entryError || !entry) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to append session entry',
              detail: entryError?.message,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'append_session_entry',
            entry_id: entry.id,
            session_id,
            entry_type,
            project_id: session.project_id,
          },
          null,
          2,
        ),
      },
    ],
  }
}
