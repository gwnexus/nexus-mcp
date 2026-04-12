/**
 * Tests for decision comment tools.
 * All tools delegate to the Nexus API via nexusPost().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

describe('Decision Comments tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('addDecisionComment', () => {
    it('should add a comment to an existing decision', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'dc_add',
          comment_id: 'comment-id-1',
          decision_id: TEST_IDS.adrId,
          decision_title: 'Test ADR',
          project_id: TEST_IDS.projectId,
        }),
      )

      const { addDecisionComment } = await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'This is a comment',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('dc_add')
      expect(parsed.comment_id).toBe('comment-id-1')
      expect(parsed.decision_id).toBe(TEST_IDS.adrId)
      expect(parsed.decision_title).toBe('Test ADR')
    })

    it('should support agent_id in comment', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'dc_add',
          comment_id: 'comment-id-2',
          decision_id: TEST_IDS.adrId,
          decision_title: 'ADR',
          project_id: TEST_IDS.projectId,
        }),
      )

      const { addDecisionComment } = await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'Agent comment',
        agent_id: TEST_IDS.agentId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      // Verify agent_id was passed to the API
      expect(nexusPost).toHaveBeenCalledWith('/api/mcp/governance', {
        action: 'dc_add',
        decision_id: TEST_IDS.adrId,
        body: 'Agent comment',
        agent_id: TEST_IDS.agentId,
      })
    })

    it('should return error if decision not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Decision not found', 404))

      const { addDecisionComment } = await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'Comment',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Failed to add comment'))

      const { addDecisionComment } = await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'Comment',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('listDecisionComments', () => {
    it('should list comments for a decision', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          decision_id: TEST_IDS.adrId,
          decision_title: 'Test ADR',
          total: 2,
          comments: [
            {
              id: 'c1',
              author_id: TEST_IDS.userId,
              agent_id: null,
              body: 'First comment',
              created_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 'c2',
              author_id: TEST_IDS.userId,
              agent_id: TEST_IDS.agentId,
              body: 'Second comment',
              created_at: '2026-01-01T01:00:00Z',
            },
          ],
        }),
      )

      const { listDecisionComments } = await import('../tools/decision-comments.js')
      const result = await listDecisionComments({
        decision_id: TEST_IDS.adrId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.decision_title).toBe('Test ADR')
      expect(parsed.total).toBe(2)
      expect(parsed.comments).toHaveLength(2)
      expect(parsed.comments[0].body).toBe('First comment')
    })

    it('should return empty list for decision with no comments', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          decision_id: TEST_IDS.adrId,
          decision_title: 'ADR',
          total: 0,
          comments: [],
        }),
      )

      const { listDecisionComments } = await import('../tools/decision-comments.js')
      const result = await listDecisionComments({
        decision_id: TEST_IDS.adrId,
      })

      const parsed = parseToolResponse(result)
      expect(parsed.total).toBe(0)
      expect(parsed.comments).toHaveLength(0)
    })

    it('should return error if decision not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Decision not found', 404))

      const { listDecisionComments } = await import('../tools/decision-comments.js')
      const result = await listDecisionComments({
        decision_id: TEST_IDS.adrId,
      })

      expect(result.isError).toBe(true)
    })
  })
})
