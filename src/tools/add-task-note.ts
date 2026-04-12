/**
 * add_task_note -- Layer 2 Coordination
 *
 * Appends a note to an existing task. Notes are append-only and
 * maintain a chronological history/timeline.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

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
  const db = getServiceClient()
  const { task_id, note, user_id, agent_id } = args

  // Verify task exists
  const { data: existing, error: fetchError } = await db
    .from('tasks')
    .select('id, project_id')
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

  // Insert the note
  const { data: taskNote, error: insertError } = await db
    .from('task_notes')
    .insert({
      task_id,
      actor: user_id,
      agent_id: agent_id ?? null,
      note,
    })
    .select()
    .single()

  if (insertError || !taskNote) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to add task note', detail: insertError?.message },
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
            action: 'add_task_note',
            note_id: taskNote.id,
            task_id,
            agent_id: agent_id ?? undefined,
          },
          null,
          2,
        ),
      },
    ],
  }
}
