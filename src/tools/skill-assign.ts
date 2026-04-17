/**
 * sk_assign + sk_unassign + sk_export -- Layer 2 Coordination
 *
 * Skill-project assignment management tools for the Nexus platform.
 * Delegates to POST /api/mcp/skills.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// sk_assign
// ---------------------------------------------------------------------------

export const skAssignSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  skill_id: z.string().max(200).describe('Skill identifier or UUID'),
  pinned_version: z
    .number()
    .int()
    .optional()
    .describe('Pin to a specific skill version'),
  enabled: z
    .boolean()
    .optional()
    .describe('Whether the assignment is enabled (default: true)'),
}

type SkAssignArgs = {
  project_id: string
  skill_id: string
  pinned_version?: number
  enabled?: boolean
  user_id: string
}

export async function skAssign(args: SkAssignArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_assign',
    project_id: args.project_id,
    skill_id: args.skill_id,
    pinned_version: args.pinned_version,
    enabled: args.enabled,
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
// sk_unassign
// ---------------------------------------------------------------------------

export const skUnassignSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  skill_id: z.string().max(200).describe('Skill identifier or UUID'),
}

type SkUnassignArgs = {
  project_id: string
  skill_id: string
  user_id: string
}

export async function skUnassign(args: SkUnassignArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_unassign',
    project_id: args.project_id,
    skill_id: args.skill_id,
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
// sk_export
// ---------------------------------------------------------------------------

export const skExportSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
}

type SkExportArgs = {
  project_id: string
  user_id: string
}

export async function skExport(args: SkExportArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_export',
    project_id: args.project_id,
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
