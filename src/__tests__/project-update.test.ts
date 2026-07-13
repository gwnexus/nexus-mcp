/**
 * Tests for project_update tool.
 *
 * Covers:
 *   - Happy path: readme-only update
 *   - Happy path: description-only update
 *   - Happy path: both fields provided
 *   - Validation error: neither field provided
 *   - API error passthrough
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockApiSuccess, mockApiError, parseToolResponse, TEST_IDS } from './helpers.js'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

describe('project_update', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches readme only', async () => {
    const { nexusPost } = await import('../nexus-api.js')
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ action: 'project_update', project_id: TEST_IDS.projectId, updated: true }),
    )

    const { projectUpdate } = await import('../tools/project-update.js')
    const result = await projectUpdate({
      project_id: TEST_IDS.projectId,
      readme: '# My Project\n\nGreat stuff.',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('project_update')
    expect(parsed.updated).toBe(true)

    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith('/api/mcp/projects', {
      action: 'project_update',
      project_id: TEST_IDS.projectId,
      readme: '# My Project\n\nGreat stuff.',
      description: undefined,
    })
  })

  it('patches description only', async () => {
    const { nexusPost } = await import('../nexus-api.js')
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ action: 'project_update', project_id: TEST_IDS.projectId, updated: true }),
    )

    const { projectUpdate } = await import('../tools/project-update.js')
    const result = await projectUpdate({
      project_id: TEST_IDS.projectId,
      description: 'A short subtitle',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith('/api/mcp/projects', {
      action: 'project_update',
      project_id: TEST_IDS.projectId,
      readme: undefined,
      description: 'A short subtitle',
    })
  })

  it('patches both fields when both are provided', async () => {
    const { nexusPost } = await import('../nexus-api.js')
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ action: 'project_update', project_id: TEST_IDS.projectId, updated: true }),
    )

    const { projectUpdate } = await import('../tools/project-update.js')
    const result = await projectUpdate({
      project_id: TEST_IDS.projectId,
      readme: '# Full readme',
      description: 'Short description',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith('/api/mcp/projects', {
      action: 'project_update',
      project_id: TEST_IDS.projectId,
      readme: '# Full readme',
      description: 'Short description',
    })
  })

  it('returns validation error when neither field is provided', async () => {
    const { nexusPost } = await import('../nexus-api.js')

    const { projectUpdate } = await import('../tools/project-update.js')
    const result = await projectUpdate({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toMatch(/readme or description/)

    // API must NOT be called for validation failures
    expect(vi.mocked(nexusPost)).not.toHaveBeenCalled()
  })

  it('passes through API errors', async () => {
    const { nexusPost } = await import('../nexus-api.js')
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Forbidden', 403))

    const { projectUpdate } = await import('../tools/project-update.js')
    const result = await projectUpdate({
      project_id: TEST_IDS.projectId,
      description: 'Some description',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toBe('Forbidden')
  })
})
