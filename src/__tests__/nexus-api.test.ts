/**
 * Tests for src/nexus-api.ts
 *
 * Covers:
 * - X-Nexus-Machine-Id header is sent automatically when machine_id is available
 * - Custom headers parameter is forwarded
 * - nexusPost convenience works correctly
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock machine-id module before importing nexus-api
vi.mock('../machine-id.js', () => ({
  getMachineId: vi.fn(() => 'test-machine-uuid-1234'),
  resetMachineId: vi.fn(),
}))

describe('nexus-api: header injection', () => {
  let nexusApi: typeof import('../nexus-api.js').nexusApi
  let nexusPost: typeof import('../nexus-api.js').nexusPost
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    process.env.NEXUS_API_URL = 'https://test.nexus.example.com'
    process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_test-token-for-header-tests-abc'

    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ action: 'test' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const mod = await import('../nexus-api.js')
    nexusApi = mod.nexusApi
    nexusPost = mod.nexusPost
    mod.resetApiConfig()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should include X-Nexus-Machine-Id header in requests', async () => {
    await nexusApi('/api/mcp/sessions', { method: 'POST', body: { action: 'test' } })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers['X-Nexus-Machine-Id']).toBe('test-machine-uuid-1234')
  })

  it('should include Authorization and Content-Type headers', async () => {
    await nexusApi('/api/mcp/sessions')

    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers['Authorization']).toBe(
      'Bearer nxs_pat_test-token-for-header-tests-abc',
    )
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  it('should merge custom headers with defaults', async () => {
    await nexusApi('/api/mcp/sessions', {
      method: 'POST',
      body: { action: 'test' },
      headers: { 'X-Nexus-Toolstack': 'opencode v0.3.0' },
    })

    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers['X-Nexus-Machine-Id']).toBe('test-machine-uuid-1234')
    expect(opts.headers['X-Nexus-Toolstack']).toBe('opencode v0.3.0')
  })

  it('should allow custom headers to override machine-id', async () => {
    await nexusApi('/api/mcp/sessions', {
      headers: { 'X-Nexus-Machine-Id': 'override-id' },
    })

    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers['X-Nexus-Machine-Id']).toBe('override-id')
  })

  it('nexusPost should also include machine-id header', async () => {
    await nexusPost('/api/mcp/sessions', { action: 'session_create' })

    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers['X-Nexus-Machine-Id']).toBe('test-machine-uuid-1234')
    expect(opts.method).toBe('POST')
  })
})

describe('nexus-api: no machine-id available', () => {
  beforeEach(async () => {
    vi.resetModules()
    // Re-mock with null return
    vi.doMock('../machine-id.js', () => ({
      getMachineId: vi.fn(() => null),
      resetMachineId: vi.fn(),
    }))

    process.env.NEXUS_API_URL = 'https://test.nexus.example.com'
    process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_test-token-no-machine-id-abcde'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should not include X-Nexus-Machine-Id header when machine_id is null', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ action: 'test' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const mod = await import('../nexus-api.js')
    mod.resetApiConfig()

    await mod.nexusApi('/api/mcp/sessions')

    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers).not.toHaveProperty('X-Nexus-Machine-Id')
  })
})
