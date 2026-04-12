/**
 * update_task_status -- Layer 2 Coordination
 *
 * Updates the status (and optionally priority/assignee) of an existing task.
 * Only the task creator or a project admin/editor can update tasks.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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
  const db = getServiceClient()
  const { task_id, status, priority, assignee, user_id } = args

  // Verify task exists
  const { data: existing, error: fetchError } = await db
    .from('tasks')
    .select('id, status, project_id, created_by')
    .eq('id', task_id)
    .single()

  if (fetchError || !existing) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Task not found', task_id }, null, 2),
        },
      ],
      isError: true,
    }
  }

  // Build the update payload
  const updates: Record<string, string> = { status }
  if (priority !== undefined) updates.priority = priority
  if (assignee !== undefined) updates.assignee = assignee

  const previousStatus = existing.status

  const { error: updateError } = await db
    .from('tasks')
    .update(updates)
    .eq('id', task_id)

  if (updateError) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to update task', detail: updateError.message },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Auto-create a status-change note for audit trail
  await db.from('task_notes').insert({
    task_id,
    actor: user_id,
    agent_id: args.agent_id ?? null,
    note: `Status changed from "${previousStatus}" to "${status}"${priority ? `, priority set to "${priority}"` : ''}${assignee ? `, assigned to ${assignee}` : ''}`,
  })

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'update_task_status',
            task_id,
            previous_status: previousStatus,
            new_status: status,
            priority: priority ?? undefined,
            assignee: assignee ?? undefined,
          },
          null,
          2,
        ),
      },
    ],
  }
}
