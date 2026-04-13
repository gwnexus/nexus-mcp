/**
 * Tests for review lifecycle tools:
 * - rv_list
 * - rv_get
 * - rv_create
 * - rv_decide
 * - rv_comment
 *
 * All tools delegate to the Nexus API via nexusPost().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// rv_list
// ---------------------------------------------------------------------------

describe('rv_list', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return a list of reviews', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_list',
        count: 2,
        reviews: [
          {
            id: TEST_IDS.reviewId,
            entity_type: 'skill',
            entity_id: TEST_IDS.skillId,
            status: 'pending',
            created_at: '2026-04-12T00:00:00Z',
          },
          {
            id: '22222222-1111-1111-1111-111111111111',
            entity_type: 'agent',
            entity_id: TEST_IDS.agentId,
            status: 'accepted',
            created_at: '2026-04-11T00:00:00Z',
          },
        ],
      }),
    )

    const { rvList } = await import('../tools/reviews.js')
    const result = await rvList({ user_id: TEST_IDS.userId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('rv_list')
    expect(parsed.count).toBe(2)
    expect(parsed.reviews).toHaveLength(2)
    expect(parsed.reviews[0].id).toBe(TEST_IDS.reviewId)
  })

  it('should filter by entity_type', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_list',
        count: 1,
        reviews: [
          {
            id: TEST_IDS.reviewId,
            entity_type: 'skill',
            entity_id: TEST_IDS.skillId,
            status: 'pending',
          },
        ],
      }),
    )

    const { rvList } = await import('../tools/reviews.js')
    const result = await rvList({
      entity_type: 'skill',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.count).toBe(1)
    expect(parsed.reviews[0].entity_type).toBe('skill')

    expect(nexusPost).toHaveBeenCalledWith('/api/mcp/reviews', {
      action: 'rv_list',
      entity_type: 'skill',
      status: undefined,
      limit: undefined,
    })
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Internal server error', 500))

    const { rvList } = await import('../tools/reviews.js')
    const result = await rvList({ user_id: TEST_IDS.userId })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rv_get
// ---------------------------------------------------------------------------

describe('rv_get', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should get a review by review_id', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_get',
        review: {
          id: TEST_IDS.reviewId,
          entity_type: 'skill',
          entity_id: TEST_IDS.skillId,
          status: 'pending',
          created_at: '2026-04-12T00:00:00Z',
          comments: [],
        },
      }),
    )

    const { rvGet } = await import('../tools/reviews.js')
    const result = await rvGet({
      review_id: TEST_IDS.reviewId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('rv_get')
    expect(parsed.review.id).toBe(TEST_IDS.reviewId)
    expect(parsed.review.entity_type).toBe('skill')
  })

  it('should get a review by entity_type and entity_id', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_get',
        review: {
          id: TEST_IDS.reviewId,
          entity_type: 'skill',
          entity_id: TEST_IDS.skillId,
          status: 'pending',
        },
      }),
    )

    const { rvGet } = await import('../tools/reviews.js')
    const result = await rvGet({
      entity_type: 'skill',
      entity_id: TEST_IDS.skillId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.review.entity_type).toBe('skill')
    expect(parsed.review.entity_id).toBe(TEST_IDS.skillId)

    expect(nexusPost).toHaveBeenCalledWith('/api/mcp/reviews', {
      action: 'rv_get',
      review_id: undefined,
      entity_type: 'skill',
      entity_id: TEST_IDS.skillId,
    })
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Review not found', 404))

    const { rvGet } = await import('../tools/reviews.js')
    const result = await rvGet({
      review_id: TEST_IDS.reviewId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rv_create
// ---------------------------------------------------------------------------

describe('rv_create', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should create a review for an entity', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_create',
        review_id: TEST_IDS.reviewId,
        entity_type: 'skill',
        entity_id: TEST_IDS.skillId,
        status: 'pending',
      }),
    )

    const { rvCreate } = await import('../tools/reviews.js')
    const result = await rvCreate({
      entity_type: 'skill',
      entity_id: TEST_IDS.skillId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('rv_create')
    expect(parsed.review_id).toBe(TEST_IDS.reviewId)
    expect(parsed.entity_type).toBe('skill')
    expect(parsed.status).toBe('pending')
  })

  it('should return error on duplicate review (409)', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Review already exists for this entity', 409),
    )

    const { rvCreate } = await import('../tools/reviews.js')
    const result = await rvCreate({
      entity_type: 'skill',
      entity_id: TEST_IDS.skillId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toBe('Review already exists for this entity')
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Entity not found', 404))

    const { rvCreate } = await import('../tools/reviews.js')
    const result = await rvCreate({
      entity_type: 'skill',
      entity_id: TEST_IDS.skillId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rv_decide
// ---------------------------------------------------------------------------

describe('rv_decide', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should accept a review', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_decide',
        review_id: TEST_IDS.reviewId,
        transition: 'accept',
        previous_status: 'pending',
        new_status: 'accepted',
      }),
    )

    const { rvDecide } = await import('../tools/reviews.js')
    const result = await rvDecide({
      review_id: TEST_IDS.reviewId,
      transition: 'accept',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('rv_decide')
    expect(parsed.transition).toBe('accept')
    expect(parsed.new_status).toBe('accepted')
  })

  it('should reject a review with rationale', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_decide',
        review_id: TEST_IDS.reviewId,
        transition: 'reject',
        previous_status: 'pending',
        new_status: 'rejected',
      }),
    )

    const { rvDecide } = await import('../tools/reviews.js')
    const result = await rvDecide({
      review_id: TEST_IDS.reviewId,
      transition: 'reject',
      rationale: 'Does not meet quality standards',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.transition).toBe('reject')
    expect(parsed.new_status).toBe('rejected')

    expect(nexusPost).toHaveBeenCalledWith('/api/mcp/reviews', {
      action: 'rv_decide',
      review_id: TEST_IDS.reviewId,
      transition: 'reject',
      rationale: 'Does not meet quality standards',
    })
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Review must be in pending state', 409),
    )

    const { rvDecide } = await import('../tools/reviews.js')
    const result = await rvDecide({
      review_id: TEST_IDS.reviewId,
      transition: 'accept',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rv_comment
// ---------------------------------------------------------------------------

describe('rv_comment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should add a comment to a review', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_comment',
        comment_id: 'comment-rv-1',
        review_id: TEST_IDS.reviewId,
      }),
    )

    const { rvComment } = await import('../tools/reviews.js')
    const result = await rvComment({
      review_id: TEST_IDS.reviewId,
      body: 'Looks good overall, minor nit on line 42.',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('rv_comment')
    expect(parsed.comment_id).toBe('comment-rv-1')
    expect(parsed.review_id).toBe(TEST_IDS.reviewId)
  })

  it('should support line range for inline comments', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'rv_comment',
        comment_id: 'comment-rv-2',
        review_id: TEST_IDS.reviewId,
        line_start: 10,
        line_end: 15,
      }),
    )

    const { rvComment } = await import('../tools/reviews.js')
    const result = await rvComment({
      review_id: TEST_IDS.reviewId,
      body: 'This block could be simplified.',
      line_start: 10,
      line_end: 15,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.line_start).toBe(10)
    expect(parsed.line_end).toBe(15)

    expect(nexusPost).toHaveBeenCalledWith('/api/mcp/reviews', {
      action: 'rv_comment',
      review_id: TEST_IDS.reviewId,
      body: 'This block could be simplified.',
      agent_id: undefined,
      line_start: 10,
      line_end: 15,
    })
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Review not found', 404))

    const { rvComment } = await import('../tools/reviews.js')
    const result = await rvComment({
      review_id: TEST_IDS.reviewId,
      body: 'Comment on missing review',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})
