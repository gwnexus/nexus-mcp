/**
 * task_list -- Layer 2 Coordination
 *
 * List tasks for a project with optional status filtering.
 * Delegates to POST /api/mcp/tasks (action: task_list).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const listTasksSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  status_filter: z
    .array(z.enum(['open', 'in_progress', 'blocked', 'done', 'cancelled']))
    .optional()
    .describe('Filter by task status (default: all statuses)'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum number of tasks to return (default 50)'),
}

type ListTasksArgs = {
  project_id: string
  status_filter?: string[]
  limit?: number
  user_id: string
}

export async function listTasks(args: ListTasksArgs) {
  const result = await nexusPost('/api/mcp/tasks', {
    action: 'task_list',
    project_id: args.project_id,
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
