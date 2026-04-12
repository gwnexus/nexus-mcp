/**
 * vl_create + vl_reply -- Layer 2 Coordination
 *
 * Vault letter management for agent coordination.
 * Delegates to POST /api/mcp/letters (actions: vl_create, vl_reply).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

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
  const result = await nexusPost('/api/mcp/letters', {
    action: 'vl_create',
    project_id: args.project_id,
    from_actor: args.from_actor,
    to_actor: args.to_actor,
    subject: args.subject,
    body: args.body,
    priority: args.priority ?? 'normal',
    blocking: args.blocking ?? false,
    thread_id: args.thread_id,
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
  const result = await nexusPost('/api/mcp/letters', {
    action: 'vl_reply',
    letter_id: args.letter_id,
    body: args.body,
    message_type: args.message_type ?? 'response',
    agent_id: args.agent_id,
    new_status: args.new_status,
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
