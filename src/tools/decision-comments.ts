/**
 * Decision comment tools -- Layer 2 Coordination
 *
 * Provides append-only comment threads for ADR decisions.
 * Delegates to POST /api/mcp/governance (actions: dc_add, dc_list).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// add_decision_comment -> dc_add
// ---------------------------------------------------------------------------

export const addDecisionCommentSchema = {
  decision_id: z.string().uuid().describe('Decision UUID to comment on'),
  body: z.string().max(100_000).describe('Comment body (markdown supported)'),
  agent_id: z
    .string()
    .max(200)
    .optional()
    .describe('Agent identifier if comment is posted by an agent'),
}

type AddDecisionCommentArgs = {
  decision_id: string
  body: string
  agent_id?: string
  user_id: string
}

export async function addDecisionComment(args: AddDecisionCommentArgs) {
  const result = await nexusPost('/api/mcp/governance', {
    action: 'dc_add',
    decision_id: args.decision_id,
    body: args.body,
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
// list_decision_comments -> dc_list
// ---------------------------------------------------------------------------

export const listDecisionCommentsSchema = {
  decision_id: z.string().uuid().describe('Decision UUID'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum comments to return'),
}

type ListDecisionCommentsArgs = {
  decision_id: string
  limit?: number
}

export async function listDecisionComments(args: ListDecisionCommentsArgs) {
  const result = await nexusPost('/api/mcp/governance', {
    action: 'dc_list',
    decision_id: args.decision_id,
    limit: args.limit ?? 50,
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
