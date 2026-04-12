/**
 * Supabase mock builder for MCP tool tests.
 *
 * Provides a chainable mock that simulates the Supabase PostgREST
 * query builder API: .from().select().eq().single() etc.
 *
 * Usage:
 *   const mock = createMockDb()
 *   mock.mockTable('tasks', { data: [...], error: null })
 *   vi.mocked(getServiceClient).mockReturnValue(mock.client)
 */

import { vi } from 'vitest'

type MockResult = {
  data: unknown
  error: { message: string; code?: string } | null
}

type ChainMethod =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'eq'
  | 'neq'
  | 'not'
  | 'in'
  | 'order'
  | 'limit'
  | 'single'
  | 'maybeSingle'
  | 'textSearch'
  | 'or'
  | 'ilike'

/**
 * Creates a chainable Supabase query builder mock.
 * Each table returns the configured result when the chain resolves.
 */
export function createMockDb() {
  const tableResults = new Map<string, MockResult>()

  // Second-level result for chained operations (e.g., insert().select().single())
  const tableSecondResults = new Map<string, MockResult>()

  function createChain(
    tableName: string,
    isSecond = false,
  ): Record<string, unknown> {
    const resultMap = isSecond ? tableSecondResults : tableResults
    const result = resultMap.get(tableName) ?? { data: null, error: null }

    const chain: Record<string, unknown> = {}

    const chainMethods: ChainMethod[] = [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'neq',
      'not',
      'in',
      'order',
      'limit',
      'single',
      'maybeSingle',
      'textSearch',
      'or',
      'ilike',
    ]

    for (const method of chainMethods) {
      if (method === 'single' || method === 'maybeSingle') {
        // Terminal methods return the result directly
        chain[method] = vi.fn().mockReturnValue(result)
      } else if (method === 'select' && isSecond === false) {
        // After insert/update, .select() starts a second chain
        chain[method] = vi
          .fn()
          .mockReturnValue(
            tableSecondResults.has(tableName)
              ? createChain(tableName, true)
              : createChain(tableName, false),
          )
      } else {
        chain[method] = vi.fn().mockReturnValue(chain)
      }
    }

    // Make the chain itself resolve as a promise-like with the result
    // (for queries that don't end with .single())
    chain.then = (resolve: (v: MockResult) => void) => {
      resolve(result)
      return chain
    }

    // Add data/error directly for non-chained access
    Object.assign(chain, result)

    return chain
  }

  const fromFn = vi.fn((tableName: string) => createChain(tableName))

  const authAdmin = {
    getUserById: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          app_metadata: { platform_role: 'platform_admin' },
        },
      },
    }),
  }

  const client = {
    from: fromFn,
    auth: { admin: authAdmin },
  }

  return {
    client: client as unknown as ReturnType<
      typeof import('../db.js').getServiceClient
    >,

    /**
     * Configure the mock result for a table query.
     * This result is returned when the chain resolves (via .single() or direct access).
     */
    mockTable(tableName: string, result: MockResult) {
      tableResults.set(tableName, result)
    },

    /**
     * Configure a second-level result for chained operations.
     * E.g., .insert({}).select().single() uses the second result.
     */
    mockTableSecond(tableName: string, result: MockResult) {
      tableSecondResults.set(tableName, result)
    },

    /**
     * Configure a table to return an error.
     */
    mockTableError(tableName: string, message: string) {
      tableResults.set(tableName, { data: null, error: { message } })
    },

    /**
     * Reset all table mocks.
     */
    reset() {
      tableResults.clear()
      tableSecondResults.clear()
      fromFn.mockClear()
    },

    /**
     * Get the underlying from() mock for assertions.
     */
    get fromFn() {
      return fromFn
    },

    /**
     * Get the auth.admin mock for assertions.
     */
    get authAdmin() {
      return authAdmin
    },
  }
}

/**
 * Helper to parse the JSON from an MCP tool response.
 */
export function parseToolResponse(result: {
  content: { type: string; text: string }[]
  isError?: boolean
}) {
  const text = result.content[0]?.text
  if (!text) throw new Error('Empty tool response')
  return JSON.parse(text)
}

/**
 * Standard test UUIDs for consistency across tests.
 */
export const TEST_IDS = {
  userId: '83a37012-8add-428f-8bc3-d56c84291671',
  projectId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  sessionId: '11111111-2222-3333-4444-555555555555',
  taskId: '22222222-3333-4444-5555-666666666666',
  letterId: '33333333-4444-5555-6666-777777777777',
  adrId: '44444444-5555-6666-7777-888888888888',
  entryId: '55555555-6666-7777-8888-999999999999',
  noteId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  documentId: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
  agentId: 'nexus-app-agent',
  otherUserId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
  skillId: '88888888-9999-aaaa-bbbb-cccccccccccc',
  tenantId: '20c72e35-d4d8-4e40-a7be-efff14d8eaff',
}
