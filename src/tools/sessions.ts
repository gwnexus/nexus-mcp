/**
 * Session lifecycle tools -- Layer 2 Coordination
 *
 * create_session:      Start a new work session for a project
 * close_session:       End a session with summary and next entry point
 * list_open_sessions:  List open sessions for a project
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// create_session
// ---------------------------------------------------------------------------

export const createSessionSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  title: z.string().describe('Session title (e.g., "Architecture review")'),
  agent_id: z
    .string()
    .optional()
    .describe('Agent identifier starting this session'),
}

type CreateSessionArgs = {
  project_id: string
  title: string
  agent_id?: string
  user_id: string
}

export async function createSession(args: CreateSessionArgs) {
  const db = getServiceClient()
  const { project_id, title, user_id } = args

  const { data: session, error } = await db
    .from('sessions')
    .insert({
      project_id,
      title,
      status: 'open',
      created_by: user_id,
    })
    .select()
    .single()

  if (error || !session) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Failed to create session', detail: error?.message },
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
            action: 'create_session',
            session_id: session.id,
            project_id,
            title,
            status: 'open',
            created_at: session.created_at,
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// close_session
// ---------------------------------------------------------------------------

export const closeSessionSchema = {
  session_id: z.string().uuid().describe('Session UUID to close'),
  summary: z
    .string()
    .optional()
    .describe('Summary of what was accomplished in the session'),
  next_entry_point: z
    .string()
    .optional()
    .describe('Suggested starting point for the next session'),
}

type CloseSessionArgs = {
  session_id: string
  summary?: string
  next_entry_point?: string
  user_id: string
}

export async function closeSession(args: CloseSessionArgs) {
  const db = getServiceClient()
  const { session_id, summary, next_entry_point, user_id } = args

  // Verify session exists and check ownership
  const { data: session, error: fetchError } = await db
    .from('sessions')
    .select('id, status, created_by, project_id')
    .eq('id', session_id)
    .single()

  if (fetchError || !session) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Session not found', session_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Only the session creator can close it
  if (session.created_by !== user_id) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error:
                'Session write isolation: only the session creator can close a session',
              session_id,
              session_owner: session.created_by,
              caller: user_id,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Prevent closing an already-closed session
  if (session.status === 'closed') {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'Session is already closed', session_id },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  // Close the session
  const updatePayload: Record<string, unknown> = {
    status: 'closed',
  }
  if (summary !== undefined) updatePayload.summary = summary
  if (next_entry_point !== undefined)
    updatePayload.next_entry_point = next_entry_point

  const { data: updated, error: updateError } = await db
    .from('sessions')
    .update(updatePayload)
    .eq('id', session_id)
    .select()
    .single()

  if (updateError || !updated) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to close session',
              detail: updateError?.message,
            },
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
            action: 'close_session',
            session_id,
            project_id: session.project_id,
            status: 'closed',
            summary: summary ?? null,
            next_entry_point: next_entry_point ?? null,
          },
          null,
          2,
        ),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// list_open_sessions
// ---------------------------------------------------------------------------

export const listOpenSessionsSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe('Maximum number of sessions to return (default 25)'),
}

type ListOpenSessionsArgs = {
  project_id: string
  limit?: number
}

export async function listOpenSessions(args: ListOpenSessionsArgs) {
  const db = getServiceClient()
  const { project_id, limit = 25 } = args

  const { data: sessions, error } = await db
    .from('sessions')
    .select('id, title, status, created_by, created_at, updated_at')
    .eq('project_id', project_id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to list open sessions',
              detail: error.message,
            },
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
            action: 'list_open_sessions',
            project_id,
            count: sessions?.length ?? 0,
            sessions: sessions ?? [],
          },
          null,
          2,
        ),
      },
    ],
  }
}
