/**
 * Tests for project_list, sk_assign, sk_unassign, and sk_export tools.
 *
 * project_list delegates to GET /api/mcp/projects via nexusGet().
 * sk_assign / sk_unassign / sk_export delegate to POST /api/mcp/skills via nexusPost().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusGet: vi.fn(),
  nexusPost: vi.fn(),
}))

import { nexusGet, nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// project_list
// ---------------------------------------------------------------------------

describe('project_list', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return a list of projects', async () => {
    vi.mocked(nexusGet).mockResolvedValue(
      mockApiSuccess({
        total: 2,
        projects: [
          { id: TEST_IDS.projectId, name: 'Project Alpha', slug: 'alpha' },
          { id: '11111111-1111-1111-1111-111111111111', name: 'Project Beta', slug: 'beta' },
        ],
      }),
    )

    const { projectList } = await import('../tools/project-list.js')
    const result = await projectList({})

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.total).toBe(2)
    expect(parsed.projects).toHaveLength(2)
    expect(parsed.projects[0].name).toBe('Project Alpha')
  })

  it('should return an empty list when no projects exist', async () => {
    vi.mocked(nexusGet).mockResolvedValue(
      mockApiSuccess({
        total: 0,
        projects: [],
      }),
    )

    const { projectList } = await import('../tools/project-list.js')
    const result = await projectList({})

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.total).toBe(0)
    expect(parsed.projects).toHaveLength(0)
  })

  it('should handle API errors gracefully', async () => {
    vi.mocked(nexusGet).mockResolvedValue(mockApiError('Unauthorized', 401))

    const { projectList } = await import('../tools/project-list.js')
    const result = await projectList({})

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toBe('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// sk_assign
// ---------------------------------------------------------------------------

describe('sk_assign', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should assign a skill to a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'sk_assign',
        assignment_id: TEST_IDS.assignmentId,
        project_id: TEST_IDS.projectId,
        skill_id: TEST_IDS.skillId,
        enabled: true,
      }),
    )

    const { skAssign } = await import('../tools/skill-assign.js')
    const result = await skAssign({
      project_id: TEST_IDS.projectId,
      skill_id: 'nx-init-nexus',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('sk_assign')
    expect(parsed.assignment_id).toBe(TEST_IDS.assignmentId)
    expect(parsed.project_id).toBe(TEST_IDS.projectId)
  })

  it('should support pinned_version parameter', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'sk_assign',
        assignment_id: TEST_IDS.assignmentId,
        project_id: TEST_IDS.projectId,
        skill_id: TEST_IDS.skillId,
        pinned_version: 3,
        enabled: true,
      }),
    )

    const { skAssign } = await import('../tools/skill-assign.js')
    const result = await skAssign({
      project_id: TEST_IDS.projectId,
      skill_id: 'nx-init-nexus',
      pinned_version: 3,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.pinned_version).toBe(3)
  })

  it('should return error on duplicate assignment (409)', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Skill already assigned to this project', 409),
    )

    const { skAssign } = await import('../tools/skill-assign.js')
    const result = await skAssign({
      project_id: TEST_IDS.projectId,
      skill_id: 'nx-init-nexus',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toBe('Skill already assigned to this project')
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Internal server error', 500))

    const { skAssign } = await import('../tools/skill-assign.js')
    const result = await skAssign({
      project_id: TEST_IDS.projectId,
      skill_id: 'nx-init-nexus',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sk_unassign
// ---------------------------------------------------------------------------

describe('sk_unassign', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should unassign a skill from a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'sk_unassign',
        project_id: TEST_IDS.projectId,
        skill_id: TEST_IDS.skillId,
        removed: true,
      }),
    )

    const { skUnassign } = await import('../tools/skill-assign.js')
    const result = await skUnassign({
      project_id: TEST_IDS.projectId,
      skill_id: 'nx-init-nexus',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('sk_unassign')
    expect(parsed.removed).toBe(true)
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Assignment not found', 404))

    const { skUnassign } = await import('../tools/skill-assign.js')
    const result = await skUnassign({
      project_id: TEST_IDS.projectId,
      skill_id: 'nx-nonexistent',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sk_export
// ---------------------------------------------------------------------------

describe('sk_export', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should export skills assigned to a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'sk_export',
        project_id: TEST_IDS.projectId,
        count: 2,
        skills: [
          { skill_id: 'nx-init-nexus', name: 'Init Nexus', status: 'active', pinned_version: null },
          { skill_id: 'nx-git-commit', name: 'Git Commit', status: 'active', pinned_version: 2 },
        ],
      }),
    )

    const { skExport } = await import('../tools/skill-assign.js')
    const result = await skExport({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('sk_export')
    expect(parsed.count).toBe(2)
    expect(parsed.skills).toHaveLength(2)
    expect(parsed.skills[0].skill_id).toBe('nx-init-nexus')
  })

  it('should return empty list for a project with no assigned skills', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'sk_export',
        project_id: TEST_IDS.projectId,
        count: 0,
        skills: [],
      }),
    )

    const { skExport } = await import('../tools/skill-assign.js')
    const result = await skExport({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.count).toBe(0)
    expect(parsed.skills).toHaveLength(0)
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Project not found', 404))

    const { skExport } = await import('../tools/skill-assign.js')
    const result = await skExport({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })
})
