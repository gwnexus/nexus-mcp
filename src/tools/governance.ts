/**
 * ADR Governance tools -- Layer 3
 *
 * Manages the ADR lifecycle:
 *   draft -> under_review -> accepted | rejected -> superseded -> archived
 *
 * Delegates to POST /api/mcp/governance.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// create_adr_draft -> adr_create
// ---------------------------------------------------------------------------

export const createAdrDraftSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  title: z.string().describe('ADR title'),
  context: z
    .string()
    .describe('Context / motivation for the decision (markdown)'),
  decision: z.string().describe('The decision content (markdown)'),
  consequences: z
    .string()
    .optional()
    .describe('Expected consequences of the decision (markdown)'),
  supersedes: z
    .string()
    .uuid()
    .optional()
    .describe('UUID of the ADR this one supersedes'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type CreateAdrDraftArgs = {
  project_id: string
  title: string
  context: string
  decision: string
  consequences?: string
  supersedes?: string
  user_id: string
  agent_id?: string
}

export async function createAdrDraft(args: CreateAdrDraftArgs) {
  const result = await nexusPost('/api/mcp/governance', {
    action: 'adr_create',
    project_id: args.project_id,
    title: args.title,
    context: args.context,
    decision: args.decision,
    consequences: args.consequences,
    supersedes: args.supersedes,
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
// submit_adr_review -> adr_submit
// ---------------------------------------------------------------------------

export const submitAdrReviewSchema = {
  adr_id: z.string().uuid().describe('ADR UUID to submit for review'),
}

type SubmitAdrReviewArgs = {
  adr_id: string
  user_id: string
}

export async function submitAdrReview(args: SubmitAdrReviewArgs) {
  const result = await nexusPost('/api/mcp/governance', {
    action: 'adr_submit',
    adr_id: args.adr_id,
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
// record_adr_decision -> adr_decide
// ---------------------------------------------------------------------------

export const recordAdrDecisionSchema = {
  adr_id: z.string().uuid().describe('ADR UUID'),
  decision: z
    .enum(['accepted', 'rejected'])
    .describe('Decision outcome: accept or reject'),
  rationale: z
    .string()
    .optional()
    .describe('Optional rationale for the decision'),
}

type RecordAdrDecisionArgs = {
  adr_id: string
  decision: string
  rationale?: string
  user_id: string
}

export async function recordAdrDecision(args: RecordAdrDecisionArgs) {
  const result = await nexusPost('/api/mcp/governance', {
    action: 'adr_decide',
    adr_id: args.adr_id,
    decision: args.decision,
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
