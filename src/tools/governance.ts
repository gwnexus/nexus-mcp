/**
 * ADR Governance tools -- Layer 3
 *
 * Manages the ADR lifecycle:
 *   draft -> under_review -> accepted | rejected -> superseded -> archived
 *
 * Tools:
 *   - create_adr_draft: Create a new ADR in draft state
 *   - submit_adr_review: Move ADR from draft to under_review
 *   - record_adr_decision: Accept or reject an ADR under review
 *
 * DB columns: status (not lifecycle_state), decision (not body),
 *             supersedes (not supersedes_id), context, consequences
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// create_adr_draft
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
  const db = getServiceClient()
  const {
    project_id,
    title,
    context,
    decision,
    consequences,
    supersedes,
    user_id,
  } = args

  // Get the next ADR number for this project
  const { data: existing } = await db
    .from('decisions')
    .select('adr_number')
    .eq('project_id', project_id)
    .not('adr_number', 'is', null)
    .order('adr_number', { ascending: false })
    .limit(1)

  const lastNumber =
    existing && existing.length > 0
      ? parseInt(String(existing[0].adr_number), 10)
      : 0
  const nextNumber = (isNaN(lastNumber) ? 0 : lastNumber) + 1
  const adrNumber = String(nextNumber).padStart(4, '0')

  const { data: adr, error } = await db
    .from('decisions')
    .insert({
      project_id,
      title,
      context,
      decision,
      consequences: consequences ?? null,
      adr_number: adrNumber,
      status: 'draft',
      supersedes: supersedes ?? null,
      created_by: user_id,
    })
    .select()
    .single()

  if (error || !adr) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to create ADR draft', detail: error?.message },
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
            action: 'create_adr_draft',
            adr_id: adr.id,
            adr_number: adrNumber,
            project_id,
            title,
            status: 'draft',
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// submit_adr_review
// ---------------------------------------------------------------------------

export const submitAdrReviewSchema = {
  adr_id: z.string().uuid().describe('ADR UUID to submit for review'),
}

type SubmitAdrReviewArgs = {
  adr_id: string
  user_id: string
}

export async function submitAdrReview(args: SubmitAdrReviewArgs) {
  const db = getServiceClient()
  const { adr_id } = args

  // Verify current state is draft
  const { data: current } = await db
    .from('decisions')
    .select('id, status, title')
    .eq('id', adr_id)
    .single()

  if (!current) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'ADR not found', adr_id }, null, 2),
        },
      ],
      isError: true,
    }
  }

  if (current.status !== 'draft') {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'ADR must be in draft state to submit for review',
              adr_id,
              current_state: current.status,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const { error } = await db
    .from('decisions')
    .update({ status: 'under_review' })
    .eq('id', adr_id)

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to submit for review', detail: error.message },
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
            action: 'submit_adr_review',
            adr_id,
            title: current.title,
            new_state: 'under_review',
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// record_adr_decision
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
  const db = getServiceClient()
  const { adr_id, decision, rationale, user_id } = args

  // Verify current state is under_review
  const { data: current } = await db
    .from('decisions')
    .select('id, status, title, supersedes, decision')
    .eq('id', adr_id)
    .single()

  if (!current) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'ADR not found', adr_id }, null, 2),
        },
      ],
      isError: true,
    }
  }

  if (current.status !== 'under_review') {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'ADR must be under review to record a decision',
              adr_id,
              current_state: current.status,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Update the ADR
  const updateData: Record<string, unknown> = {
    status: decision,
    reviewed_by: user_id,
    reviewed_at: new Date().toISOString(),
  }

  // Append rationale to the decision body if provided
  if (rationale) {
    const existingDecision = (current.decision as string) ?? ''
    updateData.decision =
      existingDecision + '\n\n## Decision Rationale\n\n' + rationale
  }

  const { error } = await db
    .from('decisions')
    .update(updateData)
    .eq('id', adr_id)

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to record decision', detail: error.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // If accepted and supersedes another ADR, mark the superseded one
  if (decision === 'accepted' && current.supersedes) {
    await db
      .from('decisions')
      .update({ status: 'superseded' })
      .eq('id', current.supersedes)
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'record_adr_decision',
            adr_id,
            title: current.title,
            decision,
            new_state: decision,
            ...(current.supersedes
              ? { superseded_adr: current.supersedes }
              : {}),
          },
          null,
          2,
        ),
      },
    ],
  }
}
