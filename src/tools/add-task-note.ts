/**
 * add_task_note -- Layer 2 Coordination
 *
 * Appends a note to an existing task. Notes are append-only and
 * maintain a chronological history/timeline.
 * Delegates to POST /api/mcp/tasks (action: add_task_note).
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

export const addTaskNoteSchema = {
  task_id: z.string().uuid().describe('Task UUID to add a note to'),
  note: z.string().describe('Note content to append'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type AddTaskNoteArgs = {
  task_id: string
  note: string
  user_id: string
  agent_id?: string
}

export async function addTaskNote(args: AddTaskNoteArgs) {
  const result = await nexusPost('/api/mcp/tasks', {
    action: 'add_task_note',
    task_id: args.task_id,
    note: args.note,
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
