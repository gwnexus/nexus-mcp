/**
 * Tests for Layer 2 Coordination tools.
 * All tools delegate to the Nexus API via nexusPost().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// Session tools
// ---------------------------------------------------------------------------

describe('Layer 2: Session tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('createSession', () => {
    it('should create a session and return session data', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'session_create',
          id: TEST_IDS.sessionId,
          project_id: TEST_IDS.projectId,
          title: 'Test Session',
          status: 'open',
          created_at: '2026-04-12T00:00:00Z',
        }),
      )

      const { createSession } = await import('../tools/sessions.js')
      const result = await createSession({
        project_id: TEST_IDS.projectId,
        title: 'Test Session',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('session_create')
      expect(parsed.id).toBe(TEST_IDS.sessionId)
      expect(parsed.status).toBe('open')
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Failed to create session'))

      const { createSession } = await import('../tools/sessions.js')
      const result = await createSession({
        project_id: TEST_IDS.projectId,
        title: 'Fail',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('closeSession', () => {
    it('should close a session', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'session_close',
          session_id: TEST_IDS.sessionId,
          project_id: TEST_IDS.projectId,
          status: 'closed',
          summary: 'Work done',
          next_entry_point: 'Continue with task 47',
        }),
      )

      const { closeSession } = await import('../tools/sessions.js')
      const result = await closeSession({
        session_id: TEST_IDS.sessionId,
        summary: 'Work done',
        next_entry_point: 'Continue with task 47',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('session_close')
      expect(parsed.status).toBe('closed')
      expect(parsed.summary).toBe('Work done')
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Session not found'))

      const { closeSession } = await import('../tools/sessions.js')
      const result = await closeSession({
        session_id: TEST_IDS.sessionId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('listOpenSessions', () => {
    it('should list open sessions for a project', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'session_list',
          project_id: TEST_IDS.projectId,
          count: 2,
          sessions: [
            { id: 'sess-1', title: 'Session 1', status: 'open' },
            { id: 'sess-2', title: 'Session 2', status: 'open' },
          ],
        }),
      )

      const { listOpenSessions } = await import('../tools/sessions.js')
      const result = await listOpenSessions({ project_id: TEST_IDS.projectId })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('session_list')
      expect(parsed.count).toBe(2)
      expect(parsed.sessions).toHaveLength(2)
    })
  })
})

// ---------------------------------------------------------------------------
// Session entry tools
// ---------------------------------------------------------------------------

describe('Layer 2: session_append', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should append an entry to a session', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'session_append',
        entry_id: TEST_IDS.entryId,
        session_id: TEST_IDS.sessionId,
        entry_type: 'note',
        project_id: TEST_IDS.projectId,
      }),
    )

    const { appendSessionEntry } = await import('../tools/append-session-entry.js')
    const result = await appendSessionEntry({
      session_id: TEST_IDS.sessionId,
      entry_type: 'note',
      summary: 'Test note',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('session_append')
    expect(parsed.entry_id).toBe(TEST_IDS.entryId)
  })

  it('should return error on write isolation violation', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Session write isolation: only the session creator can append entries', 403),
    )

    const { appendSessionEntry } = await import('../tools/append-session-entry.js')
    const result = await appendSessionEntry({
      session_id: TEST_IDS.sessionId,
      entry_type: 'note',
      summary: 'Unauthorized note',
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
    it('should create a task and return task data', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'task_create',
          task_id: TEST_IDS.taskId,
          project_id: TEST_IDS.projectId,
          title: 'New Task',
          status: 'open',
          priority: 'normal',
        }),
      )

      const { createTask } = await import('../tools/create-task.js')
      const result = await createTask({
        project_id: TEST_IDS.projectId,
        title: 'New Task',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('task_create')
      expect(parsed.task_id).toBe(TEST_IDS.taskId)
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('FK violation'))

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
    it('should update task status', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'task_update',
          task_id: TEST_IDS.taskId,
          previous_status: 'open',
          new_status: 'in_progress',
        }),
      )

      const { updateTaskStatus } = await import('../tools/update-task-status.js')
      const result = await updateTaskStatus({
        task_id: TEST_IDS.taskId,
        status: 'in_progress',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('task_update')
      expect(parsed.previous_status).toBe('open')
      expect(parsed.new_status).toBe('in_progress')
    })

    it('should return error if task not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Task not found', 404))

      const { updateTaskStatus } = await import('../tools/update-task-status.js')
      const result = await updateTaskStatus({
        task_id: TEST_IDS.taskId,
        status: 'done',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('addTaskNote', () => {
    it('should add a note to an existing task', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'task_note',
          note_id: TEST_IDS.noteId,
          task_id: TEST_IDS.taskId,
        }),
      )

      const { addTaskNote } = await import('../tools/add-task-note.js')
      const result = await addTaskNote({
        task_id: TEST_IDS.taskId,
        note: 'Progress update',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('task_note')
      expect(parsed.note_id).toBe(TEST_IDS.noteId)
    })

    it('should return error if task does not exist', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Task not found', 404))

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
    it('should create a letter', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'vl_create',
          letter_id: TEST_IDS.letterId,
          project_id: TEST_IDS.projectId,
          from_actor: 'nexus-app-agent',
          to_actor: 'human',
          subject: 'Review needed',
          status: 'new',
          from_resolved: { agent_id: null, user_id: null },
          to_resolved: { agent_id: null, user_id: null },
        }),
      )

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

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Failed to create letter'))

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
    it('should reply to a letter', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'vl_reply',
          letter_id: TEST_IDS.letterId,
          message_type: 'response',
        }),
      )

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

    it('should include new_status when provided', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'vl_reply',
          letter_id: TEST_IDS.letterId,
          message_type: 'response',
          new_status: 'acknowledged',
        }),
      )

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
    it('should list inbox letters', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'vl_inbox',
          project_id: TEST_IDS.projectId,
          count: 1,
          letters: [
            {
              id: TEST_IDS.letterId,
              from_actor: 'other-agent',
              to_actor: 'human',
              subject: 'Incoming letter',
              status: 'new',
            },
          ],
        }),
      )

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

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Failed to list inbox'))

      const { listInbox } = await import('../tools/letter-inbox.js')
      const result = await listInbox({
        project_id: TEST_IDS.projectId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('listOutbox', () => {
    it('should list outbox letters', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'vl_outbox',
          project_id: TEST_IDS.projectId,
          count: 1,
          letters: [
            {
              id: TEST_IDS.letterId,
              from_actor: 'nexus-app-agent',
              to_actor: 'human',
              subject: 'Outgoing letter',
              status: 'new',
            },
          ],
        }),
      )

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
  })

  describe('acknowledgeLetter', () => {
    it('should acknowledge a letter', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'vl_ack',
          letter_id: TEST_IDS.letterId,
          new_status: 'acknowledged',
        }),
      )

      const { acknowledgeLetter } = await import('../tools/letter-inbox.js')
      const result = await acknowledgeLetter({
        letter_id: TEST_IDS.letterId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('vl_ack')
      expect(parsed.new_status).toBe('acknowledged')
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Letter not found', 404))

      const { acknowledgeLetter } = await import('../tools/letter-inbox.js')
      const result = await acknowledgeLetter({
        letter_id: TEST_IDS.letterId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Ingest document tool
// ---------------------------------------------------------------------------

describe('Layer 2: doc_ingest', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should ingest a document', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'doc_ingest',
        document_id: TEST_IDS.documentId,
        project_id: TEST_IDS.projectId,
        title: 'Research Findings',
        classification: 'unclassified',
        source: 'agent:nexus-app-agent',
        body_length: 33,
      }),
    )

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
    expect(parsed.action).toBe('doc_ingest')
    expect(parsed.document_id).toBe(TEST_IDS.documentId)
    expect(parsed.classification).toBe('unclassified')
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('RLS denied'))

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
    it('should list skills', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'sk_list',
          count: 2,
          skills: [
            { id: TEST_IDS.skillId, skill_id: 'mp-init-nexus', name: 'Init Nexus', status: 'active' },
            { id: '99999999-0000-1111-2222-333333333333', skill_id: 'mp-git-commit', name: 'Git Commit', status: 'active' },
          ],
        }),
      )

      const { skList } = await import('../tools/skills.js')
      const result = await skList({ user_id: TEST_IDS.userId })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_list')
      expect(parsed.count).toBe(2)
      expect(parsed.skills).toHaveLength(2)
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Could not resolve tenant'))

      const { skList } = await import('../tools/skills.js')
      const result = await skList({ user_id: TEST_IDS.userId })

      expect(result.isError).toBe(true)
    })
  })

  describe('skGet', () => {
    it('should get a skill by identifier', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'sk_get',
          skill: {
            id: TEST_IDS.skillId,
            skill_id: 'mp-init-nexus',
            name: 'Init Nexus',
            body: '# Init Nexus\n\nInstructions here.',
            status: 'active',
          },
          command: { id: '11111111-0000-1111-2222-333333333333', command_slug: 'mpowr-init-nexus', active: true },
        }),
      )

      const { skGet } = await import('../tools/skills.js')
      const result = await skGet({ skill_id: 'mp-init-nexus', user_id: TEST_IDS.userId })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_get')
      expect(parsed.skill.skill_id).toBe('mp-init-nexus')
      expect(parsed.command.command_slug).toBe('mpowr-init-nexus')
    })

    it('should return error if skill not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Skill not found', 404))

      const { skGet } = await import('../tools/skills.js')
      const result = await skGet({ skill_id: 'mp-nonexistent', user_id: TEST_IDS.userId })

      expect(result.isError).toBe(true)
    })
  })

  describe('skCreate', () => {
    it('should create a skill in draft status', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'sk_create',
          skill_id: TEST_IDS.skillId,
          skill_identifier: 'mp-test-skill',
          status: 'draft',
          command_slug: 'mpowr-test-skill',
        }),
      )

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
  })

  describe('skUpdate', () => {
    it('should update a skill', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'sk_update',
          skill_id: TEST_IDS.skillId,
          skill_identifier: 'mp-init-nexus',
          updated_fields: ['body', 'version'],
        }),
      )

      const { skUpdate } = await import('../tools/skills.js')
      const result = await skUpdate({
        skill_id: 'mp-init-nexus',
        body: '# Updated\n\nNew content',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('sk_update')
      expect(parsed.updated_fields).toContain('body')
    })

    it('should return error if skill not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Skill not found', 404))

      const { skUpdate } = await import('../tools/skills.js')
      const result = await skUpdate({
        skill_id: 'mp-nonexistent',
        name: 'Updated',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('skActivate', () => {
    it('should activate a skill', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'sk_activate',
          skill_id: TEST_IDS.skillId,
          skill_identifier: 'mp-code-review',
          previous_status: 'draft',
          new_status: 'active',
        }),
      )

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

    it('should return error if skill not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Skill not found', 404))

      const { skActivate } = await import('../tools/skills.js')
      const result = await skActivate({
        skill_id: 'mp-nonexistent',
        status: 'active',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })
})
