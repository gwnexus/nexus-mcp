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
  project_id: z.string().uuid().optional().describe('Project UUID (falls back to NEXUS_PROJECT_ID env var when omitted)'),
  readme: z
    .string()
    .max(100_000)
    .optional()
    .describe(
      'Long-form Markdown about the project (overview, architecture, tech stack); agents see it at depth: standard',
    ),
  description: z
    .string()
    .max(1_000)
    .optional()
    .describe(
      'One short plain-text sentence (the subtitle in listings); long-form Markdown goes into readme',
    ),
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
