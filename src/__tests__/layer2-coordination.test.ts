/**
 * Tests for Layer 2 Coordination tools:
 * - create_session, close_session, list_open_sessions
 * - append_session_entry
 * - create_task, update_task_status, add_task_note
 * - create_letter, reply_letter
 * - list_inbox, list_outbox, acknowledge_letter
 * - ingest_document
 * - sk_list, sk_get, sk_create, sk_update, sk_activate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseToolResponse, TEST_IDS } from './helpers'

// ---------------------------------------------------------------------------
// Mock db module
// ---------------------------------------------------------------------------

vi.mock('../db.js', () => ({
  getServiceClient: vi.fn(),
}))

import { getServiceClient } from '../db.js'

// ---------------------------------------------------------------------------
// Mock chain builder
// ---------------------------------------------------------------------------

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.not = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.or = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(result)
  chain.maybeSingle = vi.fn().mockReturnValue(result)
  // For non-single queries, make chain resolve like a promise result
  Object.assign(chain, result)
  return chain
}

function mockDb(tableMap: Record<string, { data: unknown; error: unknown }>) {
  const fromFn = vi.fn((table: string) => {
    const result = tableMap[table] ?? { data: null, error: null }
    return mockChain(result)
  })
  return { from: fromFn }
}

// ---------------------------------------------------------------------------
// Session tools
// ---------------------------------------------------------------------------

describe('Layer 2: Session tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('createSession', () => {
    it('should create a session and return session_id', async () => {
      const db = mockDb({
        sessions: {
          data: {
            id: TEST_IDS.sessionId,
            project_id: TEST_IDS.projectId,
            title: 'Test Session',
            status: 'open',
            created_at: '2026-04-12T00:00:00Z',
          },
          error: null,
        },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { createSession } = await import('../tools/sessions.js')
      const result = await createSession({
        project_id: TEST_IDS.projectId,
        title: 'Test Session',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('create_session')
      expect(parsed.session_id).toBe(TEST_IDS.sessionId)
      expect(parsed.status).toBe('open')
    })

    it('should return error on insert failure', async () => {
      const db = mockDb({
        sessions: { data: null, error: { message: 'insert failed' } },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { createSession } = await import('../tools/sessions.js')
      const result = await createSession({
        project_id: TEST_IDS.projectId,
        title: 'Fail',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Failed to create session')
    })
  })

  describe('closeSession', () => {
    it('should close a session owned by the caller', async () => {
      // First call: select to verify ownership
      // Second call: update
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'sessions') {
          callCount++
          if (callCount === 1) {
            // Verify ownership
            return mockChain({
              data: {
                id: TEST_IDS.sessionId,
                status: 'open',
                created_by: TEST_IDS.userId,
                project_id: TEST_IDS.projectId,
              },
              error: null,
            })
          } else {
            // Update
            return mockChain({
              data: {
                id: TEST_IDS.sessionId,
                status: 'closed',
              },
              error: null,
            })
          }
        }
        return mockChain({ data: null, error: null })
      })

      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { closeSession } = await import('../tools/sessions.js')
      const result = await closeSession({
        session_id: TEST_IDS.sessionId,
        summary: 'Work done',
        next_entry_point: 'Continue with task 47',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('close_session')
      expect(parsed.status).toBe('closed')
      expect(parsed.summary).toBe('Work done')
    })

    it('should reject close from non-owner', async () => {
      const fromFn = vi.fn(() =>
        mockChain({
          data: {
            id: TEST_IDS.sessionId,
            status: 'open',
            created_by: TEST_IDS.otherUserId,
            project_id: TEST_IDS.projectId,
          },
          error: null,
        }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { closeSession } = await import('../tools/sessions.js')
      const result = await closeSession({
        session_id: TEST_IDS.sessionId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toContain('write isolation')
    })

    it('should reject closing an already closed session', async () => {
      const fromFn = vi.fn(() =>
        mockChain({
          data: {
            id: TEST_IDS.sessionId,
            status: 'closed',
            created_by: TEST_IDS.userId,
            project_id: TEST_IDS.projectId,
          },
          error: null,
        }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { closeSession } = await import('../tools/sessions.js')
      const result = await closeSession({
        session_id: TEST_IDS.sessionId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toContain('already closed')
    })

    it('should return error if session not found', async () => {
      const fromFn = vi.fn(() =>
        mockChain({ data: null, error: { message: 'not found' } }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { closeSession } = await import('../tools/sessions.js')
      const result = await closeSession({
        session_id: TEST_IDS.sessionId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Session not found')
    })
  })

  describe('listOpenSessions', () => {
    it('should list open sessions for a project', async () => {
      const db = mockDb({
        sessions: {
          data: [
            {
              id: 'sess-1',
              title: 'Session 1',
              status: 'open',
              created_at: '2026-04-12',
            },
            {
              id: 'sess-2',
              title: 'Session 2',
              status: 'open',
              created_at: '2026-04-11',
            },
          ],
          error: null,
        },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { listOpenSessions } = await import('../tools/sessions.js')
      const result = await listOpenSessions({ project_id: TEST_IDS.projectId })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('list_open_sessions')
      expect(parsed.count).toBe(2)
      expect(parsed.sessions).toHaveLength(2)
    })

    it('should return empty list when no sessions exist', async () => {
      const db = mockDb({
        sessions: { data: [], error: null },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { listOpenSessions } = await import('../tools/sessions.js')
      const result = await listOpenSessions({ project_id: TEST_IDS.projectId })

      const parsed = parseToolResponse(result)
      expect(parsed.count).toBe(0)
      expect(parsed.sessions).toEqual([])
    })
  })
})

// ---------------------------------------------------------------------------
// Session entry tools
// ---------------------------------------------------------------------------

describe('Layer 2: append_session_entry', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should append an entry to an owned session', async () => {
    let callCount = 0
    const fromFn = vi.fn((table: string) => {
      if (table === 'sessions') {
        return mockChain({
          data: {
            id: TEST_IDS.sessionId,
            created_by: TEST_IDS.userId,
            project_id: TEST_IDS.projectId,
          },
          error: null,
        })
      }
      if (table === 'session_entries') {
        callCount++
        return mockChain({
          data: {
            id: TEST_IDS.entryId,
            session_id: TEST_IDS.sessionId,
            entry_type: 'note',
          },
          error: null,
        })
      }
      return mockChain({ data: null, error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { appendSessionEntry } =
      await import('../tools/append-session-entry.js')
    const result = await appendSessionEntry({
      session_id: TEST_IDS.sessionId,
      entry_type: 'note',
      summary: 'Test note',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('append_session_entry')
    expect(parsed.entry_id).toBe(TEST_IDS.entryId)
  })

  it('should reject append from non-owner', async () => {
    const fromFn = vi.fn(() =>
      mockChain({
        data: {
          id: TEST_IDS.sessionId,
          created_by: TEST_IDS.otherUserId,
          project_id: TEST_IDS.projectId,
        },
        error: null,
      }),
    )
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { appendSessionEntry } =
      await import('../tools/append-session-entry.js')
    const result = await appendSessionEntry({
      session_id: TEST_IDS.sessionId,
      entry_type: 'note',
      summary: 'Unauthorized note',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toContain('write isolation')
  })

  it('should return error if session not found', async () => {
    const fromFn = vi.fn(() =>
      mockChain({ data: null, error: { message: 'not found' } }),
    )
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { appendSessionEntry } =
      await import('../tools/append-session-entry.js')
    const result = await appendSessionEntry({
      session_id: TEST_IDS.sessionId,
      entry_type: 'note',
      summary: 'Missing session',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Task tools
// ---------------------------------------------------------------------------

describe('Layer 2: Task tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('createTask', () => {
    it('should create a task and return task_id', async () => {
      const db = mockDb({
        tasks: {
          data: {
            id: TEST_IDS.taskId,
            project_id: TEST_IDS.projectId,
            title: 'New Task',
            status: 'open',
            priority: 'normal',
          },
          error: null,
        },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { createTask } = await import('../tools/create-task.js')
      const result = await createTask({
        project_id: TEST_IDS.projectId,
        title: 'New Task',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('create_task')
      expect(parsed.task_id).toBe(TEST_IDS.taskId)
    })

    it('should return error on insert failure', async () => {
      const db = mockDb({
        tasks: { data: null, error: { message: 'FK violation' } },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { createTask } = await import('../tools/create-task.js')
      const result = await createTask({
        project_id: TEST_IDS.projectId,
        title: 'Fail Task',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('updateTaskStatus', () => {
    it('should update task status and create audit note', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'tasks') {
          callCount++
          if (callCount === 1) {
            return mockChain({
              data: {
                id: TEST_IDS.taskId,
                status: 'open',
                project_id: TEST_IDS.projectId,
                created_by: TEST_IDS.userId,
              },
              error: null,
            })
          } else {
            return mockChain({ data: null, error: null })
          }
        }
        if (table === 'task_notes') {
          return mockChain({ data: { id: TEST_IDS.noteId }, error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { updateTaskStatus } =
        await import('../tools/update-task-status.js')
      const result = await updateTaskStatus({
        task_id: TEST_IDS.taskId,
        status: 'in_progress',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('update_task_status')
      expect(parsed.previous_status).toBe('open')
      expect(parsed.new_status).toBe('in_progress')
    })

    it('should return error if task not found', async () => {
      const db = mockDb({
        tasks: { data: null, error: { message: 'not found' } },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { updateTaskStatus } =
        await import('../tools/update-task-status.js')
      const result = await updateTaskStatus({
        task_id: TEST_IDS.taskId,
        status: 'done',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Task not found')
    })
  })

  describe('addTaskNote', () => {
    it('should add a note to an existing task', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'tasks') {
          return mockChain({
            data: { id: TEST_IDS.taskId, project_id: TEST_IDS.projectId },
            error: null,
          })
        }
        if (table === 'task_notes') {
          return mockChain({
            data: {
              id: TEST_IDS.noteId,
              task_id: TEST_IDS.taskId,
              note: 'Progress update',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { addTaskNote } = await import('../tools/add-task-note.js')
      const result = await addTaskNote({
        task_id: TEST_IDS.taskId,
        note: 'Progress update',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('add_task_note')
      expect(parsed.note_id).toBe(TEST_IDS.noteId)
    })

    it('should return error if task does not exist', async () => {
      const db = mockDb({
        tasks: { data: null, error: { message: 'not found' } },
      })
      vi.mocked(getServiceClient).mockReturnValue(db as never)

      const { addTaskNote } = await import('../tools/add-task-note.js')
      const result = await addTaskNote({
        task_id: TEST_IDS.taskId,
        note: 'Ghost note',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Letter tools
// ---------------------------------------------------------------------------

describe('Layer 2: Letter tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('createLetter', () => {
    it('should create a letter with actor resolution and initial message', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'project_agents') {
          // Actor resolution: return null (unresolved) for simplicity
          return mockChain({ data: null, error: null })
        }
        if (table === 'profiles') {
          // Actor resolution: return null (unresolved)
          return mockChain({ data: null, error: null })
        }
        if (table === 'letters') {
          return mockChain({
            data: {
              id: TEST_IDS.letterId,
              project_id: TEST_IDS.projectId,
              from_actor: 'nexus-app-agent',
              to_actor: 'human',
              subject: 'Review needed',
            },
            error: null,
          })
        }
        if (table === 'letter_messages') {
          return mockChain({ data: null, error: null })
        }
        if (table === 'sessions') {
          // Auto-session-entry: no open session
          return mockChain({ data: null, error: null })
        }
        if (table === 'session_entries') {
          return mockChain({ data: null, error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { createLetter } = await import('../tools/letters.js')
      const result = await createLetter({
        project_id: TEST_IDS.projectId,
        from_actor: 'nexus-app-agent',
        to_actor: 'human',
        subject: 'Review needed',
        body: 'Please review the ADR',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_create')
      expect(parsed.letter_id).toBe(TEST_IDS.letterId)
      expect(parsed.from_resolved).toBeDefined()
      expect(parsed.to_resolved).toBeDefined()
    })

    it('should resolve agent actors to typed FKs', async () => {
      const agentRowId = '11112222-3333-4444-5555-666677778888'
      const fromFn = vi.fn((table: string) => {
        if (table === 'project_agents') {
          return mockChain({ data: { id: agentRowId }, error: null })
        }
        if (table === 'letters') {
          return mockChain({
            data: {
              id: TEST_IDS.letterId,
              project_id: TEST_IDS.projectId,
              from_actor: 'nexus-app-agent',
              to_actor: 'other-agent',
              subject: 'Agent-to-agent',
            },
            error: null,
          })
        }
        if (table === 'letter_messages') {
          return mockChain({ data: null, error: null })
        }
        if (table === 'sessions') {
          return mockChain({ data: null, error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { createLetter } = await import('../tools/letters.js')
      const result = await createLetter({
        project_id: TEST_IDS.projectId,
        from_actor: 'nexus-app-agent',
        to_actor: 'other-agent',
        subject: 'Agent-to-agent',
        body: 'Cross-agent letter',
        user_id: TEST_IDS.userId,
        agent_id: TEST_IDS.agentId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.from_resolved.agent_id).toBe(agentRowId)
      expect(parsed.to_resolved.agent_id).toBe(agentRowId)
    })

    it('should return error if letter insert fails', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'project_agents') {
          return mockChain({ data: null, error: null })
        }
        if (table === 'profiles') {
          return mockChain({ data: null, error: null })
        }
        if (table === 'letters') {
          return mockChain({ data: null, error: { message: 'insert failed' } })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { createLetter } = await import('../tools/letters.js')
      const result = await createLetter({
        project_id: TEST_IDS.projectId,
        from_actor: 'a',
        to_actor: 'b',
        subject: 'Test',
        body: 'Body',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('replyLetter', () => {
    it('should append a reply message with actor_type', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          return mockChain({
            data: {
              id: TEST_IDS.letterId,
              project_id: TEST_IDS.projectId,
              subject: 'Test letter',
            },
            error: null,
          })
        }
        if (table === 'sessions') {
          return mockChain({ data: null, error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { replyLetter } = await import('../tools/letters.js')
      const result = await replyLetter({
        letter_id: TEST_IDS.letterId,
        body: 'Reply content',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_reply')
    })

    it('should update letter status when new_status is provided', async () => {
      const updateFn = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ data: null, error: null }),
      })
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          const chain = mockChain({
            data: {
              id: TEST_IDS.letterId,
              project_id: TEST_IDS.projectId,
              subject: 'Test',
            },
            error: null,
          })
          chain.update = updateFn
          return chain
        }
        if (table === 'sessions') {
          return mockChain({ data: null, error: null })
        }
        const chain = mockChain({ data: null, error: null })
        chain.update = updateFn
        return chain
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { replyLetter } = await import('../tools/letters.js')
      const result = await replyLetter({
        letter_id: TEST_IDS.letterId,
        body: 'Acknowledged',
        new_status: 'acknowledged',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.new_status).toBe('acknowledged')
    })
  })
})

// ---------------------------------------------------------------------------
// Inbox / Outbox / Acknowledge tools
// ---------------------------------------------------------------------------

describe('Layer 2: Inbox and Outbox tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('listInbox', () => {
    it('should list inbox letters for a user', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          return mockChain({
            data: [
              {
                id: TEST_IDS.letterId,
                project_id: TEST_IDS.projectId,
                from_actor: 'other-agent',
                to_actor: 'human',
                subject: 'Incoming letter',
                status: 'new',
                priority: 'normal',
                blocking: false,
              },
            ],
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listInbox } = await import('../tools/letter-inbox.js')
      const result = await listInbox({
        project_id: TEST_IDS.projectId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_inbox')
      expect(parsed.count).toBe(1)
      expect(parsed.letters).toHaveLength(1)
    })

    it('should resolve agent_id to row ID for filtering', async () => {
      const agentRowId = '11112222-3333-4444-5555-666677778888'
      const fromFn = vi.fn((table: string) => {
        if (table === 'project_agents') {
          return mockChain({ data: { id: agentRowId }, error: null })
        }
        if (table === 'letters') {
          return mockChain({ data: [], error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listInbox } = await import('../tools/letter-inbox.js')
      const result = await listInbox({
        project_id: TEST_IDS.projectId,
        user_id: TEST_IDS.userId,
        agent_id: TEST_IDS.agentId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_inbox')
      // Verify project_agents was queried
      expect(fromFn).toHaveBeenCalledWith('project_agents')
    })

    it('should return error on query failure', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          return mockChain({
            data: null,
            error: { message: 'query failed' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listInbox } = await import('../tools/letter-inbox.js')
      const result = await listInbox({
        project_id: TEST_IDS.projectId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Failed to list inbox')
    })
  })

  describe('listOutbox', () => {
    it('should list outbox letters for a user', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          return mockChain({
            data: [
              {
                id: TEST_IDS.letterId,
                project_id: TEST_IDS.projectId,
                from_actor: 'nexus-app-agent',
                to_actor: 'human',
                subject: 'Outgoing letter',
                status: 'new',
              },
            ],
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listOutbox } = await import('../tools/letter-inbox.js')
      const result = await listOutbox({
        project_id: TEST_IDS.projectId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_outbox')
      expect(parsed.count).toBe(1)
    })

    it('should return error on query failure', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          return mockChain({
            data: null,
            error: { message: 'query failed' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listOutbox } = await import('../tools/letter-inbox.js')
      const result = await listOutbox({
        project_id: TEST_IDS.projectId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Failed to list outbox')
    })
  })

  describe('acknowledgeLetter', () => {
    it('should acknowledge a new letter', async () => {
      let letterCallCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'letters') {
          letterCallCount++
          if (letterCallCount === 1) {
            // Fetch current status
            return mockChain({
              data: { id: TEST_IDS.letterId, status: 'new' },
              error: null,
            })
          } else {
            // Update status
            return mockChain({ data: null, error: null })
          }
        }
        if (table === 'letter_messages') {
          return mockChain({ data: null, error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { acknowledgeLetter } = await import('../tools/letter-inbox.js')
      const result = await acknowledgeLetter({
        letter_id: TEST_IDS.letterId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_acknowledge')
      expect(parsed.new_status).toBe('acknowledged')
    })

    it('should reject acknowledging a non-new letter', async () => {
      const fromFn = vi.fn(() =>
        mockChain({
          data: { id: TEST_IDS.letterId, status: 'in_progress' },
          error: null,
        }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { acknowledgeLetter } = await import('../tools/letter-inbox.js')
      const result = await acknowledgeLetter({
        letter_id: TEST_IDS.letterId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Only new letters can be acknowledged')
    })

    it('should return error if letter not found', async () => {
      const fromFn = vi.fn(() =>
        mockChain({ data: null, error: { message: 'not found' } }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { acknowledgeLetter } = await import('../tools/letter-inbox.js')
      const result = await acknowledgeLetter({
        letter_id: TEST_IDS.letterId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Letter not found')
    })
  })
})

// ---------------------------------------------------------------------------
// Ingest document tool
// ---------------------------------------------------------------------------

describe('Layer 2: ingest_document', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should ingest a document into ingest_items', async () => {
    const db = mockDb({
      ingest_items: {
        data: {
          id: TEST_IDS.documentId,
          project_id: TEST_IDS.projectId,
          title: 'Research Findings',
          source: 'agent:nexus-app-agent',
          classification: 'unclassified',
        },
        error: null,
      },
    })
    vi.mocked(getServiceClient).mockReturnValue(db as never)

    const { ingestDocument } = await import('../tools/ingest-document.js')
    const result = await ingestDocument({
      project_id: TEST_IDS.projectId,
      title: 'Research Findings',
      body: '# Findings\n\nSome research content',
      agent_id: 'nexus-app-agent',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('ingest_document')
    expect(parsed.document_id).toBe(TEST_IDS.documentId)
    expect(parsed.classification).toBe('unclassified')
  })

  it('should derive source from agent_id if not specified', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          data: { id: TEST_IDS.documentId, source: 'agent:test-agent' },
          error: null,
        }),
      }),
    })
    const fromFn = vi.fn(() => ({ insert: insertFn }))
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { ingestDocument } = await import('../tools/ingest-document.js')
    const result = await ingestDocument({
      project_id: TEST_IDS.projectId,
      title: 'Auto-source',
      body: 'Content',
      agent_id: 'test-agent',
      user_id: TEST_IDS.userId,
    })

    // Verify insert was called with source derived from agent_id
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agent:test-agent',
      }),
    )
  })

  it('should return error on insert failure', async () => {
    const db = mockDb({
      ingest_items: { data: null, error: { message: 'RLS denied' } },
    })
    vi.mocked(getServiceClient).mockReturnValue(db as never)

    const { ingestDocument } = await import('../tools/ingest-document.js')
    const result = await ingestDocument({
      project_id: TEST_IDS.projectId,
      title: 'Fail',
      body: 'Content',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Skill tools
// ---------------------------------------------------------------------------

describe('Layer 2: Skill tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('skList', () => {
    it('should list skills for the tenant', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: [
              {
                id: TEST_IDS.skillId,
                skill_id: 'mp-init-nexus',
                name: 'Init Nexus',
                status: 'active',
                version: 1,
              },
              {
                id: '99999999-0000-1111-2222-333333333333',
                skill_id: 'mp-git-commit',
                name: 'Git Commit',
                status: 'active',
                version: 1,
              },
            ],
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skList } = await import('../tools/skills.js')
      const result = await skList({
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_list')
      expect(parsed.count).toBe(2)
      expect(parsed.skills).toHaveLength(2)
    })

    it('should return error when tenant cannot be resolved', async () => {
      const fromFn = vi.fn(() => mockChain({ data: null, error: null }))
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skList } = await import('../tools/skills.js')
      const result = await skList({
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Could not resolve tenant')
    })

    it('should return error on query failure', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: null,
            error: { message: 'query failed' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skList } = await import('../tools/skills.js')
      const result = await skList({
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Failed to list skills')
    })
  })

  describe('skGet', () => {
    it('should get a skill by skill_id identifier', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: {
              id: TEST_IDS.skillId,
              skill_id: 'mp-init-nexus',
              name: 'Init Nexus',
              body: '# Init Nexus\n\nInstructions here.',
              status: 'active',
              version: 1,
            },
            error: null,
          })
        }
        if (table === 'commands') {
          return mockChain({
            data: {
              id: '11111111-0000-1111-2222-333333333333',
              command_slug: 'mpowr-init-nexus',
              active: true,
              command_body: 'Use the skill tool...',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skGet } = await import('../tools/skills.js')
      const result = await skGet({
        skill_id: 'mp-init-nexus',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_get')
      expect(parsed.skill.skill_id).toBe('mp-init-nexus')
      expect(parsed.command.command_slug).toBe('mpowr-init-nexus')
    })

    it('should return error if skill not found', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: null,
            error: { message: 'not found' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skGet } = await import('../tools/skills.js')
      const result = await skGet({
        skill_id: 'mp-nonexistent',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Skill not found')
    })
  })

  describe('skCreate', () => {
    it('should create a skill in draft status with auto-generated command', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: {
              id: TEST_IDS.skillId,
              skill_id: 'mp-test-skill',
              name: 'Test Skill',
              status: 'draft',
            },
            error: null,
          })
        }
        if (table === 'commands') {
          // syncCommand: first checks existing, then inserts
          return mockChain({ data: null, error: null })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skCreate } = await import('../tools/skills.js')
      const result = await skCreate({
        skill_id: 'mp-test-skill',
        name: 'Test Skill',
        body: '# Test\n\nSkill body',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_create')
      expect(parsed.skill_identifier).toBe('mp-test-skill')
      expect(parsed.status).toBe('draft')
      expect(parsed.command_slug).toBe('mpowr-test-skill')
    })

    it('should return error on insert failure', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: null,
            error: { message: 'unique violation' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skCreate } = await import('../tools/skills.js')
      const result = await skCreate({
        skill_id: 'mp-duplicate',
        name: 'Duplicate',
        body: 'Body',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Failed to create skill')
    })
  })

  describe('skUpdate', () => {
    it('should update skill body and increment version', async () => {
      let skillsCallCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          skillsCallCount++
          if (skillsCallCount === 1) {
            // Fetch existing
            return mockChain({
              data: {
                id: TEST_IDS.skillId,
                skill_id: 'mp-init-nexus',
                name: 'Init Nexus',
                description: 'Initialize session',
                version: 1,
                auto_generate_command: true,
              },
              error: null,
            })
          } else {
            // Update
            return mockChain({ data: null, error: null })
          }
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skUpdate } = await import('../tools/skills.js')
      const result = await skUpdate({
        skill_id: 'mp-init-nexus',
        body: '# Updated\n\nNew content',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_update')
      expect(parsed.skill_identifier).toBe('mp-init-nexus')
      expect(parsed.updated_fields).toContain('body')
      expect(parsed.updated_fields).toContain('version')
    })

    it('should return error if no fields to update', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: {
              id: TEST_IDS.skillId,
              skill_id: 'mp-init-nexus',
              version: 1,
              auto_generate_command: true,
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skUpdate } = await import('../tools/skills.js')
      const result = await skUpdate({
        skill_id: 'mp-init-nexus',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('No fields to update')
    })

    it('should return error if skill not found', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: null,
            error: { message: 'not found' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skUpdate } = await import('../tools/skills.js')
      const result = await skUpdate({
        skill_id: 'mp-nonexistent',
        name: 'Updated',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Skill not found')
    })
  })

  describe('skActivate', () => {
    it('should activate a draft skill', async () => {
      let skillsCallCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          skillsCallCount++
          if (skillsCallCount === 1) {
            // Fetch existing
            return mockChain({
              data: {
                id: TEST_IDS.skillId,
                skill_id: 'mp-code-review',
                status: 'draft',
              },
              error: null,
            })
          } else {
            // Update status
            return mockChain({ data: null, error: null })
          }
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skActivate } = await import('../tools/skills.js')
      const result = await skActivate({
        skill_id: 'mp-code-review',
        status: 'active',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_activate')
      expect(parsed.previous_status).toBe('draft')
      expect(parsed.new_status).toBe('active')
    })

    it('should archive an active skill', async () => {
      let skillsCallCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          skillsCallCount++
          if (skillsCallCount === 1) {
            return mockChain({
              data: {
                id: TEST_IDS.skillId,
                skill_id: 'mp-old-skill',
                status: 'active',
              },
              error: null,
            })
          } else {
            return mockChain({ data: null, error: null })
          }
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skActivate } = await import('../tools/skills.js')
      const result = await skActivate({
        skill_id: 'mp-old-skill',
        status: 'archived',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.previous_status).toBe('active')
      expect(parsed.new_status).toBe('archived')
    })

    it('should return error if skill not found', async () => {
      const fromFn = vi.fn((table: string) => {
        if (table === 'profiles') {
          return mockChain({
            data: { tenant_id: TEST_IDS.tenantId },
            error: null,
          })
        }
        if (table === 'skills') {
          return mockChain({
            data: null,
            error: { message: 'not found' },
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { skActivate } = await import('../tools/skills.js')
      const result = await skActivate({
        skill_id: 'mp-nonexistent',
        status: 'active',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Skill not found')
    })
  })
})
