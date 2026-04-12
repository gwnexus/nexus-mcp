/**
 * task_update -- Layer 2 Coordination
 *
 * Updates the status (and optionally priority/assignee) of an existing task.
 * Delegates to POST /api/mcp/tasks (action: task_update).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const updateTaskStatusSchema = {
  task_id: z.string().uuid().describe('Task UUID to update'),
  status: z
    .enum(['open', 'in_progress', 'blocked', 'done', 'cancelled'])
    .describe('New task status'),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .describe('Updated priority (optional)'),
  assignee: z
    .string()
    .uuid()
    .optional()
    .describe('UUID of the newly assigned user (optional)'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type UpdateTaskStatusArgs = {
  task_id: string
  status: string
  priority?: string
  assignee?: string
  user_id: string
  agent_id?: string
}

export async function updateTaskStatus(args: UpdateTaskStatusArgs) {
  const result = await nexusPost('/api/mcp/tasks', {
    action: 'task_update',
    task_id: args.task_id,
    status: args.status,
    priority: args.priority,
    assignee: args.assignee,
    agent_id: args.agent_id,
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
