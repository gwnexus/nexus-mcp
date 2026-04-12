/**
 * Tests for decision comment tools:
 * - add_decision_comment
 * - list_decision_comments
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../db.js', () => ({
  getServiceClient: vi.fn(),
}))

import { getServiceClient } from '../db.js'

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(result)
  Object.assign(chain, result)
  return chain
}

describe('Decision Comments tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('addDecisionComment', () => {
    it('should add a comment to an existing decision', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        callCount++
        if (table === 'decisions' && callCount === 1) {
          // Verify decision exists
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              title: 'Test ADR',
              project_id: TEST_IDS.projectId,
            },
            error: null,
          })
        }
        if (table === 'decision_comments') {
          // Insert comment
          return mockChain({
            data: {
              id: 'comment-id-1',
              decision_id: TEST_IDS.adrId,
              author_id: TEST_IDS.userId,
              agent_id: null,
              body: 'This is a comment',
              created_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { addDecisionComment } =
        await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'This is a comment',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('add_decision_comment')
      expect(parsed.comment_id).toBe('comment-id-1')
      expect(parsed.decision_id).toBe(TEST_IDS.adrId)
      expect(parsed.decision_title).toBe('Test ADR')
    })

    it('should support agent_id in comment', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        callCount++
        if (table === 'decisions' && callCount === 1) {
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              title: 'ADR',
              project_id: TEST_IDS.projectId,
            },
            error: null,
          })
        }
        if (table === 'decision_comments') {
          return mockChain({
            data: {
              id: 'comment-id-2',
              decision_id: TEST_IDS.adrId,
              author_id: TEST_IDS.userId,
              agent_id: TEST_IDS.agentId,
              body: 'Agent comment',
              created_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { addDecisionComment } =
        await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'Agent comment',
        agent_id: TEST_IDS.agentId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('add_decision_comment')
    })

    it('should return error if decision not found', async () => {
      const fromFn = vi.fn(() => mockChain({ data: null, error: null }))
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { addDecisionComment } =
        await import('../tools/decision-comments.js')
      const result = await addDecisionComment({
        decision_id: TEST_IDS.adrId,
        body: 'Comment',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Decision not found')
    })

    it('should return error on insert failure', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        callCount++
        if (table === 'decisions' && callCount === 1) {
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              title: 'ADR',
              project_id: TEST_IDS.projectId,
            },
            error: null,
          })
        }
        return mockChain({
          data: null,
          error: { message: 'insert failed' },
        })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { addDecisionComment } =
        await import('../tools/decision-comments.js')
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
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        callCount++
        if (table === 'decisions' && callCount === 1) {
          return mockChain({
            data: { id: TEST_IDS.adrId, title: 'Test ADR' },
            error: null,
          })
        }
        if (table === 'decision_comments') {
          return mockChain({
            data: [
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
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listDecisionComments } =
        await import('../tools/decision-comments.js')
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
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        callCount++
        if (table === 'decisions' && callCount === 1) {
          return mockChain({
            data: { id: TEST_IDS.adrId, title: 'ADR' },
            error: null,
          })
        }
        return mockChain({ data: [], error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listDecisionComments } =
        await import('../tools/decision-comments.js')
      const result = await listDecisionComments({
        decision_id: TEST_IDS.adrId,
      })

      const parsed = parseToolResponse(result)
      expect(parsed.total).toBe(0)
      expect(parsed.comments).toHaveLength(0)
    })

    it('should return error if decision not found', async () => {
      const fromFn = vi.fn(() => mockChain({ data: null, error: null }))
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { listDecisionComments } =
        await import('../tools/decision-comments.js')
      const result = await listDecisionComments({
        decision_id: TEST_IDS.adrId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('Decision not found')
    })
  })
})
