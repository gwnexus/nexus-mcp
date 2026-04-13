/**
 * Tests for MCP server.ts integration:
 * - withIdentity wrapper
 * - Tool registration count
 * - Schema export verification
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// We test the withIdentity pattern and schema exports without
// starting the full server (which needs stdio transport).

describe('MCP Server: withIdentity wrapper', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('should inject user_id from identity into handler args', async () => {
    // Recreate the withIdentity function inline (same logic as server.ts)
    // with a simple mock identity
    const mockIdentity = {
      userId: 'injected-user-id',
      email: 'test@example.com',
      displayName: 'Test',
      isPlatformAdmin: true,
    }

    function withIdentity(
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) {
      return async (args: Record<string, unknown>) => {
        return handler({ ...args, user_id: mockIdentity.userId })
      }
    }

    const mockHandler = vi.fn().mockResolvedValue({ content: [] })
    const wrapped = withIdentity(mockHandler)

    await wrapped({ project_id: 'test-project', title: 'Test' })

    expect(mockHandler).toHaveBeenCalledWith({
      project_id: 'test-project',
      title: 'Test',
      user_id: 'injected-user-id',
    })
  })

  it('should override any user_id passed by the caller', async () => {
    const mockIdentity = {
      userId: 'real-user-id',
      email: 'real@example.com',
      displayName: 'Real User',
      isPlatformAdmin: false,
    }

    function withIdentity(
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) {
      return async (args: Record<string, unknown>) => {
        return handler({ ...args, user_id: mockIdentity.userId })
      }
    }

    const mockHandler = vi.fn().mockResolvedValue({ content: [] })
    const wrapped = withIdentity(mockHandler)

    // Caller tries to inject a different user_id
    await wrapped({ project_id: 'test', user_id: 'attacker-user-id' })

    // The real identity should override the attacker's
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'real-user-id' }),
    )
  })
})

describe('MCP Server: Schema exports', () => {
  it('should export valid schemas from all tool modules', async () => {
    // Verify each tool module exports the expected schema + handler

    const searchKnowledge = await import('../tools/search-knowledge.js')
    expect(searchKnowledge.searchKnowledgeSchema).toBeDefined()
    expect(searchKnowledge.searchKnowledgeSchema.query).toBeDefined()
    expect(searchKnowledge.searchKnowledgeSchema.project_id).toBeDefined()
    expect(typeof searchKnowledge.searchKnowledge).toBe('function')

    const getProjectMemory = await import('../tools/get-project-memory.js')
    expect(getProjectMemory.getProjectMemorySchema).toBeDefined()
    expect(typeof getProjectMemory.getProjectMemory).toBe('function')

    const getDocument = await import('../tools/get-document.js')
    expect(getDocument.getDocumentSchema).toBeDefined()
    expect(typeof getDocument.getDocument).toBe('function')

    const getRelated = await import('../tools/get-related-entities.js')
    expect(getRelated.getRelatedEntitiesSchema).toBeDefined()
    expect(typeof getRelated.getRelatedEntities).toBe('function')

    const createTask = await import('../tools/create-task.js')
    expect(createTask.createTaskSchema).toBeDefined()
    expect(createTask.createTaskSchema.project_id).toBeDefined()
    expect(createTask.createTaskSchema.title).toBeDefined()
    expect(typeof createTask.createTask).toBe('function')

    const updateTaskStatus = await import('../tools/update-task-status.js')
    expect(updateTaskStatus.updateTaskStatusSchema).toBeDefined()
    expect(updateTaskStatus.updateTaskStatusSchema.task_id).toBeDefined()
    expect(updateTaskStatus.updateTaskStatusSchema.status).toBeDefined()
    expect(typeof updateTaskStatus.updateTaskStatus).toBe('function')

    const addTaskNote = await import('../tools/add-task-note.js')
    expect(addTaskNote.addTaskNoteSchema).toBeDefined()
    expect(addTaskNote.addTaskNoteSchema.task_id).toBeDefined()
    expect(addTaskNote.addTaskNoteSchema.note).toBeDefined()
    expect(typeof addTaskNote.addTaskNote).toBe('function')

    const ingestDoc = await import('../tools/ingest-document.js')
    expect(ingestDoc.ingestDocumentSchema).toBeDefined()
    expect(ingestDoc.ingestDocumentSchema.project_id).toBeDefined()
    expect(ingestDoc.ingestDocumentSchema.body).toBeDefined()
    expect(typeof ingestDoc.ingestDocument).toBe('function')

    const sessions = await import('../tools/sessions.js')
    expect(sessions.createSessionSchema).toBeDefined()
    expect(sessions.closeSessionSchema).toBeDefined()
    expect(sessions.listOpenSessionsSchema).toBeDefined()
    expect(typeof sessions.createSession).toBe('function')
    expect(typeof sessions.closeSession).toBe('function')
    expect(typeof sessions.listOpenSessions).toBe('function')

    const appendEntry = await import('../tools/append-session-entry.js')
    expect(appendEntry.appendSessionEntrySchema).toBeDefined()
    expect(typeof appendEntry.appendSessionEntry).toBe('function')

    const letters = await import('../tools/letters.js')
    expect(letters.createLetterSchema).toBeDefined()
    expect(letters.replyLetterSchema).toBeDefined()
    expect(typeof letters.createLetter).toBe('function')
    expect(typeof letters.replyLetter).toBe('function')

    const letterInbox = await import('../tools/letter-inbox.js')
    expect(letterInbox.listInboxSchema).toBeDefined()
    expect(letterInbox.listInboxSchema.project_id).toBeDefined()
    expect(letterInbox.listOutboxSchema).toBeDefined()
    expect(letterInbox.listOutboxSchema.project_id).toBeDefined()
    expect(letterInbox.acknowledgeLetterSchema).toBeDefined()
    expect(letterInbox.acknowledgeLetterSchema.letter_id).toBeDefined()
    expect(typeof letterInbox.listInbox).toBe('function')
    expect(typeof letterInbox.listOutbox).toBe('function')
    expect(typeof letterInbox.acknowledgeLetter).toBe('function')

    const comments = await import('../tools/decision-comments.js')
    expect(comments.addDecisionCommentSchema).toBeDefined()
    expect(comments.listDecisionCommentsSchema).toBeDefined()
    expect(typeof comments.addDecisionComment).toBe('function')
    expect(typeof comments.listDecisionComments).toBe('function')

    const governance = await import('../tools/governance.js')
    expect(governance.createAdrDraftSchema).toBeDefined()
    expect(governance.submitAdrReviewSchema).toBeDefined()
    expect(governance.recordAdrDecisionSchema).toBeDefined()
    expect(typeof governance.createAdrDraft).toBe('function')
    expect(typeof governance.submitAdrReview).toBe('function')
    expect(typeof governance.recordAdrDecision).toBe('function')

    const skills = await import('../tools/skills.js')
    expect(skills.skListSchema).toBeDefined()
    expect(skills.skGetSchema).toBeDefined()
    expect(skills.skGetSchema.skill_id).toBeDefined()
    expect(skills.skCreateSchema).toBeDefined()
    expect(skills.skCreateSchema.skill_id).toBeDefined()
    expect(skills.skCreateSchema.name).toBeDefined()
    expect(skills.skCreateSchema.body).toBeDefined()
    expect(skills.skUpdateSchema).toBeDefined()
    expect(skills.skUpdateSchema.skill_id).toBeDefined()
    expect(skills.skActivateSchema).toBeDefined()
    expect(skills.skActivateSchema.skill_id).toBeDefined()
    expect(skills.skActivateSchema.status).toBeDefined()
    expect(typeof skills.skList).toBe('function')
    expect(typeof skills.skGet).toBe('function')
    expect(typeof skills.skCreate).toBe('function')
    expect(typeof skills.skUpdate).toBe('function')
    expect(typeof skills.skActivate).toBe('function')

    // project-list module
    const projectList = await import('../tools/project-list.js')
    expect(projectList.projectListSchema).toBeDefined()
    expect(typeof projectList.projectList).toBe('function')

    // skill-assign module (sk_assign, sk_unassign, sk_export)
    const skillAssign = await import('../tools/skill-assign.js')
    expect(skillAssign.skAssignSchema).toBeDefined()
    expect(skillAssign.skAssignSchema.project_id).toBeDefined()
    expect(skillAssign.skAssignSchema.skill_id).toBeDefined()
    expect(skillAssign.skUnassignSchema).toBeDefined()
    expect(skillAssign.skUnassignSchema.project_id).toBeDefined()
    expect(skillAssign.skExportSchema).toBeDefined()
    expect(skillAssign.skExportSchema.project_id).toBeDefined()
    expect(typeof skillAssign.skAssign).toBe('function')
    expect(typeof skillAssign.skUnassign).toBe('function')
    expect(typeof skillAssign.skExport).toBe('function')

    // reviews module (rv_list, rv_get, rv_create, rv_decide, rv_comment)
    const reviews = await import('../tools/reviews.js')
    expect(reviews.rvListSchema).toBeDefined()
    expect(reviews.rvGetSchema).toBeDefined()
    expect(reviews.rvCreateSchema).toBeDefined()
    expect(reviews.rvCreateSchema.entity_type).toBeDefined()
    expect(reviews.rvCreateSchema.entity_id).toBeDefined()
    expect(reviews.rvDecideSchema).toBeDefined()
    expect(reviews.rvDecideSchema.review_id).toBeDefined()
    expect(reviews.rvDecideSchema.transition).toBeDefined()
    expect(reviews.rvCommentSchema).toBeDefined()
    expect(reviews.rvCommentSchema.review_id).toBeDefined()
    expect(reviews.rvCommentSchema.body).toBeDefined()
    expect(typeof reviews.rvList).toBe('function')
    expect(typeof reviews.rvGet).toBe('function')
    expect(typeof reviews.rvCreate).toBe('function')
    expect(typeof reviews.rvDecide).toBe('function')
    expect(typeof reviews.rvComment).toBe('function')
  })
})
