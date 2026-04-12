/**
 * sk_list + sk_get + sk_create + sk_update + sk_activate -- Layer 2 Coordination
 *
 * Skill management tools for the Nexus platform.
 * Skills are tenant-scoped instruction sets for agent sessions.
 * Commands are auto-generated OpenCode wrappers.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive command slug from skill_id: mp-init-nexus -> mpowr-init-nexus */
function deriveCommandSlug(skillId: string): string {
  return skillId.replace(/^mp-/, 'mpowr-')
}

/** Generate the standard command body for a skill */
function generateCommandBody(skillId: string): string {
  return `Use the \`skill\` tool to load and execute the \`${skillId}\` skill. Follow the complete workflow as defined in the skill instructions.`
}

/** Resolve tenant_id from user's profile */
async function resolveTenantId(userId: string): Promise<string | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()
  return data?.tenant_id ?? null
}

/** Sync command when skill changes */
async function syncCommand(
  skillRowId: string,
  skillId: string,
  description: string | null,
  autoGenerate: boolean,
) {
  const db = getServiceClient()

  if (!autoGenerate) {
    // Deactivate command if it exists
    await db
      .from('commands')
      .update({ active: false })
      .eq('skill_id', skillRowId)
    return
  }

  const slug = deriveCommandSlug(skillId)
  const body = generateCommandBody(skillId)

  // Upsert: try update first, then insert
  const { data: existing } = await db
    .from('commands')
    .select('id')
    .eq('skill_id', skillRowId)
    .single()

  if (existing) {
    await db
      .from('commands')
      .update({
        command_slug: slug,
        description: description ?? '',
        command_body: body,
        active: true,
      })
      .eq('id', existing.id)
  } else {
    await db.from('commands').insert({
      skill_id: skillRowId,
      command_slug: slug,
      description: description ?? '',
      command_body: body,
      active: true,
    })
  }
}

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
  const db = getServiceClient()
  const { status_filter = ['draft', 'active'], limit = 50, user_id } = args

  const tenantId = await resolveTenantId(user_id)
  if (!tenantId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Could not resolve tenant' }, null, 2),
        },
      ],
      isError: true,
    }
  }

  const { data, error } = await db
    .from('skills')
    .select(
      'id, skill_id, name, description, status, auto_generate_command, command_slug, version, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .in('status', status_filter)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to list skills', detail: error.message },
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
            action: 'sk_list',
            count: data?.length ?? 0,
            skills: data ?? [],
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// sk_get
// ---------------------------------------------------------------------------

export const skGetSchema = {
  skill_id: z
    .string()
    .describe('Skill identifier (e.g., mp-init-nexus) or UUID'),
}

type SkGetArgs = {
  skill_id: string
  user_id: string
}

export async function skGet(args: SkGetArgs) {
  const db = getServiceClient()
  const { skill_id, user_id } = args

  const tenantId = await resolveTenantId(user_id)
  if (!tenantId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Could not resolve tenant' }, null, 2),
        },
      ],
      isError: true,
    }
  }

  // Try by skill_id first, then by UUID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      skill_id,
    )

  let query = db.from('skills').select('*').eq('tenant_id', tenantId)

  if (isUuid) {
    query = query.eq('id', skill_id)
  } else {
    query = query.eq('skill_id', skill_id)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Skill not found', detail: error?.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Also fetch associated command
  const { data: command } = await db
    .from('commands')
    .select('id, command_slug, active, command_body')
    .eq('skill_id', data.id)
    .single()

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'sk_get',
            skill: data,
            command: command ?? null,
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// sk_create
// ---------------------------------------------------------------------------

export const skCreateSchema = {
  skill_id: z.string().describe('Skill identifier (e.g., mp-init-nexus)'),
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
  const db = getServiceClient()
  const {
    skill_id,
    name,
    description,
    body,
    auto_generate_command = true,
    user_id,
  } = args

  const tenantId = await resolveTenantId(user_id)
  if (!tenantId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Could not resolve tenant' }, null, 2),
        },
      ],
      isError: true,
    }
  }

  const commandSlug = deriveCommandSlug(skill_id)

  const { data: skill, error } = await db
    .from('skills')
    .insert({
      tenant_id: tenantId,
      skill_id,
      name,
      description: description ?? null,
      body,
      status: 'draft',
      auto_generate_command,
      command_slug: commandSlug,
      created_by: user_id,
    })
    .select()
    .single()

  if (error || !skill) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to create skill', detail: error?.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Auto-generate command if enabled
  if (auto_generate_command) {
    await syncCommand(skill.id, skill_id, description ?? null, true)
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'sk_create',
            skill_id: skill.id,
            skill_identifier: skill_id,
            status: 'draft',
            command_slug: auto_generate_command ? commandSlug : null,
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// sk_update
// ---------------------------------------------------------------------------

export const skUpdateSchema = {
  skill_id: z
    .string()
    .describe('Skill identifier (e.g., mp-init-nexus) or UUID'),
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
  const db = getServiceClient()
  const { skill_id, name, description, body, auto_generate_command, user_id } =
    args

  const tenantId = await resolveTenantId(user_id)
  if (!tenantId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Could not resolve tenant' }, null, 2),
        },
      ],
      isError: true,
    }
  }

  // Resolve skill row
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      skill_id,
    )

  let query = db.from('skills').select('*').eq('tenant_id', tenantId)
  if (isUuid) {
    query = query.eq('id', skill_id)
  } else {
    query = query.eq('skill_id', skill_id)
  }

  const { data: existing, error: fetchError } = await query.single()

  if (fetchError || !existing) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Skill not found', detail: fetchError?.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Build update payload
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (body !== undefined) {
    updates.body = body
    updates.version = existing.version + 1
  }
  if (auto_generate_command !== undefined)
    updates.auto_generate_command = auto_generate_command

  if (Object.keys(updates).length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'No fields to update' }, null, 2),
        },
      ],
      isError: true,
    }
  }

  const { error: updateError } = await db
    .from('skills')
    .update(updates)
    .eq('id', existing.id)

  if (updateError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to update skill', detail: updateError.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Sync command if auto_generate_command changed
  if (auto_generate_command !== undefined) {
    await syncCommand(
      existing.id,
      existing.skill_id,
      (description ?? existing.description) as string | null,
      auto_generate_command,
    )
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'sk_update',
            skill_id: existing.id,
            skill_identifier: existing.skill_id,
            updated_fields: Object.keys(updates),
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// sk_activate
// ---------------------------------------------------------------------------

export const skActivateSchema = {
  skill_id: z
    .string()
    .describe('Skill identifier (e.g., mp-init-nexus) or UUID'),
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
  const db = getServiceClient()
  const { skill_id, status, user_id } = args

  const tenantId = await resolveTenantId(user_id)
  if (!tenantId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Could not resolve tenant' }, null, 2),
        },
      ],
      isError: true,
    }
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      skill_id,
    )

  let query = db
    .from('skills')
    .select('id, skill_id, status')
    .eq('tenant_id', tenantId)
  if (isUuid) {
    query = query.eq('id', skill_id)
  } else {
    query = query.eq('skill_id', skill_id)
  }

  const { data: existing, error: fetchError } = await query.single()

  if (fetchError || !existing) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Skill not found', detail: fetchError?.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const { error: updateError } = await db
    .from('skills')
    .update({ status })
    .eq('id', existing.id)

  if (updateError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to update skill status',
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

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'sk_activate',
            skill_id: existing.id,
            skill_identifier: existing.skill_id,
            previous_status: existing.status,
            new_status: status,
          },
          null,
          2,
        ),
      },
    ],
  }
}
