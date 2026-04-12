/**
 * Tests for src/mcp/auth.ts
 *
 * Covers:
 * - initIdentity() with valid/invalid tokens
 * - getIdentity() before/after init
 * - validateProjectAgent()
 * - checkProjectAccess()
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock db module before importing auth
vi.mock('../db.js', () => ({
  getServiceClient: vi.fn(),
}))

import { getServiceClient } from '../db.js'
import { TEST_IDS } from './helpers'

// We need to re-import auth fresh for each test to reset module state
// Use dynamic import pattern

function createMockDbClient(overrides: {
  keyRow?: Record<string, unknown> | null
  keyError?: { message: string } | null
  profile?: { display_name: string } | null
  authUser?: Record<string, unknown> | null
}) {
  const chainResult = (data: unknown, error: unknown = null) => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockReturnValue({ data, error })
    chain.update = vi.fn().mockReturnValue(chain)
    return chain
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'api_keys') {
        const chain = chainResult(
          overrides.keyRow ?? null,
          overrides.keyError ?? null,
        )
        // Also need update chain for last_used_at
        const updateChain: Record<string, unknown> = {}
        updateChain.eq = vi.fn().mockReturnValue({ data: null, error: null })
        chain.update = vi.fn().mockReturnValue(updateChain)
        return chain
      }
      if (table === 'profiles') {
        return chainResult(overrides.profile ?? null)
      }
      if (table === 'project_agents') {
        return chainResult(null)
      }
      if (table === 'project_memberships') {
        return chainResult(null)
      }
      return chainResult(null)
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: {
            user: overrides.authUser ?? {
              id: TEST_IDS.userId,
              email: 'test@example.com',
              app_metadata: { platform_role: 'platform_admin' },
            },
          },
        }),
      },
    },
  }
}

describe('MCP Auth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    // Suppress console.error
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('initIdentity', () => {
    it('should resolve identity from a valid token', async () => {
      const mockClient = createMockDbClient({
        keyRow: {
          id: 'key-1',
          user_id: TEST_IDS.userId,
          expires_at: null,
          revoked_at: null,
        },
        profile: { display_name: 'Test User' },
        authUser: {
          id: TEST_IDS.userId,
          email: 'test@example.com',
          app_metadata: { platform_role: 'platform_admin' },
        },
      })

      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN =
        'nxs_pat_valid-test-token-1234567890abcde'

      const { initIdentity } = await import('../auth.js')
      const identity = await initIdentity()

      expect(identity).toBeDefined()
      expect(identity.userId).toBe(TEST_IDS.userId)
      expect(identity.displayName).toBe('Test User')
      expect(identity.email).toBe('test@example.com')
      expect(identity.isPlatformAdmin).toBe(true)
      expect(identity.isPlatformOwner).toBe(false)
    })

    it('should throw if NEXUS_PRIVATE_TOKEN is not set', async () => {
      delete process.env.NEXUS_PRIVATE_TOKEN

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow(
        'NEXUS_PRIVATE_TOKEN is not set',
      )
    })

    it('should throw if token does not start with nxs_pat_', async () => {
      const mockClient = createMockDbClient({ keyRow: null })
      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'invalid_prefix_token'

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow('could not be resolved')
    })

    it('should throw if token is not found in api_keys', async () => {
      const mockClient = createMockDbClient({
        keyRow: null,
        keyError: { message: 'not found' },
      })
      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_unknown-token-12345678901234'

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow('could not be resolved')
    })

    it('should throw if token is revoked', async () => {
      const mockClient = createMockDbClient({
        keyRow: {
          id: 'key-1',
          user_id: TEST_IDS.userId,
          expires_at: null,
          revoked_at: '2026-01-01T00:00:00Z',
        },
      })
      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_revoked-token-12345678901234'

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow('could not be resolved')
    })

    it('should throw if token is expired', async () => {
      const mockClient = createMockDbClient({
        keyRow: {
          id: 'key-1',
          user_id: TEST_IDS.userId,
          expires_at: '2020-01-01T00:00:00Z',
          revoked_at: null,
        },
      })
      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_expired-token-12345678901234'

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow('could not be resolved')
    })

    it('should resolve non-admin identity correctly', async () => {
      const mockClient = createMockDbClient({
        keyRow: {
          id: 'key-1',
          user_id: TEST_IDS.userId,
          expires_at: null,
          revoked_at: null,
        },
        profile: { display_name: 'Regular User' },
        authUser: {
          id: TEST_IDS.userId,
          email: 'regular@example.com',
          app_metadata: { platform_role: 'user' },
        },
      })

      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_regular-user-token-123456789'

      const { initIdentity } = await import('../auth.js')
      const identity = await initIdentity()

      expect(identity.isPlatformAdmin).toBe(false)
      expect(identity.isPlatformOwner).toBe(false)
      expect(identity.displayName).toBe('Regular User')
    })

    it('should resolve platform_owner identity with both admin and owner flags', async () => {
      const mockClient = createMockDbClient({
        keyRow: {
          id: 'key-1',
          user_id: TEST_IDS.userId,
          expires_at: null,
          revoked_at: null,
        },
        profile: { display_name: 'Platform Owner' },
        authUser: {
          id: TEST_IDS.userId,
          email: 'owner@example.com',
          app_metadata: { platform_role: 'platform_owner' },
        },
      })

      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_owner-test-token-12345678901'

      const { initIdentity } = await import('../auth.js')
      const identity = await initIdentity()

      expect(identity.isPlatformAdmin).toBe(true)
      expect(identity.isPlatformOwner).toBe(true)
      expect(identity.displayName).toBe('Platform Owner')
      expect(identity.email).toBe('owner@example.com')
    })
  })

  describe('getIdentity', () => {
    it('should throw if called before initIdentity', async () => {
      const { getIdentity } = await import('../auth.js')
      expect(() => getIdentity()).toThrow('Identity not initialized')
    })

    it('should return cached identity after init', async () => {
      const mockClient = createMockDbClient({
        keyRow: {
          id: 'key-1',
          user_id: TEST_IDS.userId,
          expires_at: null,
          revoked_at: null,
        },
        profile: { display_name: 'Cached User' },
      })

      vi.mocked(getServiceClient).mockReturnValue(mockClient as never)
      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_cached-test-token-1234567890'

      const { initIdentity, getIdentity } = await import('../auth.js')
      await initIdentity()

      const identity = getIdentity()
      expect(identity.userId).toBe(TEST_IDS.userId)
      expect(identity.displayName).toBe('Cached User')
    })
  })
})
