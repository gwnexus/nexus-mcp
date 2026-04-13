/**
 * Tests for task_list and doc_list tools.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// task_list
// ---------------------------------------------------------------------------

describe('task_list', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should list tasks for a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'task_list',
        project_id: TEST_IDS.projectId,
        count: 2,
        tasks: [
          {
            id: TEST_IDS.taskId,
            title: 'Implement feature',
            status: 'open',
            priority: 'high',
          },
          {
            id: TEST_IDS.noteId,
            title: 'Fix bug',
            status: 'in_progress',
            priority: 'normal',
          },
        ],
      }),
    )

    const { listTasks } = await import('../tools/list-tasks.js')
    const result = await listTasks({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('task_list')
    expect(parsed.count).toBe(2)
    expect(parsed.tasks).toHaveLength(2)
  })

  it('should pass status_filter to API', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'task_list',
        project_id: TEST_IDS.projectId,
        count: 1,
        tasks: [
          { id: TEST_IDS.taskId, title: 'Open task', status: 'open' },
        ],
      }),
    )

    const { listTasks } = await import('../tools/list-tasks.js')
    await listTasks({
      project_id: TEST_IDS.projectId,
      status_filter: ['open', 'in_progress'],
      user_id: TEST_IDS.userId,
    })

    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith('/api/mcp/tasks', {
      action: 'task_list',
      project_id: TEST_IDS.projectId,
      status_filter: ['open', 'in_progress'],
      limit: 50,
    })
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Project not found', 404))

    const { listTasks } = await import('../tools/list-tasks.js')
    const result = await listTasks({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })

  it('should handle empty task list', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'task_list',
        project_id: TEST_IDS.projectId,
        count: 0,
        tasks: [],
      }),
    )

    const { listTasks } = await import('../tools/list-tasks.js')
    const result = await listTasks({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.count).toBe(0)
    expect(parsed.tasks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// doc_list
// ---------------------------------------------------------------------------

describe('doc_list', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should list documents for a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'doc_list',
        project_id: TEST_IDS.projectId,
        count: 2,
        documents: [
          {
            id: TEST_IDS.documentId,
            title: 'Research Findings',
            source: 'agent:app-agent',
            classification: 'unclassified',
          },
          {
            id: TEST_IDS.noteId,
            title: 'E2E Test Plan',
            source: 'mcp',
            classification: 'unclassified',
          },
        ],
      }),
    )

    const { listDocuments } = await import('../tools/list-documents.js')
    const result = await listDocuments({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('doc_list')
    expect(parsed.count).toBe(2)
    expect(parsed.documents).toHaveLength(2)
  })

  it('should pass source filter to API', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'doc_list',
        project_id: TEST_IDS.projectId,
        count: 1,
        documents: [
          { id: TEST_IDS.documentId, title: 'Agent doc', source: 'agent:app-agent' },
        ],
      }),
    )

    const { listDocuments } = await import('../tools/list-documents.js')
    await listDocuments({
      project_id: TEST_IDS.projectId,
      source: 'agent:app-agent',
      user_id: TEST_IDS.userId,
    })

    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith('/api/mcp/documents', {
      action: 'doc_list',
      project_id: TEST_IDS.projectId,
      source: 'agent:app-agent',
      limit: 50,
    })
  })

  it('should return error on API failure', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('No access to this project', 403))

    const { listDocuments } = await import('../tools/list-documents.js')
    const result = await listDocuments({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
  })

  it('should handle empty document list', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'doc_list',
        project_id: TEST_IDS.projectId,
        count: 0,
        documents: [],
      }),
    )

    const { listDocuments } = await import('../tools/list-documents.js')
    const result = await listDocuments({
      project_id: TEST_IDS.projectId,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.count).toBe(0)
    expect(parsed.documents).toHaveLength(0)
  })
})
