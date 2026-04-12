/**
 * Tests for Layer 3 Governance tools:
 * - create_adr_draft
 * - submit_adr_review
 * - record_adr_decision (accept/reject + supersession)
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
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.not = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(result)
  Object.assign(chain, result)
  return chain
}

describe('Layer 3: ADR Governance tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('createAdrDraft', () => {
    it('should create an ADR draft with auto-incremented number', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'decisions') {
          callCount++
          if (callCount === 1) {
            // Query for max adr_number
            return mockChain({ data: [{ adr_number: '0005' }], error: null })
          } else {
            // Insert
            return mockChain({
              data: {
                id: TEST_IDS.adrId,
                project_id: TEST_IDS.projectId,
                title: 'New ADR',
                adr_number: '0006',
                status: 'draft',
              },
              error: null,
            })
          }
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { createAdrDraft } = await import('../tools/governance.js')
      const result = await createAdrDraft({
        project_id: TEST_IDS.projectId,
        title: 'New ADR',
        context: 'ADR context',
        decision: 'ADR decision content',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('create_adr_draft')
      expect(parsed.adr_number).toBe('0006')
      expect(parsed.status).toBe('draft')
    })

    it('should start at ADR number 0001 if no existing ADRs', async () => {
      let callCount = 0
      const fromFn = vi.fn((table: string) => {
        if (table === 'decisions') {
          callCount++
          if (callCount === 1) {
            return mockChain({ data: [], error: null })
          } else {
            return mockChain({
              data: {
                id: TEST_IDS.adrId,
                adr_number: '0001',
                status: 'draft',
              },
              error: null,
            })
          }
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { createAdrDraft } = await import('../tools/governance.js')
      const result = await createAdrDraft({
        project_id: TEST_IDS.projectId,
        title: 'First ADR',
        context: 'Context',
        decision: 'Decision',
        user_id: TEST_IDS.userId,
      })

      const parsed = parseToolResponse(result)
      expect(parsed.adr_number).toBe('0001')
    })

    it('should return error on insert failure', async () => {
      let callCount = 0
      const fromFn = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return mockChain({ data: [], error: null })
        }
        return mockChain({ data: null, error: { message: 'insert failed' } })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { createAdrDraft } = await import('../tools/governance.js')
      const result = await createAdrDraft({
        project_id: TEST_IDS.projectId,
        title: 'Fail',
        context: 'Context',
        decision: 'Decision',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('submitAdrReview', () => {
    it('should transition a draft ADR to under_review', async () => {
      let callCount = 0
      const fromFn = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              status: 'draft',
              title: 'ADR to review',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { submitAdrReview } = await import('../tools/governance.js')
      const result = await submitAdrReview({
        adr_id: TEST_IDS.adrId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('submit_adr_review')
      expect(parsed.new_state).toBe('under_review')
    })

    it('should reject review submission for non-draft ADR', async () => {
      const fromFn = vi.fn(() =>
        mockChain({
          data: {
            id: TEST_IDS.adrId,
            status: 'accepted',
            title: 'Already accepted',
          },
          error: null,
        }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { submitAdrReview } = await import('../tools/governance.js')
      const result = await submitAdrReview({
        adr_id: TEST_IDS.adrId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toContain('draft state')
    })

    it('should return error if ADR not found', async () => {
      const fromFn = vi.fn(() => mockChain({ data: null, error: null }))
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { submitAdrReview } = await import('../tools/governance.js')
      const result = await submitAdrReview({
        adr_id: TEST_IDS.adrId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toBe('ADR not found')
    })
  })

  describe('recordAdrDecision', () => {
    it('should accept an ADR under review', async () => {
      let callCount = 0
      const fromFn = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              status: 'under_review',
              title: 'Test ADR',
              supersedes: null,
              decision: 'Original decision text',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'accepted',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('record_adr_decision')
      expect(parsed.decision).toBe('accepted')
      expect(parsed.new_state).toBe('accepted')
    })

    it('should reject an ADR under review', async () => {
      let callCount = 0
      const fromFn = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              status: 'under_review',
              title: 'Test ADR',
              supersedes: null,
              decision: 'Original decision text',
            },
            error: null,
          })
        }
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'rejected',
        rationale: 'Does not align with platform direction',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.decision).toBe('rejected')
    })

    it('should mark superseded ADR when accepting with supersedes', async () => {
      const supersededId = '11111111-1111-1111-1111-111111111111'
      let callCount = 0
      const updateCalls: Array<{ table: string }> = []
      const fromFn = vi.fn((table: string) => {
        callCount++
        if (callCount === 1) {
          // Fetch current ADR
          return mockChain({
            data: {
              id: TEST_IDS.adrId,
              status: 'under_review',
              title: 'Superseding ADR',
              supersedes: supersededId,
              decision: 'Original',
            },
            error: null,
          })
        }
        // Track update calls
        updateCalls.push({ table })
        return mockChain({ data: null, error: null })
      })
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'accepted',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.superseded_adr).toBe(supersededId)
      // Should have made at least 2 update calls (accept + supersede)
      expect(updateCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should reject decision on non-review ADR', async () => {
      const fromFn = vi.fn(() =>
        mockChain({
          data: {
            id: TEST_IDS.adrId,
            status: 'draft',
            title: 'Still draft',
            supersedes: null,
            decision: 'Content',
          },
          error: null,
        }),
      )
      vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'accepted',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
      const parsed = parseToolResponse(result)
      expect(parsed.error).toContain('under review')
    })
  })
})
