/**
 * Tests for Layer 1 Knowledge Access tools:
 * - search_knowledge
 * - get_project_memory
 * - get_document
 * - get_related_entities
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
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.not = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.or = vi.fn().mockReturnValue(chain)
  chain.ilike = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(result)
  chain.maybeSingle = vi.fn().mockReturnValue(result)
  chain.textSearch = vi.fn().mockReturnValue(chain)
  Object.assign(chain, result)
  return chain
}

describe('Layer 1: search_knowledge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return matching results for keyword search', async () => {
    const fromFn = vi.fn((table: string) => {
      if (table === 'tasks') {
        return mockChain({
          data: [
            {
              id: TEST_IDS.taskId,
              title: 'Fix authentication bug',
              description: 'The auth flow has a bug in login',
              status: 'open',
              created_at: '2026-04-12T00:00:00Z',
            },
          ],
          error: null,
        })
      }
      // Other tables return empty
      return mockChain({ data: [], error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'authentication bug',
      project_id: TEST_IDS.projectId,
      entity_types: ['task'],
    })

    expect('isError' in result).toBe(false)
    const parsed = parseToolResponse(result)
    expect(parsed.total_results).toBeGreaterThan(0)
    expect(parsed.results[0].entity_type).toBe('task')
    expect(parsed.results[0].entity_id).toBe(TEST_IDS.taskId)
  })

  it('should return empty results when no matches', async () => {
    const fromFn = vi.fn(() => mockChain({ data: [], error: null }))
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'nonexistent term xyz123',
      project_id: TEST_IDS.projectId,
    })

    const parsed = parseToolResponse(result)
    expect(parsed.total_results).toBe(0)
    expect(parsed.results).toEqual([])
  })

  it('should search all entity types when none specified', async () => {
    const calledTables: string[] = []
    const fromFn = vi.fn((table: string) => {
      calledTables.push(table)
      return mockChain({ data: [], error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    await searchKnowledge({
      query: 'test',
      project_id: TEST_IDS.projectId,
    })

    // Should search all 7 entity tables
    expect(calledTables).toContain('sessions')
    expect(calledTables).toContain('decisions')
    expect(calledTables).toContain('letters')
    expect(calledTables).toContain('tasks')
    expect(calledTables).toContain('research_notes')
    expect(calledTables).toContain('planning_items')
    expect(calledTables).toContain('ingest_items')
  })

  it('should rank exact matches above partial matches', async () => {
    const fromFn = vi.fn((table: string) => {
      if (table === 'tasks') {
        return mockChain({
          data: [
            {
              id: 'task-partial',
              title: 'Fix the auth',
              description: 'Partial match',
              status: 'open',
              created_at: '2026-04-12T00:00:00Z',
            },
            {
              id: 'task-exact',
              title: 'Fix the auth flow',
              description: 'Exact match on both terms',
              status: 'open',
              created_at: '2026-04-11T00:00:00Z',
            },
          ],
          error: null,
        })
      }
      return mockChain({ data: [], error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'auth flow',
      project_id: TEST_IDS.projectId,
      entity_types: ['task'],
    })

    const parsed = parseToolResponse(result)
    expect(parsed.total_results).toBe(2)
    // Exact match should come first
    expect(parsed.results[0].entity_id).toBe('task-exact')
    expect(parsed.results[0].relevance).toBe('exact')
    expect(parsed.results[1].relevance).toBe('partial')
  })

  it('should handle DB errors gracefully', async () => {
    const fromFn = vi.fn(() =>
      mockChain({ data: null, error: { message: 'connection lost' } }),
    )
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { searchKnowledge } = await import('../tools/search-knowledge.js')
    const result = await searchKnowledge({
      query: 'test',
      project_id: TEST_IDS.projectId,
    })

    // Should not throw, just return empty results
    const parsed = parseToolResponse(result)
    expect(parsed.total_results).toBe(0)
  })
})

describe('Layer 1: get_project_memory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return curated project context', async () => {
    const fromFn = vi.fn((table: string) => {
      if (table === 'decisions') {
        return mockChain({
          data: [
            {
              id: TEST_IDS.adrId,
              title: 'ADR-001',
              lifecycle_state: 'accepted',
            },
          ],
          error: null,
        })
      }
      if (table === 'tasks') {
        return mockChain({
          data: [{ id: TEST_IDS.taskId, title: 'Open task', status: 'open' }],
          error: null,
        })
      }
      return mockChain({ data: [], error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { getProjectMemory } = await import('../tools/get-project-memory.js')
    const result = await getProjectMemory({
      project_id: TEST_IDS.projectId,
      include: ['adrs', 'active_tasks'],
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.project_id).toBe(TEST_IDS.projectId)
  })

  it('should respect depth parameter', async () => {
    const fromFn = vi.fn(() => mockChain({ data: [], error: null }))
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { getProjectMemory } = await import('../tools/get-project-memory.js')
    const result = await getProjectMemory({
      project_id: TEST_IDS.projectId,
      include: ['adrs'],
      depth: 'light',
    })

    expect(result.isError).toBeUndefined()
  })
})

describe('Layer 1: get_document', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch a session with child entries', async () => {
    const fromFn = vi.fn((table: string) => {
      if (table === 'sessions') {
        return mockChain({
          data: {
            id: TEST_IDS.sessionId,
            title: 'Test Session',
            status: 'open',
            summary: 'Session summary',
            created_at: '2026-04-12T00:00:00Z',
          },
          error: null,
        })
      }
      if (table === 'session_entries') {
        return mockChain({
          data: [
            {
              id: TEST_IDS.entryId,
              entry_type: 'note',
              summary: 'A note',
              created_at: '2026-04-12T01:00:00Z',
            },
          ],
          error: null,
        })
      }
      return mockChain({ data: null, error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

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

  it('should return error for unknown entity not found', async () => {
    const fromFn = vi.fn(() =>
      mockChain({ data: null, error: { message: 'not found' } }),
    )
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { getDocument } = await import('../tools/get-document.js')
    const result = await getDocument({
      entity_type: 'session',
      entity_id: TEST_IDS.sessionId,
    })

    expect(result.isError).toBe(true)
  })
})

describe('Layer 1: get_related_entities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return related entities for a session', async () => {
    let callCount = 0
    const fromFn = vi.fn((table: string) => {
      callCount++
      if (table === 'sessions' && callCount === 1) {
        // Source entity lookup
        return mockChain({
          data: {
            id: TEST_IDS.sessionId,
            project_id: TEST_IDS.projectId,
            created_by: TEST_IDS.userId,
            created_at: '2026-04-12T00:00:00Z',
          },
          error: null,
        })
      }
      if (table === 'session_entries') {
        return mockChain({
          data: [
            {
              id: TEST_IDS.entryId,
              linked_entity_type: 'task',
              linked_entity_id: TEST_IDS.taskId,
              entry_type: 'task_created',
            },
          ],
          error: null,
        })
      }
      if (table === 'tasks') {
        return mockChain({
          data: [
            {
              id: TEST_IDS.taskId,
              title: 'Related task',
              status: 'open',
              created_at: '2026-04-12',
            },
          ],
          error: null,
        })
      }
      return mockChain({ data: [], error: null })
    })
    vi.mocked(getServiceClient).mockReturnValue({ from: fromFn } as never)

    const { getRelatedEntities } =
      await import('../tools/get-related-entities.js')
    const result = await getRelatedEntities({
      entity_type: 'session',
      entity_id: TEST_IDS.sessionId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.source.entity_type).toBe('session')
    expect(parsed.source.entity_id).toBe(TEST_IDS.sessionId)
  })
})
