/**
 * sk_list + sk_get + sk_create + sk_update + sk_activate -- Layer 2 Coordination
 *
 * Skill management tools for the Nexus platform.
 * Skills are tenant-scoped instruction sets for agent sessions.
 * Delegates to POST /api/mcp/skills.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// sk_list
// ---------------------------------------------------------------------------

export const skListSchema = {
  status_filter: z
    .array(z.enum(['draft', 'active', 'archived']))
    .optional()
    .describe('Filter by skill status (default: draft, active)'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe('Max number of skills to return'),
}

type SkListArgs = {
  status_filter?: string[]
  limit?: number
  user_id: string
}

export async function skList(args: SkListArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_list',
    status_filter: args.status_filter,
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

// ---------------------------------------------------------------------------
// sk_get
// ---------------------------------------------------------------------------

export const skGetSchema = {
  skill_id: z
    .string()
    .describe('Skill identifier (e.g., nx-init-nexus) or UUID'),
}

type SkGetArgs = {
  skill_id: string
  user_id: string
}

export async function skGet(args: SkGetArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_get',
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
// sk_create
// ---------------------------------------------------------------------------

export const skCreateSchema = {
  skill_id: z.string().describe('Skill identifier (e.g., nx-init-nexus)'),
  name: z.string().describe('Human-readable skill name'),
  description: z.string().optional().describe('Short description'),
  body: z.string().describe('Full markdown instruction content'),
  auto_generate_command: z
    .boolean()
    .default(true)
    .describe('Auto-generate an OpenCode command (default: true)'),
}

type SkCreateArgs = {
  skill_id: string
  name: string
  description?: string
  body: string
  auto_generate_command?: boolean
  user_id: string
}

export async function skCreate(args: SkCreateArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_create',
    skill_id: args.skill_id,
    name: args.name,
    description: args.description,
    body: args.body,
    auto_generate_command: args.auto_generate_command ?? true,
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
// sk_update
// ---------------------------------------------------------------------------

export const skUpdateSchema = {
  skill_id: z
    .string()
    .describe('Skill identifier (e.g., nx-init-nexus) or UUID'),
  name: z.string().optional().describe('Updated name'),
  description: z.string().optional().describe('Updated description'),
  body: z.string().optional().describe('Updated markdown content'),
  auto_generate_command: z
    .boolean()
    .optional()
    .describe('Toggle command auto-generation'),
}

type SkUpdateArgs = {
  skill_id: string
  name?: string
  description?: string
  body?: string
  auto_generate_command?: boolean
  user_id: string
}

export async function skUpdate(args: SkUpdateArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_update',
    skill_id: args.skill_id,
    name: args.name,
    description: args.description,
    body: args.body,
    auto_generate_command: args.auto_generate_command,
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
// sk_activate
// ---------------------------------------------------------------------------

export const skActivateSchema = {
  skill_id: z
    .string()
    .describe('Skill identifier (e.g., nx-init-nexus) or UUID'),
  status: z
    .enum(['active', 'archived', 'draft'])
    .describe('New status for the skill'),
}

type SkActivateArgs = {
  skill_id: string
  status: string
  user_id: string
}

export async function skActivate(args: SkActivateArgs) {
  const result = await nexusPost('/api/mcp/skills', {
    action: 'sk_activate',
    skill_id: args.skill_id,
    status: args.status,
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
