/**
 * create_letter + reply_letter -- Layer 2 Coordination
 *
 * Vault letter management for agent coordination.
 * Letters are project-scoped communication artifacts.
 * Includes actor resolution (typed FKs) and auto-session-entry.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// Auto-session-entry helper (best-effort, never fails the parent operation)
// ---------------------------------------------------------------------------

async function autoSessionEntry(opts: {
  project_id: string
  user_id: string
  agent_id?: string
  entry_type: string
  summary: string
  linked_entity_type: string
  linked_entity_id: string
}) {
  try {
    const db = getServiceClient()
    // Find the caller's most recent open session in this project
    const { data: session } = await db
      .from('sessions')
      .select('id')
      .eq('project_id', opts.project_id)
      .eq('created_by', opts.user_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!session) return

    await db.from('session_entries').insert({
      session_id: session.id,
      actor: opts.user_id,
      agent_id: opts.agent_id ?? null,
      entry_type: opts.entry_type,
      summary: opts.summary,
      linked_entity_type: opts.linked_entity_type,
      linked_entity_id: opts.linked_entity_id,
    })
  } catch {
    // Best-effort: never fail the parent operation
  }
}

// ---------------------------------------------------------------------------
// create_letter
// ---------------------------------------------------------------------------

export const createLetterSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  from_actor: z.string().describe('Sender identifier (agent name or user)'),
  to_actor: z.string().describe('Recipient identifier (agent name or user)'),
  subject: z.string().describe('Letter subject'),
  body: z.string().describe('Initial message body'),
  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .default('normal')
    .describe('Letter priority'),
  blocking: z
    .boolean()
    .default(false)
    .describe('Whether this letter blocks the sender'),
  thread_id: z
    .string()
    .uuid()
    .optional()
    .describe('Optional thread UUID to group related letters'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type CreateLetterArgs = {
  project_id: string
  from_actor: string
  to_actor: string
  subject: string
  body: string
  priority?: string
  blocking?: boolean
  thread_id?: string
  user_id: string
  agent_id?: string
}

export async function createLetter(args: CreateLetterArgs) {
  const db = getServiceClient()
  const {
    project_id,
    from_actor,
    to_actor,
    subject,
    body,
    priority = 'normal',
    blocking = false,
    thread_id,
    user_id,
    agent_id,
  } = args

  // ------------------------------------------------------------------
  // Actor resolution: resolve from_actor and to_actor to typed FKs
  // ------------------------------------------------------------------
  const resolveActor = async (
    actorName: string,
  ): Promise<{
    agent_id_fk: string | null
    user_id_fk: string | null
  }> => {
    // Try project_agents first (agent_id is the TEXT identifier)
    const { data: agentRow } = await db
      .from('project_agents')
      .select('id')
      .eq('project_id', project_id)
      .eq('agent_id', actorName)
      .single()
    if (agentRow) {
      return { agent_id_fk: agentRow.id, user_id_fk: null }
    }

    // Try profiles (display_name match)
    const { data: profileRow } = await db
      .from('profiles')
      .select('id')
      .eq('display_name', actorName)
      .single()
    if (profileRow) {
      return { agent_id_fk: null, user_id_fk: profileRow.id }
    }

    // Could not resolve -- leave both null, the TEXT fields still carry the name
    return { agent_id_fk: null, user_id_fk: null }
  }

  const fromResolved = await resolveActor(from_actor)
  const toResolved = await resolveActor(to_actor)

  // Create the letter with resolved actor FKs
  const { data: letter, error: letterError } = await db
    .from('letters')
    .insert({
      project_id,
      from_actor,
      to_actor,
      subject,
      priority,
      blocking,
      thread_id: thread_id ?? null,
      created_by: user_id,
      from_agent_id: fromResolved.agent_id_fk,
      from_user_id: fromResolved.user_id_fk,
      to_agent_id: toResolved.agent_id_fk,
      to_user_id: toResolved.user_id_fk,
    })
    .select()
    .single()

  if (letterError || !letter) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to create letter', detail: letterError?.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Add the initial message with actor_type
  const { error: msgError } = await db.from('letter_messages').insert({
    letter_id: letter.id,
    actor: user_id,
    agent_id: agent_id ?? null,
    actor_type: agent_id ? 'agent' : 'user',
    message_type: 'request',
    body,
  })

  if (msgError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Letter created but initial message failed',
              letter_id: letter.id,
              detail: msgError.message,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Auto-session-entry: record letter creation in the caller's open session
  await autoSessionEntry({
    project_id,
    user_id,
    agent_id,
    entry_type: 'letter_sent',
    summary: `Letter sent to ${to_actor}: ${subject}`,
    linked_entity_type: 'letter',
    linked_entity_id: letter.id,
  })

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'vl_create',
            letter_id: letter.id,
            project_id,
            from_actor,
            to_actor,
            subject,
            status: 'new',
            from_resolved: {
              agent_id: fromResolved.agent_id_fk,
              user_id: fromResolved.user_id_fk,
            },
            to_resolved: {
              agent_id: toResolved.agent_id_fk,
              user_id: toResolved.user_id_fk,
            },
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// reply_letter
// ---------------------------------------------------------------------------

export const replyLetterSchema = {
  letter_id: z.string().uuid().describe('Letter UUID to reply to'),
  body: z.string().describe('Reply message body'),
  message_type: z
    .enum(['response', 'clarification', 'review_note', 'follow_up', 'context'])
    .default('response')
    .describe('Type of reply message'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
  new_status: z
    .enum([
      'acknowledged',
      'in_progress',
      'answered',
      'blocked',
      'needs_review',
      'closed',
    ])
    .optional()
    .describe('Optionally update the letter status'),
}

type ReplyLetterArgs = {
  letter_id: string
  body: string
  message_type?: string
  user_id: string
  agent_id?: string
  new_status?: string
}

export async function replyLetter(args: ReplyLetterArgs) {
  const db = getServiceClient()
  const {
    letter_id,
    body,
    message_type = 'response',
    user_id,
    agent_id,
    new_status,
  } = args

  // Fetch the letter to get project_id for auto-session-entry
  const { data: letterRow } = await db
    .from('letters')
    .select('id, project_id, subject')
    .eq('id', letter_id)
    .single()

  // Append the reply message with actor_type
  const { error: msgError } = await db.from('letter_messages').insert({
    letter_id,
    actor: user_id,
    agent_id: agent_id ?? null,
    actor_type: agent_id ? 'agent' : 'user',
    message_type,
    body,
  })

  if (msgError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to append reply', detail: msgError.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Optionally update letter status
  if (new_status) {
    await db.from('letters').update({ status: new_status }).eq('id', letter_id)
  }

  // Auto-session-entry: record reply in the caller's open session
  if (letterRow) {
    await autoSessionEntry({
      project_id: letterRow.project_id,
      user_id,
      agent_id,
      entry_type: 'letter_replied',
      summary: `Replied to letter: ${letterRow.subject ?? letter_id}`,
      linked_entity_type: 'letter',
      linked_entity_id: letter_id,
    })
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'vl_reply',
            letter_id,
            message_type,
            ...(new_status ? { new_status } : {}),
          },
          null,
          2,
        ),
      },
    ],
  }
}
