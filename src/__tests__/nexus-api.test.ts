/**
 * Tests for src/nexus-api.ts
 *
 * Covers:
 * - X-Nexus-Machine-Id header is sent automatically when machine_id is available
 * - Custom headers parameter is forwarded
 * - nexusPost convenience works correctly
 * - Error handling keeps the HTTP status for empty and non-JSON bodies
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Build a real fetch Response with a JSON body (fresh per call). */
function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  })
}

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

    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse({ action: 'test' }))
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
    const fetchSpy = vi.fn().mockImplementation(async () => jsonResponse({ action: 'test' }))
    vi.stubGlobal('fetch', fetchSpy)

    const mod = await import('../nexus-api.js')
    mod.resetApiConfig()

    await mod.nexusApi('/api/mcp/sessions')

    const [, opts] = fetchSpy.mock.calls[0]
    expect(opts.headers).not.toHaveProperty('X-Nexus-Machine-Id')
  })
})

describe('nexus-api: response handling', () => {
  let nexusApi: typeof import('../nexus-api.js').nexusApi

  beforeEach(async () => {
    vi.resetModules()
    process.env.NEXUS_API_URL = 'https://test.nexus.example.com'
    process.env.NEXUS_PRIVATE_TOKEN = 'nxs_pat_test-token-for-response-tests'
    const mod = await import('../nexus-api.js')
    nexusApi = mod.nexusApi
    mod.resetApiConfig()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(response: Response | Error) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        if (response instanceof Error) throw response
        return response
      }),
    )
  }

  it('surfaces an empty 500 as HTTP 500 with the real status', async () => {
    stubFetch(new Response('', { status: 500, statusText: 'Internal Server Error' }))

    const res = await nexusApi('/api/mcp/search', { method: 'POST', body: {} })

    expect(res).toEqual({
      ok: false,
      status: 500,
      data: null,
      error: 'HTTP 500 Internal Server Error',
    })
  })

  it('surfaces an HTML 502 with status and a short sanitized snippet', async () => {
    const html = `<html>\n  <body>Bad Gateway nxs_pat_leakedtoken123 ${'x'.repeat(500)}</body>\n</html>`
    stubFetch(new Response(html, { status: 502, statusText: 'Bad Gateway' }))

    const res = await nexusApi('/api/mcp/sessions')

    expect(res.ok).toBe(false)
    expect(res.status).toBe(502)
    expect(res.error).toMatch(/^HTTP 502 Bad Gateway: <html> <body>Bad Gateway \[redacted\]/)
    expect(res.error).not.toContain('nxs_pat_')
    expect(res.error).not.toContain('\n')
    expect(res.error!.length).toBeLessThan(260)
  })

  it('keeps the JSON error field of a 4xx response and adds the status', async () => {
    stubFetch(jsonResponse({ error: 'Project not found' }, { status: 404 }))

    const res = await nexusApi('/api/mcp/projects')

    expect(res).toEqual({ ok: false, status: 404, data: null, error: 'Project not found (HTTP 404)' })
  })

  it('surfaces a 403 permission denial with the server message', async () => {
    stubFetch(jsonResponse({ error: 'Platform admin required' }, { status: 403 }))

    const res = await nexusApi('/api/mcp/reviews', { method: 'POST', body: {} })

    expect(res.status).toBe(403)
    expect(res.error).toBe('Platform admin required (HTTP 403)')
  })

  it('includes the JSON error code when present', async () => {
    stubFetch(jsonResponse({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 }))

    const res = await nexusApi('/api/mcp/dispatches', { method: 'POST', body: {} })

    expect(res.error).toBe('Project not found (HTTP 404, code: PROJECT_NOT_FOUND)')
  })

  it('appends the ref of a JSON 5xx error', async () => {
    stubFetch(jsonResponse({ error: 'Embedding failed', ref: 'err_abc123' }, { status: 503 }))

    const res = await nexusApi('/api/mcp/search', { method: 'POST', body: {} })

    expect(res.status).toBe(503)
    expect(res.error).toBe('Embedding failed (HTTP 503, ref: err_abc123)')
  })

  it('reports invalid JSON with HTTP 200 as an error with the real status', async () => {
    stubFetch(new Response('<html>not json</html>', { status: 200 }))

    const res = await nexusApi('/api/mcp/sessions')

    expect(res).toEqual({
      ok: false,
      status: 200,
      data: null,
      error: 'Invalid JSON response (HTTP 200)',
    })
  })

  it('returns status 0 for a timeout', async () => {
    stubFetch(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))

    const res = await nexusApi('/api/mcp/sessions', { timeoutMs: 10 })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(0)
    expect(res.error).toBe('The operation was aborted due to timeout')
  })

  it('returns status 0 for a network error', async () => {
    stubFetch(new TypeError('fetch failed'))

    const res = await nexusApi('/api/mcp/sessions')

    expect(res).toEqual({ ok: false, status: 0, data: null, error: 'fetch failed' })
  })

  it('passes through a successful JSON body, including a warning field', async () => {
    stubFetch(jsonResponse({ results: [], warning: 'Semantic search unavailable' }))

    const res = await nexusApi('/api/mcp/search', { method: 'POST', body: {} })

    expect(res).toEqual({
      ok: true,
      status: 200,
      data: { results: [], warning: 'Semantic search unavailable' },
      error: null,
    })
  })
})
