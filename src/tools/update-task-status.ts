/**
 * task_update -- Layer 2 Coordination
 *
 * Updates a task's status, priority, assignee, title, or description.
 * All fields except task_id are optional — at least one must be provided.
 * Delegates to POST /api/mcp/tasks (action: task_update).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const updateTaskStatusSchema = {
  task_id: z.string().uuid().describe('Task UUID to update'),
  status: z
    .enum(['open', 'in_progress', 'blocked', 'done', 'cancelled'])
    .optional()
    .describe('New task status (optional)'),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .describe('Updated priority (optional)'),
  assignee: z
    .string()
    .uuid()
    .optional()
    .describe('UUID of the newly assigned user (optional)'),
  title: z
    .string()
    .max(500)
    .optional()
    .describe('Updated task title (optional)'),
  description: z
    .string()
    .max(100_000)
    .nullable()
    .optional()
    .describe('Updated task description (optional, null to clear)'),
  agent_id: z.string().max(200).optional().describe('Agent identifier if applicable'),
}

type UpdateTaskStatusArgs = {
  task_id: string
  status?: string
  priority?: string
  assignee?: string
  title?: string
  description?: string | null
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
    title: args.title,
    description: args.description,
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
