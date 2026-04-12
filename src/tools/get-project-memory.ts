/**
 * get_project_memory -- Layer 1 Knowledge Access
 *
 * Returns curated project context for agent bootstrapping.
 * Includes ADRs, active tasks, recent sessions, open letters, etc.
 *
 * ADR-0001 spec: get_project_memory(project_id, include[], depth)
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

export const getProjectMemorySchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  include: z
    .array(
      z.enum([
        'adrs',
        'rules',
        'active_tasks',
        'recent_sessions',
        'open_letters',
        'planning',
        'research',
      ]),
    )
    .describe('Categories of knowledge to include'),
  depth: z
    .enum(['light', 'standard', 'deep'])
    .default('standard')
    .describe('Detail level: light (summaries), standard, deep (full bodies)'),
}

type GetProjectMemoryArgs = {
  project_id: string
  include: string[]
  depth?: string
}

export async function getProjectMemory(args: GetProjectMemoryArgs) {
  const db = getServiceClient()
  const { project_id, include, depth = 'standard' } = args

  const memory: Record<string, unknown> = {}

  // Fetch project metadata first
  const { data: project } = await db
    .from('projects')
    .select('id, name, slug, description, status, created_at')
    .eq('id', project_id)
    .single()

  if (!project) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Project not found', project_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  memory.project = project

  // ADRs / Decisions
  if (include.includes('adrs')) {
    const select =
      depth === 'light'
        ? 'id, title, status, adr_number, created_at'
        : depth === 'deep'
          ? 'id, title, status, adr_number, context, decision, consequences, created_at, updated_at'
          : 'id, title, status, adr_number, created_at, updated_at'

    const { data } = await db
      .from('decisions')
      .select(select)
      .eq('project_id', project_id)
      .in('status', ['accepted', 'under_review', 'draft'])
      .order('adr_number', { ascending: true })

    memory.adrs = data ?? []
  }

  // Active tasks
  if (include.includes('active_tasks')) {
    const select =
      depth === 'light'
        ? 'id, title, status, priority, created_at'
        : 'id, title, status, priority, description, assigned_to, created_at, updated_at'

    const { data } = await db
      .from('tasks')
      .select(select)
      .eq('project_id', project_id)
      .in('status', ['open', 'in_progress', 'blocked'])
      .order('priority', { ascending: true })
      .limit(50)

    memory.active_tasks = data ?? []
  }

  // Recent sessions
  if (include.includes('recent_sessions')) {
    const select =
      depth === 'light'
        ? 'id, title, status, agent_id, created_at'
        : depth === 'deep'
          ? 'id, title, status, summary, agent_id, created_at, updated_at'
          : 'id, title, status, agent_id, created_at, updated_at'

    const { data } = await db
      .from('sessions')
      .select(select)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(depth === 'deep' ? 20 : 10)

    memory.recent_sessions = data ?? []
  }

  // Open letters
  if (include.includes('open_letters')) {
    const select =
      depth === 'light'
        ? 'id, subject, from_actor, to_actor, status, priority, created_at'
        : 'id, subject, from_actor, to_actor, status, priority, blocking, due_at, created_at, updated_at'

    const { data } = await db
      .from('letters')
      .select(select)
      .eq('project_id', project_id)
      .in('status', [
        'new',
        'acknowledged',
        'in_progress',
        'blocked',
        'needs_review',
      ])
      .order('created_at', { ascending: false })
      .limit(30)

    memory.open_letters = data ?? []
  }

  // Planning items
  if (include.includes('planning')) {
    const select =
      depth === 'light'
        ? 'id, title, status, created_at'
        : 'id, title, status, body, created_at, updated_at'

    const { data } = await db
      .from('planning_items')
      .select(select)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(20)

    memory.planning = data ?? []
  }

  // Research notes
  if (include.includes('research')) {
    const select =
      depth === 'light'
        ? 'id, title, status, created_at'
        : depth === 'deep'
          ? 'id, title, status, body, created_at, updated_at'
          : 'id, title, status, created_at, updated_at'

    const { data } = await db
      .from('research_notes')
      .select(select)
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(20)

    memory.research = data ?? []
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            project_id,
            depth,
            categories_included: include,
            memory,
          },
          null,
          2,
        ),
      },
    ],
  }
}
