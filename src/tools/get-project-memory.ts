/**
 * get_project_memory -- Layer 1 Knowledge Access
 *
 * Returns curated project context for agent bootstrapping.
 * Includes ADRs, active tasks, recent sessions, open letters, etc.
 * Delegates to POST /api/mcp/memory.
 *
 * ADR-0001 spec: get_project_memory(project_id, include[], depth)
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

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
  const result = await nexusPost('/api/mcp/memory', {
    project_id: args.project_id,
    include: args.include,
    depth: args.depth ?? 'standard',
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
