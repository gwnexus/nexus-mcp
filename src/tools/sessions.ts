/**
 * Session lifecycle tools -- Layer 2 Coordination
 *
 * session_create:      Start a new work session for a project
 * session_close:       End a session with summary and next entry point
 * session_list:        List open sessions for a project
 *
 * Delegates to POST /api/mcp/sessions.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// create_session -> session_create
// ---------------------------------------------------------------------------

export const createSessionSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  title: z.string().max(500).describe('Session title (e.g., "Architecture review")'),
  agent_id: z
    .string()
    .max(200)
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
  const result = await nexusPost('/api/mcp/sessions', {
    action: 'session_create',
    project_id: args.project_id,
    title: args.title,
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

// ---------------------------------------------------------------------------
// close_session -> session_close
// ---------------------------------------------------------------------------

export const closeSessionSchema = {
  session_id: z.string().uuid().describe('Session UUID to close'),
  summary: z
    .string()
    .max(100_000)
    .optional()
    .describe('Summary of what was accomplished in the session'),
  next_entry_point: z
    .string()
    .max(10_000)
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
  const result = await nexusPost('/api/mcp/sessions', {
    action: 'session_close',
    session_id: args.session_id,
    summary: args.summary,
    next_entry_point: args.next_entry_point,
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

// ---------------------------------------------------------------------------
// list_open_sessions -> session_list
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
  const result = await nexusPost('/api/mcp/sessions', {
    action: 'session_list',
    project_id: args.project_id,
    limit: args.limit ?? 25,
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
