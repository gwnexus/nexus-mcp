/**
 * Tests for Layer 1 Knowledge Access tools:
 * - search_knowledge
 * - get_project_memory
 * - get_document
 * - get_related_entities
 *
 * All tools now delegate to the Nexus API via nexusPost().
 * Tests mock the nexus-api module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// search_knowledge
// ---------------------------------------------------------------------------

describe('Layer 1: search_knowledge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return matching results for keyword search', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        total_results: 1,
        results: [
          {
            entity_type: 'task',
            entity_id: TEST_IDS.taskId,
            title: 'Fix authentication bug',
            relevance: 'exact',
          },
        ],
      }),
    )

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'authentication bug',
      project_id: TEST_IDS.projectId,
      entity_types: ['task'],
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.total_results).toBe(1)
    expect(parsed.results[0].entity_type).toBe('task')
    expect(parsed.results[0].entity_id).toBe(TEST_IDS.taskId)
  })

  it('should return empty results when no matches', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ total_results: 0, results: [] }),
    )

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'nonexistent term xyz123',
      project_id: TEST_IDS.projectId,
    })

    const parsed = parseToolResponse(result)
    expect(parsed.total_results).toBe(0)
    expect(parsed.results).toEqual([])
  })

  it('should pass correct parameters to the API', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ total_results: 0, results: [] }),
    )

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    await searchKnowledge({
      query: 'test',
      project_id: TEST_IDS.projectId,
      entity_types: ['task', 'decision'],
      search_mode: 'hybrid',
      limit: 5,
    })

    expect(nexusPost).toHaveBeenCalledWith('/api/mcp/search', {
      project_id: TEST_IDS.projectId,
      query: 'test',
      entity_types: ['task', 'decision'],
      search_mode: 'hybrid',
      limit: 5,
    })
  })

  it('should handle API errors gracefully', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('connection lost'))

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'test',
      project_id: TEST_IDS.projectId,
    })

    expect(result.isError).toBe(true)
    const parsed = parseToolResponse(result)
    expect(parsed.error).toBe('connection lost')
  })
})

// ---------------------------------------------------------------------------
// get_project_memory
// ---------------------------------------------------------------------------

describe('Layer 1: get_project_memory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return curated project context', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        project_id: TEST_IDS.projectId,
        depth: 'standard',
        categories_included: ['adrs', 'active_tasks'],
        memory: {
          project: { id: TEST_IDS.projectId, name: 'Test Project' },
          adrs: [{ id: TEST_IDS.adrId, title: 'ADR-001', status: 'accepted' }],
          active_tasks: [{ id: TEST_IDS.taskId, title: 'Open task', status: 'open' }],
        },
      }),
    )

    const { getProjectMemory } = await import('../tools/get-project-memory.js')
    const result = await getProjectMemory({
      project_id: TEST_IDS.projectId,
      include: ['adrs', 'active_tasks'],
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.project_id).toBe(TEST_IDS.projectId)
    expect(parsed.memory.adrs).toHaveLength(1)
    expect(parsed.memory.active_tasks).toHaveLength(1)
  })

  it('should pass depth parameter to the API', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ project_id: TEST_IDS.projectId, depth: 'light', memory: {} }),
    )

    const { getProjectMemory } = await import('../tools/get-project-memory.js')
    await getProjectMemory({
      project_id: TEST_IDS.projectId,
      include: ['adrs'],
      depth: 'light',
    })

    expect(nexusPost).toHaveBeenCalledWith('/api/mcp/memory', {
      project_id: TEST_IDS.projectId,
      include: ['adrs'],
      depth: 'light',
    })
  })

  it('should handle API errors', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Project not found'))

    const { getProjectMemory } = await import('../tools/get-project-memory.js')
    const result = await getProjectMemory({
      project_id: TEST_IDS.projectId,
      include: ['adrs'],
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// get_document
// ---------------------------------------------------------------------------

describe('Layer 1: get_document', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch a document in structured mode', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        entity_type: 'session',
        entity_id: TEST_IDS.sessionId,
        document: { id: TEST_IDS.sessionId, title: 'Test Session', status: 'open' },
        entries: [{ id: TEST_IDS.entryId, entry_type: 'note', summary: 'A note' }],
      }),
    )

    const { getDocument } = await import('../tools/get-document.js')
    const result = await getDocument({
      entity_type: 'session',
      entity_id: TEST_IDS.sessionId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.entity_type).toBe('session')
    expect(parsed.entity_id).toBe(TEST_IDS.sessionId)
  })

  it('should fetch a document in markdown mode', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        entity_type: 'decision',
        entity_id: TEST_IDS.adrId,
        format: 'markdown',
        content: '# ADR-001\n\nSome content',
      }),
    )

    const { getDocument } = await import('../tools/get-document.js')
    const result = await getDocument({
      entity_type: 'decision',
      entity_id: TEST_IDS.adrId,
      render_mode: 'markdown',
    })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('# ADR-001')
  })

  it('should return error for not found entity', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Document not found', 404))

    const { getDocument } = await import('../tools/get-document.js')
    const result = await getDocument({
      entity_type: 'session',
      entity_id: TEST_IDS.sessionId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// get_related_entities
// ---------------------------------------------------------------------------

describe('Layer 1: get_related_entities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return related entities for a session', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        source: {
          entity_type: 'session',
          entity_id: TEST_IDS.sessionId,
          project_id: TEST_IDS.projectId,
        },
        total_related: 1,
        related: [
          {
            relation: 'task_in_project',
            entity_type: 'task',
            entity_id: TEST_IDS.taskId,
            title: 'Related task',
            status: 'open',
            created_at: '2026-04-12',
          },
        ],
      }),
    )

    const { getRelatedEntities } = await import('../tools/get-related-entities.js')
    const result = await getRelatedEntities({
      entity_type: 'session',
      entity_id: TEST_IDS.sessionId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.source.entity_type).toBe('session')
    expect(parsed.source.entity_id).toBe(TEST_IDS.sessionId)
    expect(parsed.total_related).toBe(1)
    expect(parsed.related[0].entity_type).toBe('task')
  })

  it('should handle API errors', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Entity not found', 404))

    const { getRelatedEntities } = await import('../tools/get-related-entities.js')
    const result = await getRelatedEntities({
      entity_type: 'session',
      entity_id: TEST_IDS.sessionId,
    })

    expect(result.isError).toBe(true)
  })
})
