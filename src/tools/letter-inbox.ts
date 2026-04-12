/**
 * list_inbox + list_outbox + acknowledge_letter -- Layer 2 Coordination
 *
 * Inbox/outbox polling and acknowledgment for vault letters.
 * Enables agents to discover and acknowledge letters addressed to them.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// list_inbox
// ---------------------------------------------------------------------------

export const listInboxSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  status_filter: z
    .array(z.string())
    .optional()
    .describe(
      'Filter by letter status (default: new, acknowledged, in_progress, blocked, needs_review)',
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20)
    .describe('Max number of letters to return'),
}

type ListInboxArgs = {
  project_id: string
  status_filter?: string[]
  limit?: number
  user_id: string
  agent_id?: string
}

export async function listInbox(args: ListInboxArgs) {
  const db = getServiceClient()
  const {
    project_id,
    status_filter = [
      'new',
      'acknowledged',
      'in_progress',
      'blocked',
      'needs_review',
    ],
    limit = 20,
    user_id,
    agent_id,
  } = args

  // Resolve calling agent's project_agents row if agent_id is provided
  let agentRowId: string | null = null
  if (agent_id) {
    const { data: agentRow } = await db
      .from('project_agents')
      .select('id')
      .eq('project_id', project_id)
      .eq('agent_id', agent_id)
      .single()
    agentRowId = agentRow?.id ?? null
  }

  // Build query: letters addressed to this agent or user
  let query = db
    .from('letters')
    .select(
      'id, project_id, target_project_id, from_actor, to_actor, subject, priority, status, blocking, due_at, thread_id, created_at, updated_at, from_agent_id, from_user_id, to_agent_id, to_user_id',
    )
    .in('status', status_filter)
    .order('blocking', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  // Match letters addressed to this actor:
  // - to_agent_id matches (if agent) OR to_user_id matches (if user)
  // - Also include letters targeting this project (cross-project)
  if (agentRowId) {
    query = query.or(
      `to_agent_id.eq.${agentRowId},and(to_user_id.eq.${user_id},to_agent_id.is.null)`,
    )
  } else {
    query = query.eq('to_user_id', user_id)
  }

  // Scope to this project (source or target)
  query = query.or(
    `project_id.eq.${project_id},target_project_id.eq.${project_id}`,
  )

  const { data, error } = await query

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to list inbox', detail: error.message },
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
            action: 'vl_inbox',
            project_id,
            count: data?.length ?? 0,
            letters: data ?? [],
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// list_outbox
// ---------------------------------------------------------------------------

export const listOutboxSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  status_filter: z
    .array(z.string())
    .optional()
    .describe('Filter by letter status (default: all non-closed)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20)
    .describe('Max number of letters to return'),
}

type ListOutboxArgs = {
  project_id: string
  status_filter?: string[]
  limit?: number
  user_id: string
  agent_id?: string
}

export async function listOutbox(args: ListOutboxArgs) {
  const db = getServiceClient()
  const { project_id, status_filter, limit = 20, user_id, agent_id } = args

  // Resolve calling agent's project_agents row
  let agentRowId: string | null = null
  if (agent_id) {
    const { data: agentRow } = await db
      .from('project_agents')
      .select('id')
      .eq('project_id', project_id)
      .eq('agent_id', agent_id)
      .single()
    agentRowId = agentRow?.id ?? null
  }

  let query = db
    .from('letters')
    .select(
      'id, project_id, target_project_id, from_actor, to_actor, subject, priority, status, blocking, due_at, thread_id, created_at, updated_at, from_agent_id, from_user_id, to_agent_id, to_user_id',
    )
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Filter by status if provided
  if (status_filter && status_filter.length > 0) {
    query = query.in('status', status_filter)
  } else {
    query = query.neq('status', 'closed')
  }

  // Match letters sent by this actor
  if (agentRowId) {
    query = query.or(
      `from_agent_id.eq.${agentRowId},and(from_user_id.eq.${user_id},from_agent_id.is.null)`,
    )
  } else {
    query = query.eq('from_user_id', user_id)
  }

  const { data, error } = await query

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to list outbox', detail: error.message },
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
            action: 'vl_outbox',
            project_id,
            count: data?.length ?? 0,
            letters: data ?? [],
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// acknowledge_letter
// ---------------------------------------------------------------------------

export const acknowledgeLetterSchema = {
  letter_id: z.string().uuid().describe('Letter UUID to acknowledge'),
}

type AcknowledgeLetterArgs = {
  letter_id: string
  user_id: string
  agent_id?: string
}

export async function acknowledgeLetter(args: AcknowledgeLetterArgs) {
  const db = getServiceClient()
  const { letter_id, user_id, agent_id } = args

  // Check current status
  const { data: letter, error: fetchError } = await db
    .from('letters')
    .select('id, status')
    .eq('id', letter_id)
    .single()

  if (fetchError || !letter) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Letter not found', detail: fetchError?.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  if (letter.status !== 'new') {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Only new letters can be acknowledged',
              current_status: letter.status,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Update status
  const { error: updateError } = await db
    .from('letters')
    .update({ status: 'acknowledged' })
    .eq('id', letter_id)

  if (updateError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to acknowledge letter',
              detail: updateError.message,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Append acknowledgment message
  await db.from('letter_messages').insert({
    letter_id,
    actor: user_id,
    agent_id: agent_id ?? null,
    actor_type: agent_id ? 'agent' : 'user',
    message_type: 'context',
    body: `Letter acknowledged by ${agent_id || 'user'} at ${new Date().toISOString()}`,
  })

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'vl_acknowledge',
            letter_id,
            new_status: 'acknowledged',
          },
          null,
          2,
        ),
      },
    ],
  }
}
