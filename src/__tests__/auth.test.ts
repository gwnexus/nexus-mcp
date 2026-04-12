/**
 * Tests for src/auth.ts
 *
 * Covers:
 * - initIdentity() with valid/invalid tokens
 * - getIdentity() before/after init
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the nexus-api module before importing auth
vi.mock('../nexus-api.js', () => ({
  nexusGet: vi.fn(),
}))

import { nexusGet } from '../nexus-api.js'
import { TEST_IDS } from './helpers'

describe('MCP Auth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    // Suppress console.error
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('initIdentity', () => {
    it('should resolve identity from a valid token', async () => {
      vi.mocked(nexusGet).mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          userId: TEST_IDS.userId,
          email: 'test@example.com',
          displayName: 'Test User',
          isPlatformAdmin: true,
          isPlatformOwner: false,
          tenantId: TEST_IDS.tenantId,
          memberships: [],
          agentAssignments: [],
        },
        error: null,
      })

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

    it('should throw if API returns an error', async () => {
      vi.mocked(nexusGet).mockResolvedValue({
        ok: false,
        status: 401,
        data: null,
        error: 'Invalid token',
      })

      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_invalid-token-123456789012345'

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow(
        'Identity resolution failed',
      )
    })

    it('should throw if API returns null data', async () => {
      vi.mocked(nexusGet).mockResolvedValue({
        ok: true,
        status: 200,
        data: null,
        error: null,
      })

      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_null-data-token-12345678901234'

      const { initIdentity } = await import('../auth.js')
      await expect(initIdentity()).rejects.toThrow(
        'Identity resolution failed',
      )
    })

    it('should resolve platform_owner identity with both admin and owner flags', async () => {
      vi.mocked(nexusGet).mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          userId: TEST_IDS.userId,
          email: 'owner@example.com',
          displayName: 'Platform Owner',
          isPlatformAdmin: true,
          isPlatformOwner: true,
          tenantId: TEST_IDS.tenantId,
          memberships: [],
          agentAssignments: [],
        },
        error: null,
      })

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
      vi.mocked(nexusGet).mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          userId: TEST_IDS.userId,
          email: 'cached@example.com',
          displayName: 'Cached User',
          isPlatformAdmin: false,
          isPlatformOwner: false,
          tenantId: TEST_IDS.tenantId,
          memberships: [],
          agentAssignments: [],
        },
        error: null,
      })

      process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_cached-test-token-1234567890'

      const { initIdentity, getIdentity } = await import('../auth.js')
      await initIdentity()

      const identity = getIdentity()
      expect(identity.userId).toBe(TEST_IDS.userId)
      expect(identity.displayName).toBe('Cached User')
    })
  })
})
