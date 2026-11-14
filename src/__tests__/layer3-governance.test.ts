/**
 * Tests for Layer 3 Governance tools.
 * All tools delegate to the Nexus API via nexusPost().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

describe('Layer 3: ADR Governance tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('createAdrDraft', () => {
    it('should create an ADR draft with auto-incremented number', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'adr_create',
          adr_id: TEST_IDS.adrId,
          adr_number: '0006',
          project_id: TEST_IDS.projectId,
          title: 'New ADR',
          status: 'draft',
        }),
      )

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
      expect(parsed.action).toBe('adr_create')
      expect(parsed.adr_number).toBe('0006')
      expect(parsed.status).toBe('draft')
    })

    it('should return error on API failure', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('Failed to create ADR draft'))

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
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'adr_submit',
          adr_id: TEST_IDS.adrId,
          title: 'ADR to review',
          new_state: 'under_review',
        }),
      )

      const { submitAdrReview } = await import('../tools/governance.js')
      const result = await submitAdrReview({
        adr_id: TEST_IDS.adrId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('adr_submit')
      expect(parsed.new_state).toBe('under_review')
    })

    it('should return error for non-draft ADR', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiError('ADR must be in draft state to submit for review', 409),
      )

      const { submitAdrReview } = await import('../tools/governance.js')
      const result = await submitAdrReview({
        adr_id: TEST_IDS.adrId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })

    it('should return error if ADR not found', async () => {
      vi.mocked(nexusPost).mockResolvedValue(mockApiError('ADR not found', 404))

      const { submitAdrReview } = await import('../tools/governance.js')
      const result = await submitAdrReview({
        adr_id: TEST_IDS.adrId,
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })

  describe('recordAdrDecision', () => {
    it('should accept an ADR under review', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'adr_decide',
          adr_id: TEST_IDS.adrId,
          title: 'Test ADR',
          decision: 'accepted',
          new_state: 'accepted',
        }),
      )

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'accepted',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.action).toBe('adr_decide')
      expect(parsed.decision).toBe('accepted')
      expect(parsed.new_state).toBe('accepted')
    })

    it('should reject an ADR under review', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'adr_decide',
          adr_id: TEST_IDS.adrId,
          title: 'Test ADR',
          decision: 'rejected',
          new_state: 'rejected',
        }),
      )

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

    it('should include superseded_adr in response when accepting with supersedes', async () => {
      const supersededId = '11111111-1111-1111-1111-111111111111'
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'adr_decide',
          adr_id: TEST_IDS.adrId,
          title: 'Superseding ADR',
          decision: 'accepted',
          new_state: 'accepted',
          superseded_adr: supersededId,
        }),
      )

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'accepted',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.superseded_adr).toBe(supersededId)
    })

    it('should accept "superseded" in the decision schema', async () => {
      const { z } = await import('zod')
      const { recordAdrDecisionSchema } = await import('../tools/governance.js')
      const schema = z.object(recordAdrDecisionSchema)
      const adrId = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'
      for (const decision of ['accepted', 'rejected', 'superseded']) {
        expect(schema.safeParse({ adr_id: adrId, decision }).success).toBe(true)
      }
      expect(schema.safeParse({ adr_id: adrId, decision: 'deferred' }).success).toBe(false)
    })

    it('should forward decision "superseded" unchanged and return the hub response', async () => {
      const supersededBy = '22222222-2222-2222-2222-222222222222'
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiSuccess({
          action: 'adr_decide',
          adr_id: TEST_IDS.adrId,
          title: 'Superseded draft',
          decision: 'superseded',
          new_state: 'superseded',
          superseded_by: supersededBy,
        }),
      )

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'superseded',
        rationale: 'Replaced by the newer draft',
        user_id: TEST_IDS.userId,
      })

      expect(nexusPost).toHaveBeenCalledWith('/api/mcp/governance', {
        action: 'adr_decide',
        adr_id: TEST_IDS.adrId,
        decision: 'superseded',
        rationale: 'Replaced by the newer draft',
      })
      expect(result.isError).toBeUndefined()
      const parsed = parseToolResponse(result)
      expect(parsed.new_state).toBe('superseded')
      expect(parsed.superseded_by).toBe(supersededBy)
    })

    it('should return error when no open ADR supersedes the target', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiError('No open ADR supersedes this ADR', 409),
      )

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'superseded',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })

    it('should return error for non-review ADR', async () => {
      vi.mocked(nexusPost).mockResolvedValue(
        mockApiError('ADR must be under review to record a decision', 409),
      )

      const { recordAdrDecision } = await import('../tools/governance.js')
      const result = await recordAdrDecision({
        adr_id: TEST_IDS.adrId,
        decision: 'accepted',
        user_id: TEST_IDS.userId,
      })

      expect(result.isError).toBe(true)
    })
  })
})
