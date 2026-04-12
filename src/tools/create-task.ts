/**
 * create_task -- Layer 2 Coordination
 *
 * Creates a new task within a project scope.
 * Delegates to POST /api/mcp/tasks (action: create_task).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const createTaskSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .default('normal')
    .describe('Task priority'),
  assignee: z.string().uuid().optional().describe('UUID of the assigned user'),
  status: z
    .enum(['open', 'in_progress', 'blocked', 'done', 'cancelled'])
    .default('open')
    .describe('Initial task status'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type CreateTaskArgs = {
  project_id: string
  title: string
  description?: string
  priority?: string
  assignee?: string
  status?: string
  user_id: string
  agent_id?: string
}

export async function createTask(args: CreateTaskArgs) {
  const result = await nexusPost('/api/mcp/tasks', {
    action: 'create_task',
    project_id: args.project_id,
    title: args.title,
    description: args.description,
    priority: args.priority ?? 'normal',
    assignee: args.assignee,
    status: args.status ?? 'open',
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
