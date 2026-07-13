/**
 * project_update -- Layer 2 Coordination
 *
 * Updates a project's readme and/or description fields.
 * At least one field must be provided (enforced via Zod refine).
 * Delegates to POST /api/mcp/projects (action: project_update).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const projectUpdateSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  readme: z
    .string()
    .max(100_000)
    .optional()
    .describe('Full Markdown project overview (surfaced to agents at depth: standard)'),
  description: z
    .string()
    .max(1_000)
    .optional()
    .describe('Short plain-text subtitle shown in project listings'),
}

type ProjectUpdateArgs = {
  project_id: string
  readme?: string
  description?: string
  user_id: string
}

export async function projectUpdate(args: ProjectUpdateArgs) {
  if (args.readme === undefined && args.description === undefined) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'At least one of readme or description must be provided' },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  const result = await nexusPost('/api/mcp/projects', {
    action: 'project_update',
    project_id: args.project_id,
    readme: args.readme,
    description: args.description,
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
