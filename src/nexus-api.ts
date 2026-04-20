/**
 * Nexus API client for MCP server context.
 *
 * Replaces direct Supabase access with HTTP calls to the Nexus API.
 * All operations go through /api/mcp/* endpoints, authenticated
 * via the NEXUS_PRIVATE_TOKEN (nxs_pat_*) Bearer token.
 */

let _baseUrl: string | null = null
let _token: string | null = null

/**
 * Reset the cached API configuration. Used by E2E tests to switch
 * from mocked env vars to real credentials.
 */
export function resetApiConfig(): void {
  _baseUrl = null
  _token = null
}

function getConfig(): { baseUrl: string; token: string } {
  if (_baseUrl && _token) return { baseUrl: _baseUrl, token: _token }

  const url = process.env.NEXUS_API_URL ?? process.env.NEXUS_URL
  const token = process.env.NEXUS_PRIVATE_TOKEN

  if (!url) {
    throw new Error(
      'MCP: Missing NEXUS_API_URL. Set the base URL of the Nexus app (e.g. https://nexus.gatewarden.eu).',
    )
  }
  if (!token) {
    throw new Error(
      'MCP: Missing NEXUS_PRIVATE_TOKEN. The MCP server requires a valid nxs_pat_* token.',
    )
  }

  // Normalize: strip trailing slash
  _baseUrl = url.replace(/\/$/, '')
  _token = token.trim()

  return { baseUrl: _baseUrl, token: _token }
}

export interface NexusApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

/** Default HTTP timeout in milliseconds (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Make an authenticated request to the Nexus API.
 */
export async function nexusApi<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    timeoutMs?: number
  } = {},
): Promise<NexusApiResponse<T>> {
  const { baseUrl, token } = getConfig()
  const method = options.method ?? 'GET'
  const url = `${baseUrl}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  try {
    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    }
    if (options.body !== undefined) {
      fetchOpts.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, fetchOpts)
    const data = (await response.json()) as T & { error?: string }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error:
          (data as Record<string, unknown>)?.error as string ??
          `HTTP ${response.status}`,
      }
    }

    return { ok: true, status: response.status, data, error: null }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Unknown fetch error',
    }
  }
}

/**
 * Convenience: POST to a Nexus MCP endpoint.
 */
export async function nexusPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<NexusApiResponse<T>> {
  return nexusApi<T>(path, { method: 'POST', body })
}

/**
 * Convenience: GET from a Nexus MCP endpoint.
 */
export async function nexusGet<T = unknown>(
  path: string,
): Promise<NexusApiResponse<T>> {
  return nexusApi<T>(path, { method: 'GET' })
}
