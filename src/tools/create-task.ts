/**
 * create_task -- Layer 2 Coordination
 *
 * Creates a new task within a project scope.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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
  const db = getServiceClient()
  const {
    project_id,
    title,
    description,
    priority = 'normal',
    assignee,
    status = 'open',
    user_id,
  } = args

  const { data: task, error } = await db
    .from('tasks')
    .insert({
      project_id,
      title,
      description: description ?? null,
      priority,
      assignee: assignee ?? null,
      status,
      created_by: user_id,
    })
    .select()
    .single()

  if (error || !task) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to create task', detail: error?.message },
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
            action: 'create_task',
            task_id: task.id,
            project_id,
            title,
            status,
            priority,
          },
          null,
          2,
        ),
      },
    ],
  }
}
