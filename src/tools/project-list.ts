/**
 * project_list -- Layer 1 Knowledge Access
 *
 * List accessible projects for the authenticated user/agent.
 * Delegates to GET /api/mcp/projects.
 */

import { z } from 'zod'
import { nexusGet } from '../nexus-api.js'

export const projectListSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of projects to return'),
}

type ProjectListArgs = {
  limit?: number
}

export async function projectList(args: ProjectListArgs) {
  const params = new URLSearchParams()
  if (args.limit !== undefined) {
    params.set('limit', String(args.limit))
  }
  const qs = params.toString()
  const path = `/api/mcp/projects${qs ? `?${qs}` : ''}`

  const result = await nexusGet(path)

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
