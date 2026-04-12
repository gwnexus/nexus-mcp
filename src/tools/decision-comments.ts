/**
 * Decision comment tools -- Layer 2 Coordination
 *
 * Provides append-only comment threads for ADR decisions.
 * Comments support both human and agent actors.
 *
 * Tools:
 *   - add_decision_comment: Add a comment to an ADR
 *   - list_decision_comments: Retrieve comments for an ADR
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// add_decision_comment
// ---------------------------------------------------------------------------

export const addDecisionCommentSchema = {
  decision_id: z.string().uuid().describe('Decision UUID to comment on'),
  body: z.string().describe('Comment body (markdown supported)'),
  agent_id: z
    .string()
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
  const db = getServiceClient()
  const { decision_id, body, agent_id, user_id } = args

  // Verify the decision exists
  const { data: decision } = await db
    .from('decisions')
    .select('id, title, project_id')
    .eq('id', decision_id)
    .single()

  if (!decision) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Decision not found', decision_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const { data: comment, error } = await db
    .from('decision_comments')
    .insert({
      decision_id,
      author_id: user_id,
      agent_id: agent_id ?? null,
      body,
    })
    .select()
    .single()

  if (error || !comment) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to add comment', detail: error?.message },
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
            action: 'add_decision_comment',
            comment_id: comment.id,
            decision_id,
            decision_title: decision.title,
            project_id: decision.project_id,
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// list_decision_comments
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
  const db = getServiceClient()
  const { decision_id, limit = 50 } = args

  // Verify the decision exists
  const { data: decision } = await db
    .from('decisions')
    .select('id, title')
    .eq('id', decision_id)
    .single()

  if (!decision) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Decision not found', decision_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const { data: comments, error } = await db
    .from('decision_comments')
    .select('id, author_id, agent_id, body, created_at')
    .eq('decision_id', decision_id)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to list comments', detail: error.message },
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
            decision_id,
            decision_title: decision.title,
            total: (comments ?? []).length,
            comments: comments ?? [],
          },
          null,
          2,
        ),
      },
    ],
  }
}
