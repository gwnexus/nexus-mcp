/**
 * task_delete -- Layer 2 Coordination
 *
 * Hard-deletes a task by UUID. Use with care — this is irreversible.
 * Delegates to POST /api/mcp/tasks (action: task_delete).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const deleteTaskSchema = {
  task_id: z.string().uuid().describe('Task UUID to delete'),
  agent_id: z.string().max(200).optional().describe('Agent identifier if applicable'),
}

type DeleteTaskArgs = {
  task_id: string
  user_id: string
  agent_id?: string
}

export async function deleteTask(args: DeleteTaskArgs) {
  const result = await nexusPost('/api/mcp/tasks', {
    action: 'task_delete',
    task_id: args.task_id,
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
