/**
 * rv_list + rv_get + rv_create + rv_decide + rv_comment -- Layer 4 Reviews
 *
 * Review lifecycle management tools for the Nexus platform.
 * Reviews cover skills, agents, and other governed entities.
 * Delegates to POST /api/mcp/reviews.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// rv_list
// ---------------------------------------------------------------------------

export const rvListSchema = {
  entity_type: z
    .enum(['skill', 'agent'])
    .optional()
    .describe('Filter by entity type (skill or agent)'),
  status: z
    .string()
    .optional()
    .describe('Filter by review status'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of reviews to return'),
}

type RvListArgs = {
  entity_type?: string
  status?: string
  limit?: number
  user_id: string
}

export async function rvList(args: RvListArgs) {
  const result = await nexusPost('/api/mcp/reviews', {
    action: 'rv_list',
    entity_type: args.entity_type,
    status: args.status,
    limit: args.limit,
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
// rv_get
// ---------------------------------------------------------------------------

export const rvGetSchema = {
  review_id: z
    .string()
    .uuid()
    .optional()
    .describe('Review UUID (look up by review ID)'),
  entity_type: z
    .string()
    .optional()
    .describe('Entity type (used with entity_id for lookup by entity)'),
  entity_id: z
    .string()
    .uuid()
    .optional()
    .describe('Entity UUID (used with entity_type for lookup by entity)'),
}

type RvGetArgs = {
  review_id?: string
  entity_type?: string
  entity_id?: string
  user_id: string
}

export async function rvGet(args: RvGetArgs) {
  const result = await nexusPost('/api/mcp/reviews', {
    action: 'rv_get',
    review_id: args.review_id,
    entity_type: args.entity_type,
    entity_id: args.entity_id,
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
// rv_create
// ---------------------------------------------------------------------------

export const rvCreateSchema = {
  entity_type: z
    .enum(['skill', 'agent'])
    .describe('Type of entity to create a review for'),
  entity_id: z
    .string()
    .uuid()
    .describe('UUID of the entity to review'),
}

type RvCreateArgs = {
  entity_type: string
  entity_id: string
  user_id: string
}

export async function rvCreate(args: RvCreateArgs) {
  const result = await nexusPost('/api/mcp/reviews', {
    action: 'rv_create',
    entity_type: args.entity_type,
    entity_id: args.entity_id,
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
// rv_decide
// ---------------------------------------------------------------------------

export const rvDecideSchema = {
  review_id: z.string().uuid().describe('Review UUID'),
  transition: z
    .enum(['submit', 'accept', 'reject', 'request_revision', 'resubmit', 'archive'])
    .describe('State transition to apply'),
  rationale: z
    .string()
    .optional()
    .describe('Optional rationale for the decision'),
}

type RvDecideArgs = {
  review_id: string
  transition: string
  rationale?: string
  user_id: string
}

export async function rvDecide(args: RvDecideArgs) {
  const result = await nexusPost('/api/mcp/reviews', {
    action: 'rv_decide',
    review_id: args.review_id,
    transition: args.transition,
    rationale: args.rationale,
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
// rv_comment
// ---------------------------------------------------------------------------

export const rvCommentSchema = {
  review_id: z.string().uuid().describe('Review UUID'),
  body: z.string().describe('Comment body (markdown supported)'),
  agent_id: z
    .string()
    .optional()
    .describe('Agent identifier if comment is posted by an agent'),
  line_start: z
    .number()
    .int()
    .optional()
    .describe('Start line number for inline comments'),
  line_end: z
    .number()
    .int()
    .optional()
    .describe('End line number for inline comments'),
}

type RvCommentArgs = {
  review_id: string
  body: string
  agent_id?: string
  line_start?: number
  line_end?: number
  user_id: string
}

export async function rvComment(args: RvCommentArgs) {
  const result = await nexusPost('/api/mcp/reviews', {
    action: 'rv_comment',
    review_id: args.review_id,
    body: args.body,
    agent_id: args.agent_id,
    line_start: args.line_start,
    line_end: args.line_end,
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
