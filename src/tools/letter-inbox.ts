/**
 * list_inbox + list_outbox + acknowledge_letter -- Layer 2 Coordination
 *
 * Inbox/outbox polling and acknowledgment for vault letters.
 * Delegates to POST /api/mcp/letters (actions: vl_inbox, vl_outbox, vl_acknowledge).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

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
  const result = await nexusPost('/api/mcp/letters', {
    action: 'vl_inbox',
    project_id: args.project_id,
    status_filter: args.status_filter,
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
  const result = await nexusPost('/api/mcp/letters', {
    action: 'vl_outbox',
    project_id: args.project_id,
    status_filter: args.status_filter,
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
  const result = await nexusPost('/api/mcp/letters', {
    action: 'vl_acknowledge',
    letter_id: args.letter_id,
    agent_id: args.agent_id,
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
